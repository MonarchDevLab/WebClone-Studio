import { EventEmitter } from 'events';
import Bottleneck from 'bottleneck';
import path from 'path';
import fs from 'fs';
import robotsParser from 'robots-parser';
import { 
  CloneSettings, CloneProgress, FileAddedEvent, CloneLogEntry, 
  CloneCompleteEvent, CloneErrorEvent, TechSignature, AnalyzeResult 
} from '../../shared/types';
import { FileOrganizer } from './file-organizer';
import { AssetDownloader } from './asset-downloader';
import { PageProcessor, DiscoveredAsset } from './page-processor';
import { UrlRewriter } from './url-rewriter';
import { ManifestGenerator } from '../output/manifest-generator';
import { ReadmeGenerator } from '../output/readme-generator';
import { ReportGenerator } from '../output/report-generator';
import { SystemMapGenerator } from '../generators/system-map-generator';
import { PageRenderer } from '../browser/page-renderer';

interface QueueItem {
  url: string;
  depth: number;
  type: DiscoveredAsset['type'];
  isPage: boolean;
}

export class CrawlerEngine extends EventEmitter {
  private targetUrl: string;
  private settings: CloneSettings;
  private outputPath: string;
  private projectName: string;
  private technologies: TechSignature[];
  private analyzeResult?: AnalyzeResult;

  private organizer: FileOrganizer;
  private downloader: AssetDownloader;
  private limiter: Bottleneck;
  private dynamicLimiter = new Bottleneck({ maxConcurrent: 2 });
  private pageRenderer = new PageRenderer();

  private queue: QueueItem[] = [];
  private visitedUrls = new Set<string>();
  private urlToLocalPathMap = new Map<string, string>(); // assetUrl -> absoluteLocalPath
  private pagesToRewrite: Array<{ url: string; localPath: string; html: string }> = [];
  private failedUrlsList: Array<{ url: string; error: string; time: string }> = [];

  private isRunning = false;
  private isPaused = false;
  private isCancelled = false;
  private resumeResolver: (() => void) | null = null;
  private robotsChecker: any = null;
  private screenshotBuffer: Buffer | null = null;

  private stats = {
    totalPages: 0,
    totalAssets: 0,
    totalFiles: 0,
    totalSizeBytes: 0,
    failedUrls: 0,
    startTime: 0,
    lastSpeedCalcTime: 0,
    lastSpeedBytes: 0,
    currentSpeedBps: 0,
  };

  private fileCounts = {
    html: { count: 0, sizeBytes: 0 },
    css: { count: 0, sizeBytes: 0 },
    js: { count: 0, sizeBytes: 0 },
    images: { count: 0, sizeBytes: 0 },
    fonts: { count: 0, sizeBytes: 0 },
    media: { count: 0, sizeBytes: 0 },
    other: { count: 0, sizeBytes: 0 },
  };

  constructor(
    targetUrl: string,
    settings: CloneSettings,
    outputPath: string,
    projectName?: string,
    technologies: TechSignature[] = [],
    analyzeResult?: AnalyzeResult,
    analyzeScreenshot?: Buffer
  ) {
    super();
    this.targetUrl = targetUrl;
    this.settings = settings;
    this.outputPath = outputPath;
    this.projectName = projectName || new URL(targetUrl).hostname;
    this.technologies = technologies;
    this.analyzeResult = analyzeResult;
    // Analiz aşamasında çekilmiş ekran görüntüsü varsa statik mod için devral
    this.screenshotBuffer = analyzeScreenshot || null;

    this.organizer = new FileOrganizer({
      baseOutputDir: outputPath,
      projectName: this.projectName,
      targetUrl: targetUrl,
    });

    this.downloader = new AssetDownloader(settings.userAgent || 'WebCloneStudio/1.0');

    this.limiter = new Bottleneck({
      maxConcurrent: settings.concurrentDownloads || 5,
      minTime: settings.rateLimit || 100,
    });
  }

  public async start(): Promise<void> {
    this.isRunning = true;
    this.isPaused = false;
    this.isCancelled = false;
    this.stats.startTime = Date.now();
    this.stats.lastSpeedCalcTime = Date.now();

    this.emitLog('info', `Klonlama başlatılıyor: ${this.targetUrl}`);
    this.emitLog('info', `Hedef klasör hazırlanıyor: ${this.outputPath}`);

    await this.organizer.initializeDirectories();

    // robots.txt tarama izinleri kontrolü
    if (this.settings.respectRobotsTxt) {
      try {
        const origin = new URL(this.targetUrl).origin;
        const robotsUrl = `${origin}/robots.txt`;
        const robotsRes = await this.downloader.downloadToBuffer(robotsUrl);
        if (robotsRes.statusCode === 200 && robotsRes.buffer) {
          const robotsTxt = robotsRes.buffer.toString('utf-8');
          this.robotsChecker = robotsParser(robotsUrl, robotsTxt);
          this.emitLog('info', 'robots.txt kuralları yüklendi.');
        }
      } catch (e) {
        this.emitLog('debug', 'robots.txt okunamadı, standart taramaya devam ediliyor.');
      }
    }

    // Başlangıç sayfasını kuyruğa ekle
    this.queue.push({
      url: this.targetUrl,
      depth: 0,
      type: 'html',
      isPage: true,
    });

    this.processQueueLoop().catch((err) => {
      console.error('[CrawlerEngine] Kuyruk döngüsü hatası:', err);
      this.emitError(this.targetUrl, err.message || 'Kuyruk işleme hatası', 'QUEUE_FATAL');
    });
  }

  public pause(): void {
    this.isPaused = true;
    this.emitLog('warn', 'Klonlama duraklatıldı.');
  }

  public resume(): void {
    if (this.isPaused) {
      this.isPaused = false;
      this.emitLog('info', 'Klonlamaya devam ediliyor.');
      if (this.resumeResolver) {
        this.resumeResolver();
        this.resumeResolver = null;
      }
    }
  }

  public cancel(): void {
    if (this.isCancelled) return;
    this.isCancelled = true;
    this.isRunning = false;
    if (this.resumeResolver) {
      this.resumeResolver();
      this.resumeResolver = null;
    }
    this.emitLog('error', 'Klonlama kullanıcı tarafından iptal edildi.');
  }

  private isUrlAllowed(urlStr: string): boolean {
    try {
      const urlObj = new URL(urlStr);
      const pathname = urlObj.pathname;

      // 1. robots.txt kontrolü
      if (this.robotsChecker && !this.robotsChecker.isAllowed(urlStr, this.settings.userAgent || 'WebCloneStudio')) {
        return false;
      }

      // 2. Hariç tutulan desenler (excludedPatterns)
      if (this.settings.excludedPatterns && this.settings.excludedPatterns.length > 0) {
        for (const pattern of this.settings.excludedPatterns) {
          if (!pattern.trim()) continue;
          const regexStr = pattern.trim().replace(/\*/g, '.*');
          const regex = new RegExp(regexStr, 'i');
          if (regex.test(pathname) || regex.test(urlStr)) {
            return false;
          }
        }
      }

      // 3. Dahil edilen desenler (includedPatterns)
      if (this.settings.includedPatterns && this.settings.includedPatterns.length > 0) {
        const hasValidPattern = this.settings.includedPatterns.some(p => p.trim().length > 0);
        if (hasValidPattern) {
          let matched = false;
          for (const pattern of this.settings.includedPatterns) {
            if (!pattern.trim()) continue;
            const regexStr = pattern.trim().replace(/\*/g, '.*');
            const regex = new RegExp(regexStr, 'i');
            if (regex.test(pathname) || regex.test(urlStr)) {
              matched = true;
              break;
            }
          }
          if (!matched) return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Asenkron indirme havuzu (Promise.race tabanlı kuyruk yönetimi).
   */
  private async processQueueLoop(): Promise<void> {
    const origin = new URL(this.targetUrl).origin;
    const maxConcurrency = Math.max(1, Math.min(this.settings.concurrentDownloads || 5, 15));
    const inFlight = new Set<Promise<void>>();

    while ((this.queue.length > 0 || inFlight.size > 0) && this.isRunning && !this.isCancelled) {
      if (this.isPaused) {
        await new Promise<void>((resolve) => {
          this.resumeResolver = resolve;
        });
        continue;
      }

      // Max file limit kontrolü
      if (this.stats.totalFiles >= 10000) {
        this.emitLog('warn', 'Maksimum dosya limitine (10.000) ulaşıldı, klonlama tamamlanıyor.');
        break;
      }

      // Havuz kapasitesi kadar işi eşzamanlı başlat
      while (this.queue.length > 0 && inFlight.size < maxConcurrency && !this.isPaused && !this.isCancelled) {
        const item = this.queue.shift();
        if (!item || this.visitedUrls.has(item.url)) continue;

        if (!this.isUrlAllowed(item.url)) {
          this.emitLog('debug', `Filtre dışı URL atlandı: ${item.url}`);
          continue;
        }

        this.visitedUrls.add(item.url);

        const task: Promise<void> = this.limiter.schedule(() => this.processItem(item, origin))
          .catch((err) => {
            this.stats.failedUrls++;
            this.failedUrlsList.push({ url: item.url, error: err.message, time: new Date().toISOString() });
            this.emitError(item.url, err.message || 'İndirme hatası', 'DOWNLOAD_EXCEPTION');
          })
          .finally(() => {
            inFlight.delete(task);
            this.updateProgress(item.url);
          });

        inFlight.add(task);
      }

      if (inFlight.size > 0) {
        await Promise.race(inFlight);
      }
    }

    // İptal edilmiş veya bitmiş olsa bile aktif in-flight görevlerin tamamlanmasını/settled olmasını bekle
    if (inFlight.size > 0) {
      await Promise.allSettled(Array.from(inFlight));
    }

    await this.finalizeCloning(this.isCancelled);
  }

  private async processItem(item: QueueItem, origin: string): Promise<void> {
    const mapping = this.organizer.mapUrlToLocalPath(item.url, origin, item.type);

    if (item.isPage) {
      let htmlStr = '';
      let statusCode = 200;
      let sizeBytes = 0;
      let finalUrl = item.url;

      // Dinamik SPA Modu veya Statik Mod
      if (this.settings.mode === 'dynamic') {
        try {
          const rendered = await this.dynamicLimiter.schedule(() => 
            this.pageRenderer.render(item.url, { timeoutMs: 25000 })
          );
          htmlStr = rendered.html;
          sizeBytes = Buffer.byteLength(htmlStr, 'utf-8');
          if (!this.screenshotBuffer && rendered.screenshot) {
            this.screenshotBuffer = rendered.screenshot;
          }
        } catch (renderErr: any) {
          this.emitLog('warn', `Dinamik render uyarısı (${item.url}), statik moda geçiliyor: ${renderErr.message}`);
          const staticRes = await this.downloader.downloadToBuffer(item.url, this.settings.maxFileSize);
          if (!staticRes.buffer || staticRes.statusCode >= 400) {
            this.stats.failedUrls++;
            this.failedUrlsList.push({ url: item.url, error: `HTTP ${staticRes.statusCode}`, time: new Date().toISOString() });
            this.emitError(item.url, `HTTP ${staticRes.statusCode}`, 'HTTP_ERROR');
            return;
          }
          htmlStr = staticRes.buffer.toString('utf-8');
          statusCode = staticRes.statusCode;
          sizeBytes = staticRes.sizeBytes;
          finalUrl = staticRes.finalUrl || item.url;
        }
      } else {
        const staticRes = await this.downloader.downloadToBuffer(item.url, this.settings.maxFileSize);
        if (!staticRes.buffer || staticRes.statusCode >= 400) {
          this.stats.failedUrls++;
          this.failedUrlsList.push({ url: item.url, error: `HTTP ${staticRes.statusCode}`, time: new Date().toISOString() });
          this.emitError(item.url, `HTTP ${staticRes.statusCode}`, 'HTTP_ERROR');
          return;
        }
        htmlStr = staticRes.buffer.toString('utf-8');
        statusCode = staticRes.statusCode;
        sizeBytes = staticRes.sizeBytes;
        finalUrl = staticRes.finalUrl || item.url;
      }

      this.registerUrlMapping(item.url, mapping.absolutePath, finalUrl);

      // Varlıkları ve alt sayfaları keşfet
      const processed = PageProcessor.process(htmlStr, item.url, this.settings, origin);

      // Derinlik filtresi: Sayfalar derinlik sınırına tabi tutulurken varlıklar (CSS, JS, medya) eksiksiz indirilir
      for (const asset of processed.discoveredAssets) {
        if (!this.visitedUrls.has(asset.url)) {
          if (asset.isPage) {
            if (item.depth + 1 <= this.settings.maxDepth) {
              this.queue.push({
                url: asset.url,
                depth: item.depth + 1,
                type: asset.type,
                isPage: true,
              });
            }
          } else {
            this.queue.push({
              url: asset.url,
              depth: item.depth,
              type: asset.type,
              isPage: false,
            });
          }
        }
      }

      this.pagesToRewrite.push({
        url: item.url,
        localPath: mapping.absolutePath,
        html: htmlStr,
      });

      this.recordFileStats('html', sizeBytes);
      this.stats.totalPages++;
      this.emitFileAdded(mapping.absolutePath, sizeBytes, 'text/html', statusCode, item.depth);

    } else {
      // Statik Asset (CSS, JS, Resim, Font, Medya)
      const downloadRes = await this.downloader.downloadToFile(item.url, mapping.absolutePath, this.settings.maxFileSize);
      if (downloadRes.statusCode >= 400 || !downloadRes.localPath) {
        this.stats.failedUrls++;
        this.failedUrlsList.push({ url: item.url, error: `HTTP ${downloadRes.statusCode}`, time: new Date().toISOString() });
        this.emitError(item.url, `HTTP ${downloadRes.statusCode}`, 'HTTP_ERROR');
        return;
      }

      this.registerUrlMapping(item.url, mapping.absolutePath, downloadRes.finalUrl);

      // CSS Varlık Keşfi: İndirilen stil dosyasından font ve arka plan görsellerini ayrıştır
      if (item.type === 'css' || mapping.absolutePath.endsWith('.css')) {
        try {
          const cssContent = await fs.promises.readFile(mapping.absolutePath, 'utf-8');
          const cssAssets = PageProcessor.extractCssUrls(cssContent, item.url, this.settings, origin);
          for (const cssAsset of cssAssets) {
            if (!this.visitedUrls.has(cssAsset.url)) {
              this.queue.push({
                url: cssAsset.url,
                depth: item.depth,
                type: cssAsset.type,
                isPage: false,
              });
            }
          }
        } catch {}
      }

      const fileTypeKey = item.type === 'image' ? 'images' : item.type;
      this.recordFileStats(fileTypeKey, downloadRes.sizeBytes);
      this.stats.totalAssets++;
      this.emitFileAdded(mapping.absolutePath, downloadRes.sizeBytes, downloadRes.mimeType, downloadRes.statusCode, item.depth);
    }
  }

  private async finalizeCloning(isCancelled: boolean = false): Promise<void> {
    this.emitLog('info', isCancelled 
      ? 'Klonlama sonlandırılıyor (İptal edildi)...' 
      : 'Tüm dosyalar indirildi. URL rewriting ve offline link dönüştürme başlatılıyor...');

    const siteRoot = this.organizer.getFolders().siteDir;

    // 1. HTML sayfalarını offline linklerle yeniden yaz
    for (const page of this.pagesToRewrite) {
      try {
        const rewrittenHtml = UrlRewriter.rewriteHtml(page.html, {
          currentPageUrl: page.url,
          currentLocalFilePath: page.localPath,
          siteRootPath: siteRoot,
          urlMap: this.urlToLocalPathMap,
        });

        await this.organizer.writeAsset(page.localPath, Buffer.from(rewrittenHtml, 'utf-8'));
      } catch (err: any) {
        this.emitLog('warn', `Sayfa rewrite hatası (${page.url}): ${err.message}`);
      }
    }

    // 2. CSS dosyalarını offline url() ve @import ile yeniden yaz
    const rewrittenCssPaths = new Set<string>();
    for (const [assetUrl, localPath] of this.urlToLocalPathMap.entries()) {
      if (localPath.endsWith('.css') && !rewrittenCssPaths.has(localPath)) {
        rewrittenCssPaths.add(localPath);
        try {
          if (fs.existsSync(localPath)) {
            const rawCss = await fs.promises.readFile(localPath, 'utf-8');
            const rewrittenCss = UrlRewriter.rewriteCss(rawCss, {
              currentPageUrl: assetUrl,
              currentLocalFilePath: localPath,
              siteRootPath: siteRoot,
              urlMap: this.urlToLocalPathMap,
            });
            await fs.promises.writeFile(localPath, rewrittenCss, 'utf-8');
          }
        } catch {}
      }
    }

    // 3. Ekran Görüntüsünü Kaydet (_screenshots/thumbnail.png)
    if (this.screenshotBuffer) {
      try {
        const thumbPath = path.join(this.organizer.getFolders().screenshotsDir, 'thumbnail.png');
        await fs.promises.writeFile(thumbPath, this.screenshotBuffer);
      } catch {}
    }

    // 4. Raporları Üret (_meta/tech-report.html, _meta/analyze.json, _meta/SYSTEM_MAP.md, _meta/errors.log)
    const domain = new URL(this.targetUrl).hostname;
    if (this.analyzeResult) {
      try {
        const htmlReport = ReportGenerator.generateHtmlReport(this.analyzeResult, domain);
        await this.organizer.writeMetaFile('tech-report.html', htmlReport);
        await this.organizer.writeMetaFile('analyze.json', this.analyzeResult);

        // Ultra detaylı sistem haritasını (_meta/SYSTEM_MAP.md) otomatik üret
        const systemMapMd = SystemMapGenerator.generate(this.analyzeResult);
        await this.organizer.writeMetaFile('SYSTEM_MAP.md', systemMapMd);
      } catch (e) {
        this.emitLog('warn', 'Meta rapor veya sistem haritası oluşturulurken hata oluştu.');
      }
    }

    if (this.failedUrlsList.length > 0) {
      try {
        const errorLogContent = this.failedUrlsList
          .map(item => `[${item.time}] ${item.url} -> ${item.error}`)
          .join('\n');
        await this.organizer.writeMetaFile('errors.log', errorLogContent);
      } catch {}
    }

    // 5. manifest.json ve README.md üret
    const durationSeconds = Math.max(1, Math.round((Date.now() - this.stats.startTime) / 1000));
    
    try {
      const manifest = ManifestGenerator.generate({
        projectName: this.projectName,
        targetUrl: this.targetUrl,
        settings: this.settings,
        technologies: this.technologies,
        stats: {
          totalPages: this.stats.totalPages,
          totalAssets: this.stats.totalAssets,
          totalFiles: this.stats.totalFiles,
          totalSizeBytes: this.stats.totalSizeBytes,
          failedUrls: this.stats.failedUrls,
          durationSeconds,
        },
        fileCounts: this.fileCounts,
        entryPoint: 'site/index.html',
        screenshotPath: this.screenshotBuffer ? '_screenshots/thumbnail.png' : undefined,
      });

      const readmeContent = ReadmeGenerator.generate(manifest);

      const projectDir = this.organizer.getFolders().projectDir;
      const manifestPath = path.join(projectDir, 'manifest.json');
      const readmePath = path.join(projectDir, 'README.md');

      await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
      await fs.promises.writeFile(readmePath, readmeContent, 'utf-8');

      this.isRunning = false;
      this.emitLog('info', isCancelled 
        ? `Klonlama durduruldu. Kısmi proje dizini: ${projectDir}`
        : `🎉 Klonlama başarıyla tamamlandı! Proje dizini: ${projectDir}`);

      const completeEvent: CloneCompleteEvent = {
        totalFiles: this.stats.totalFiles,
        totalSize: this.stats.totalSizeBytes,
        duration: durationSeconds,
        outputPath: projectDir,
        manifestPath,
      };

      this.emit('complete', completeEvent);
    } catch (err: any) {
      console.error('[CrawlerEngine] finalizeCloning hatası:', err);
      this.emitError(this.targetUrl, err.message || 'Klonlama sonlandırma hatası', 'FINALIZE_ERROR');
    }
  }

  private registerUrlMapping(url: string, localPath: string, finalUrl?: string): void {
    if (!url || !localPath) return;
    this.urlToLocalPathMap.set(url, localPath);

    const noHash = url.split('#')[0];
    if (!this.urlToLocalPathMap.has(noHash)) {
      this.urlToLocalPathMap.set(noHash, localPath);
    }

    const noQuery = noHash.split('?')[0];
    if (!this.urlToLocalPathMap.has(noQuery)) {
      this.urlToLocalPathMap.set(noQuery, localPath);
    }

    const slashToggle = noQuery.endsWith('/') ? noQuery.slice(0, -1) : `${noQuery}/`;
    if (!this.urlToLocalPathMap.has(slashToggle)) {
      this.urlToLocalPathMap.set(slashToggle, localPath);
    }

    if (finalUrl && finalUrl !== url) {
      this.urlToLocalPathMap.set(finalUrl, localPath);
      const noHashFinal = finalUrl.split('#')[0];
      if (!this.urlToLocalPathMap.has(noHashFinal)) {
        this.urlToLocalPathMap.set(noHashFinal, localPath);
      }
      const noQueryFinal = noHashFinal.split('?')[0];
      if (!this.urlToLocalPathMap.has(noQueryFinal)) {
        this.urlToLocalPathMap.set(noQueryFinal, localPath);
      }
      const slashToggleFinal = noQueryFinal.endsWith('/') ? noQueryFinal.slice(0, -1) : `${noQueryFinal}/`;
      if (!this.urlToLocalPathMap.has(slashToggleFinal)) {
        this.urlToLocalPathMap.set(slashToggleFinal, localPath);
      }
    }
  }

  private recordFileStats(type: string, sizeBytes: number): void {
    this.stats.totalFiles++;
    this.stats.totalSizeBytes += sizeBytes;

    const countKey = (type === 'image' ? 'images' : type) as keyof typeof this.fileCounts;
    if (this.fileCounts[countKey]) {
      this.fileCounts[countKey].count++;
      this.fileCounts[countKey].sizeBytes += sizeBytes;
    } else {
      this.fileCounts.other.count++;
      this.fileCounts.other.sizeBytes += sizeBytes;
    }
  }

  private updateProgress(activeUrl: string): void {
    const now = Date.now();
    const timeDiff = (now - this.stats.lastSpeedCalcTime) / 1000;
    if (timeDiff >= 1) {
      const bytesDiff = this.stats.totalSizeBytes - this.stats.lastSpeedBytes;
      this.stats.currentSpeedBps = Math.round(bytesDiff / timeDiff);
      this.stats.lastSpeedCalcTime = now;
      this.stats.lastSpeedBytes = this.stats.totalSizeBytes;
    }

    const downloaded = this.stats.totalFiles;
    const queued = this.queue.length;
    const total = downloaded + queued;
    const remainingFiles = queued;
    const eta = this.stats.currentSpeedBps > 0 && remainingFiles > 0
      ? Math.round((remainingFiles * 50 * 1024) / this.stats.currentSpeedBps)
      : 0;

    const progressEvent: CloneProgress = {
      downloaded,
      queued,
      failed: this.stats.failedUrls,
      speed: this.stats.currentSpeedBps,
      activeUrl,
      eta,
      bytesTransferred: this.stats.totalSizeBytes,
      totalEstimatedBytes: Math.max(this.stats.totalSizeBytes, total * 50 * 1024),
    };

    this.emit('progress', progressEvent);
  }

  private emitLog(level: CloneLogEntry['level'], message: string, url?: string): void {
    const log: CloneLogEntry = {
      level,
      message,
      timestamp: Date.now(),
      url,
    };
    this.emit('log', log);
  }

  private emitFileAdded(localPath: string, size: number, mimeType: string, httpStatus: number, depth: number): void {
    const event: FileAddedEvent = {
      path: localPath,
      size,
      mimeType,
      httpStatus,
      depth,
    };
    this.emit('file-added', event);
  }

  private emitError(url: string, message: string, code: string): void {
    const event: CloneErrorEvent = {
      url,
      message,
      code,
      retryCount: 2,
    };
    this.emit('error', event);
    this.emitLog('error', `[${code}] ${url} — ${message}`, url);
  }
}
