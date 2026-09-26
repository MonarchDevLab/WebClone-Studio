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
import { PageProcessor, DiscoveredAsset, isInternalDomain } from './page-processor';
import { UrlRewriter } from './url-rewriter';
import { ManifestGenerator } from '../output/manifest-generator';
import { ReadmeGenerator } from '../output/readme-generator';
import { ReportGenerator } from '../output/report-generator';
import { SystemMapGenerator } from '../generators/system-map-generator';
import { PageRenderer } from '../browser/page-renderer';
import { reconstructSourceTree } from './reverse-engineering/sourcemap-reconstructor';
import { extractFrameworkState } from './reverse-engineering/framework-extractor';
import { extractDesignTokensFromCss } from './reverse-engineering/token-extractor';
import { ApiTrafficInterceptor } from './reverse-engineering/api-interceptor';

interface QueueItem {
  url: string;
  depth: number;
  type: DiscoveredAsset['type'];
  isPage: boolean;
}

function escapeWildcardToRegExp(pattern: string): RegExp {
  const trimmed = pattern.trim();
  const escaped = trimmed.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(escaped, 'i');
}

function isSpaShell(html: string): boolean {
  if (!html) return true;
  const hasSpaMount = /id=["'](?:root|app|__next|__nuxt)["']\s*>\s*<\//i.test(html) ||
                      /<app-root\b[^>]*>\s*<\/app-root>/i.test(html);
  const hasNoScriptWarning = /enable JavaScript/i.test(html) || /JavaScript is required/i.test(html);
  const bodyText = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                       .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                       .replace(/<[^>]+>/g, ' ')
                       .replace(/\s+/g, ' ')
                       .trim();
  return (hasSpaMount || hasNoScriptWarning) && bodyText.length < 350;
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
  private queueHead = 0;
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
  private processedSourceMaps = new Set<string>();
  private extractedStates: Record<string, any> = {};
  private apiInterceptor = new ApiTrafficInterceptor();

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
    documents: { count: 0, sizeBytes: 0 },
    archives: { count: 0, sizeBytes: 0 },
    data: { count: 0, sizeBytes: 0 },
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

  private isUrlAllowed(urlStr: string, isPage: boolean = false): boolean {
    try {
      const urlObj = new URL(urlStr);
      const pathname = urlObj.pathname;

      // 1. robots.txt kontrolü SADECE sayfalar için geçerlidir; CSS/görsel/font varlıkları engellenmez
      if (isPage && this.settings.respectRobotsTxt && this.robotsChecker && !this.robotsChecker.isAllowed(urlStr, this.settings.userAgent || 'WebCloneStudio')) {
        return false;
      }

      // 2. Hariç tutulan desenler (excludedPatterns)
      if (this.settings.excludedPatterns && this.settings.excludedPatterns.length > 0) {
        for (const pattern of this.settings.excludedPatterns) {
          if (!pattern.trim()) continue;
          const regex = escapeWildcardToRegExp(pattern);
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
            const regex = escapeWildcardToRegExp(pattern);
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

  private get queueLength(): number {
    return Math.max(0, this.queue.length - this.queueHead);
  }

  private dequeueItem(): QueueItem | undefined {
    if (this.queueHead >= this.queue.length) return undefined;
    const item = this.queue[this.queueHead++];
    if (this.queueHead > 200 && this.queueHead * 2 >= this.queue.length) {
      this.queue = this.queue.slice(this.queueHead);
      this.queueHead = 0;
    }
    return item;
  }

  /**
   * Asenkron indirme havuzu (Promise.race tabanlı kuyruk yönetimi).
   */
  private async processQueueLoop(): Promise<void> {
    const origin = new URL(this.targetUrl).origin;
    const maxConcurrency = Math.max(1, Math.min(this.settings.concurrentDownloads || 5, 15));
    const inFlight = new Set<Promise<void>>();

    while ((this.queueLength > 0 || inFlight.size > 0) && this.isRunning && !this.isCancelled) {
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
      while (this.queueLength > 0 && inFlight.size < maxConcurrency && !this.isPaused && !this.isCancelled) {
        const item = this.dequeueItem();
        if (!item || this.visitedUrls.has(item.url)) continue;

        if (!this.isUrlAllowed(item.url, item.isPage)) {
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
            this.pageRenderer.render(item.url, { 
              timeoutMs: 25000,
              captureApi: !!this.settings.reverseEngineering
            })
          );
          htmlStr = rendered.html;
          sizeBytes = Buffer.byteLength(htmlStr, 'utf-8');
          if (!this.screenshotBuffer && rendered.screenshot) {
            this.screenshotBuffer = rendered.screenshot;
          }
          if (rendered.capturedEndpoints && rendered.capturedEndpoints.length > 0) {
            for (const ep of rendered.capturedEndpoints) {
              this.apiInterceptor.record(ep);
            }
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
          const errLabel = staticRes.statusCode === 404
            ? 'HTTP 404 (Hedef sitede mevcut değil / kırık sayfa)'
            : `HTTP ${staticRes.statusCode}`;
          this.failedUrlsList.push({ url: item.url, error: errLabel, time: new Date().toISOString() });
          this.emitError(item.url, errLabel, 'HTTP_ERROR');
          return;
        }
        htmlStr = staticRes.buffer.toString('utf-8');
        statusCode = staticRes.statusCode;
        sizeBytes = staticRes.sizeBytes;
        finalUrl = staticRes.finalUrl || item.url;

        // Akıllı SPA / İstemci Render Kurtarma: Sayfa boş iskeletse Chromium render motorunu devreye sok
        if (isSpaShell(htmlStr)) {
          this.emitLog('info', `İstemci render iskeleti tespit edildi (${item.url}), dinamik tarayıcı render uygulanıyor...`);
          try {
            const rendered = await this.dynamicLimiter.schedule(() =>
              this.pageRenderer.render(item.url, { 
                timeoutMs: 25000,
                captureApi: !!this.settings.reverseEngineering
              })
            );
            if (rendered.html && rendered.html.length > htmlStr.length) {
              htmlStr = rendered.html;
              sizeBytes = Buffer.byteLength(htmlStr, 'utf-8');
              if (!this.screenshotBuffer && rendered.screenshot) {
                this.screenshotBuffer = rendered.screenshot;
              }
              if (rendered.capturedEndpoints && rendered.capturedEndpoints.length > 0) {
                for (const ep of rendered.capturedEndpoints) {
                  this.apiInterceptor.record(ep);
                }
              }
            }
          } catch (spaErr: any) {
            this.emitLog('debug', `SPA fallback tamamlanamadı: ${spaErr.message}`);
          }
        }
      }

      // Başlangıç sayfası yönlendirildiyse hedef URL ve kök origin'i güncelle
      if (item.depth === 0 && finalUrl && finalUrl !== item.url) {
        try {
          const finalParsed = new URL(finalUrl);
          origin = finalParsed.origin;
          this.targetUrl = finalUrl;
        } catch {}
      }

      this.registerUrlMapping(item.url, mapping.absolutePath, finalUrl);

      // Varlıkları ve alt sayfaları keşfet
      const processed = PageProcessor.process(htmlStr, item.url, this.settings, origin);

      // Derinlik ve domain filtresi: Sayfalar iç domain ve derinlik sınırına tabi tutulurken varlıklar eksiksiz indirilir
      for (const asset of processed.discoveredAssets) {
        if (!this.visitedUrls.has(asset.url)) {
          if (asset.isPage) {
            let allowPage = item.depth + 1 <= this.settings.maxDepth && isInternalDomain(asset.url, origin);
            // Subdomain kontrolü
            if (allowPage && !this.settings.crawlSubdomains) {
              try {
                const targetHost = new URL(asset.url).hostname.toLowerCase().replace(/^www\./, '');
                const baseHost = new URL(origin).hostname.toLowerCase().replace(/^www\./, '');
                if (targetHost !== baseHost) {
                  allowPage = false;
                }
              } catch {
                allowPage = false;
              }
            }

            if (allowPage) {
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

      // Tersine Mühendislik (Reverse Engineering): SPA Framework State (Next.js, Nuxt vb.)
      if (this.settings.reverseEngineering) {
        try {
          const state = extractFrameworkState(htmlStr);
          if (state && Object.keys(state).length > 0) {
            this.extractedStates[item.url] = state;
            this.emitLog('info', `SPA framework durumu yakalandı: ${item.url}`);
          }
        } catch (stateErr: any) {
          this.emitLog('debug', `Framework state ayıklanamadı: ${stateErr.message}`);
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
      // Statik Asset (CSS, JS, Resim, Font, Medya, Doküman, Arşiv, Veri)
      const downloadRes = await this.downloader.downloadToFile(item.url, mapping.absolutePath, this.settings.maxFileSize);
      if (downloadRes.statusCode >= 400 || !downloadRes.localPath) {
        this.stats.failedUrls++;
        const errLabel = downloadRes.statusCode === 404
          ? 'HTTP 404 (Hedef sitede mevcut değil / kırık dosya)'
          : `HTTP ${downloadRes.statusCode}`;
        this.failedUrlsList.push({ url: item.url, error: errLabel, time: new Date().toISOString() });
        this.emitError(item.url, errLabel, 'HTTP_ERROR');
        return;
      }

      const finalLocalPath = downloadRes.localPath || mapping.absolutePath;
      this.registerUrlMapping(item.url, finalLocalPath, downloadRes.finalUrl);

      // CSS Varlık Keşfi: İndirilen stil dosyasından font ve arka plan görsellerini ayrıştır
      if (item.type === 'css' || finalLocalPath.endsWith('.css')) {
        try {
          const cssContent = await fs.promises.readFile(finalLocalPath, 'utf-8');
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

      // Tersine Mühendislik (Reverse Engineering): JS ve CSS dosyalarından sourcemap keşfet ve kaynak ağacını kurtar
      if (this.settings.reverseEngineering && (item.type === 'js' || item.type === 'css' || finalLocalPath.endsWith('.js') || finalLocalPath.endsWith('.css'))) {
        try {
          const fileContent = await fs.promises.readFile(finalLocalPath, 'utf-8');
          const mapUrl = PageProcessor.extractSourceMapUrl(fileContent, item.url);
          if (mapUrl && !this.processedSourceMaps.has(mapUrl)) {
            this.processedSourceMaps.add(mapUrl);
            const sourceCodeOutDir = path.join(this.organizer.getFolders().siteDir, '_source-code');
            if (mapUrl.startsWith('data:')) {
              const commaIdx = mapUrl.indexOf(',');
              if (commaIdx !== -1) {
                const b64Data = mapUrl.slice(commaIdx + 1);
                const mapJson = Buffer.from(b64Data, 'base64').toString('utf-8');
                await reconstructSourceTree(mapJson, sourceCodeOutDir);
                this.emitLog('info', `Inline sourcemap çözümlendi: ${path.basename(finalLocalPath)}`);
              }
            } else {
              this.emitLog('debug', `Sourcemap indiriliyor: ${mapUrl}`);
              const mapRes = await this.downloader.downloadToBuffer(mapUrl, this.settings.maxFileSize);
              if (mapRes.buffer && mapRes.statusCode < 400) {
                const mapJson = mapRes.buffer.toString('utf-8');
                await reconstructSourceTree(mapJson, sourceCodeOutDir);
                this.emitLog('info', `Sourcemap kaynak kod ağacı kurtarıldı: ${path.basename(mapUrl)}`);
              }
            }
          }
        } catch (mapErr: any) {
          this.emitLog('debug', `Sourcemap çözümlenemedi (${item.url}): ${mapErr.message}`);
        }
      }

      const fileTypeKey = item.type === 'image' ? 'images'
        : item.type === 'document' ? 'documents'
        : item.type === 'archive' ? 'archives'
        : item.type === 'data' ? 'data'
        : item.type;
      this.recordFileStats(fileTypeKey, downloadRes.sizeBytes);
      this.stats.totalAssets++;
      this.emitFileAdded(finalLocalPath, downloadRes.sizeBytes, downloadRes.mimeType, downloadRes.statusCode, item.depth);
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
    const collectedCssList: string[] = [];
    for (const [assetUrl, localPath] of this.urlToLocalPathMap.entries()) {
      if (localPath.endsWith('.css') && !rewrittenCssPaths.has(localPath)) {
        rewrittenCssPaths.add(localPath);
        try {
          if (fs.existsSync(localPath)) {
            const rawCss = await fs.promises.readFile(localPath, 'utf-8');
            collectedCssList.push(rawCss);
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

        // 4.1 Çevrimdışı 404 Sayfası: Orijinal sitede ölü olan linkler için şık bilgilendirme sayfası
        const deadLinksList = this.failedUrlsList
          .filter(item => item.error.includes('404'))
          .map(item => `<li><code>${item.url}</code></li>`)
          .join('\n');

        if (deadLinksList) {
          const offline404Html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sayfa Bulunamadı (Orijinal Sitede 404)</title>
  <style>
    body { background: #08090C; color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; box-sizing: border-box; }
    .card { background: #13161C; border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; padding: 36px; max-width: 560px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7); text-align: center; }
    .badge { display: inline-block; background: rgba(244,63,94,0.15); color: #F43F5E; border: 1px solid rgba(244,63,94,0.3); padding: 4px 14px; border-radius: 9999px; font-size: 11px; font-family: monospace; font-weight: 700; margin-bottom: 16px; letter-spacing: 0.05em; }
    h1 { color: #F1F5F9; font-size: 22px; margin: 0 0 12px 0; font-weight: 700; }
    p { color: #94A3B8; font-size: 13px; line-height: 1.6; margin: 0 0 18px 0; }
    .details { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 14px; text-align: left; max-height: 140px; overflow-y: auto; font-size: 11px; font-family: monospace; color: #CBD5E1; }
    .details ul { margin: 0; padding-left: 20px; }
    .details li { margin: 4px 0; word-break: break-all; }
    .btn { display: inline-block; margin-top: 24px; background: #00F5D4; color: #000; padding: 10px 22px; border-radius: 10px; font-size: 13px; font-weight: 700; text-decoration: none; transition: opacity 0.2s; }
    .btn:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">ORİJİNAL SİTEDE HTTP 404</div>
    <h1>Bu Sayfa Orijinal Canlı Sunucuda da Mevcut Değil</h1>
    <p>Klonlanan web sitesindeki bu bağlantı, sitenin orijinal sunucusunda da mevcut değildir (geliştirici tarafından arayüze ölü link konulmuş ancak yayına alınmamıştır).</p>
    <div class="details">
      <div style="font-weight:bold;margin-bottom:6px;color:#F43F5E;">Orijinal Sitede Bulunamayan Bağlantılar:</div>
      <ul>
        ${deadLinksList}
      </ul>
    </div>
    <a href="./index.html" class="btn">Ana Sayfaya Geri Dön</a>
  </div>
</body>
</html>`;
          await fs.promises.writeFile(path.join(siteRoot, '_404.html'), offline404Html, 'utf-8');
        }
      } catch {}
    }

    // 4.2 Tersine Mühendislik: SPA Framework Durumlarını Kaydet (_meta/extracted-state.json)
    if (this.settings.reverseEngineering && Object.keys(this.extractedStates).length > 0) {
      try {
        await this.organizer.writeMetaFile('extracted-state.json', this.extractedStates);
        this.emitLog('info', 'Tersine mühendislik SPA framework state verileri kaydedildi (_meta/extracted-state.json).');
      } catch (stateSaveErr: any) {
        this.emitLog('warn', `extracted-state.json kaydedilemedi: ${stateSaveErr.message}`);
      }
    }

    // 4.3 Tersine Mühendislik: CSS Token ve Tailwind Konfigürasyonunu Çıkar (_meta/tailwind.config.js, _meta/design-tokens.json)
    if (this.settings.reverseEngineering && collectedCssList.length > 0) {
      try {
        const { tokens, tailwindConfig } = extractDesignTokensFromCss(collectedCssList);
        await this.organizer.writeMetaFile('tailwind.config.js', tailwindConfig);
        await this.organizer.writeMetaFile('design-tokens.json', tokens);
        this.emitLog('info', 'Tersine mühendislik Tailwind ve tasarım tokenları üretildi (_meta/tailwind.config.js, _meta/design-tokens.json).');
      } catch (tokenErr: any) {
        this.emitLog('warn', `Tasarım tokenları çıkarılamadı: ${tokenErr.message}`);
      }
    }

    // 4.4 Tersine Mühendislik: Dinamik API Uç Noktalarını Kaydet (_meta/api-endpoints.json)
    if (this.settings.reverseEngineering) {
      const mockDb = this.apiInterceptor.exportMockDatabase();
      if (Object.keys(mockDb).length > 0) {
        try {
          await this.organizer.writeMetaFile('api-endpoints.json', mockDb);
          this.emitLog('info', 'Tersine mühendislik dinamik API uç noktaları kaydedildi (_meta/api-endpoints.json).');
        } catch (apiErr: any) {
          this.emitLog('warn', `api-endpoints.json kaydedilemedi: ${apiErr.message}`);
        }
      }
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
        : `Klonlama başarıyla tamamlandı! Proje dizini: ${projectDir}`);

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

    const countKey = (
      type === 'image' ? 'images'
      : type === 'document' ? 'documents'
      : type === 'archive' ? 'archives'
      : type === 'data' ? 'data'
      : type
    ) as keyof typeof this.fileCounts;

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
    const queued = this.queueLength;
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
