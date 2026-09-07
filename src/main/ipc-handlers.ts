import { ipcMain, dialog, shell, BrowserWindow, app } from 'electron';
import os from 'os';
import path from 'path';
import fs from 'fs';
import * as cheerio from 'cheerio';
import got from 'got';
import { IpcChannel } from '../shared/ipc-channels';
import { CloneSettings, AnalyzeResult, SiteMeta, SiteMapNode } from '../shared/types';
import { TechDetector } from './analyzers/tech-detector';
import { DesignAnalyzer } from './analyzers/design-analyzer';
import { SiteMapper } from './analyzers/site-mapper';
import { SecurityScanner } from './analyzers/security-scanner';
import { SizeEstimator } from './analyzers/size-estimator';
import { CrawlerEngine } from './cloner/crawler-engine';
import { SettingsStore } from './storage/settings-store';
import { ProjectStore } from './storage/project-store';
import { PageRenderer } from './browser/page-renderer';
import { SystemMapGenerator } from './generators/system-map-generator';
import { PreviewServer } from './server/preview-server';

// Aktif çalışan klonlama işlerini tutar
const activeJobs = new Map<string, CrawlerEngine>();
const analyzeCache = new Map<string, { result: AnalyzeResult; screenshot?: Buffer }>();
let lastAnalyzeResult: AnalyzeResult | null = null;
let lastAnalyzeScreenshot: Buffer | null = null;

function normalizeUrlKey(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`.replace(/\/+$/, '').toLowerCase();
  } catch {
    return url.trim().replace(/\/+$/, '').toLowerCase();
  }
}

function getDynamicFolder(name: 'downloads' | 'documents' | 'desktop'): string {
  try {
    if (app) {
      return app.getPath(name);
    }
  } catch {
    // fallback
  }
  const base = process.env.USERPROFILE || os.homedir();
  const folder = name.charAt(0).toUpperCase() + name.slice(1);
  return path.join(base, folder);
}

/**
 * Tüm IPC (Inter-Process Communication) handler'larını kaydeder ve olayları pencerelere iletir.
 */
export function registerIpcHandlers(mainWindow?: BrowserWindow) {
  const techDetector = new TechDetector();
  const designAnalyzer = new DesignAnalyzer();
  const siteMapper = new SiteMapper();
  const securityScanner = new SecurityScanner();
  const sizeEstimator = new SizeEstimator();
  const pageRenderer = new PageRenderer();
  const settingsStore = SettingsStore.getInstance();
  const projectStore = ProjectStore.getInstance();

  // 1. ANALYZE_START: 6 katmanlı teknoloji, tasarım, harita, meta ve güvenlik analizini çalıştırır
  ipcMain.handle(IpcChannel.ANALYZE_START, async (_event, url: string) => {
    try {
      console.log(`[IPC] Analiz başlatılıyor: ${url}`);
      
      let htmlBody = '';
      let globals: string[] = [];
      let renderedDesignTokens: any = null;
      let rawHeaders: Record<string, any> = {};
      lastAnalyzeScreenshot = null;

      // 1. Adım: Offscreen Chromium ile sayfayı render et (SPA desteği + JS globals + Tasarım Tokenları + Ekran Görüntüsü)
      try {
        const renderResult = await pageRenderer.render(url, { timeoutMs: 18000 });
        htmlBody = renderResult.html;
        globals = renderResult.globals;
        renderedDesignTokens = renderResult.designTokens;
        lastAnalyzeScreenshot = renderResult.screenshot || null;
      } catch (renderError) {
        console.warn(`[IPC] Offscreen render uyarısı (${url}), statik HTTP fallback devrede:`, renderError);
        try {
          const res = await got(url, { 
            timeout: { request: 8000 },
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) WebCloneStudio/1.0',
            },
            throwHttpErrors: false,
          });
          htmlBody = res.body;
          rawHeaders = res.headers;
        } catch {}
      }

      // 2. Adım: Meta Verileri Çıkar (Cheerio)
      const $ = cheerio.load(htmlBody || '');
      const meta: SiteMeta = {
        title: $('title').text().trim() || $('meta[property="og:title"]').attr('content') || new URL(url).hostname,
        description: $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '',
        ogImage: $('meta[property="og:image"]').attr('content'),
        canonical: $('link[rel="canonical"]').attr('href'),
        language: $('html').attr('lang') || 'tr',
        encoding: $('meta[charset]').attr('charset') || 'UTF-8',
        viewport: $('meta[name="viewport"]').attr('content'),
        favicon: $('link[rel*="icon"]').attr('href'),
      };

      // 3. Adım: Teknoloji Tespiti (Headers + Meta + HTML + JS globals)
      const technologies = await techDetector.analyze(url, {
        html: htmlBody,
        headers: rawHeaders,
        globals,
      });

      // 4. Adım: Tasarım Tokenları
      const designTokens = await designAnalyzer.analyze(url, renderedDesignTokens);

      // 5. Adım: Güvenlik Taraması
      const security = await securityScanner.scan(url);

      // 6. Adım: Hızlı Site Haritası (1. Derinlik)
      let sitemap: SiteMapNode = {
        url,
        title: meta.title || url,
        depth: 0,
        statusCode: 200,
        mimeType: 'text/html',
        size: htmlBody.length,
        assetCount: 0,
        children: [],
      };
      try {
        sitemap = await siteMapper.map(url, 3, 500);
      } catch (e) {
        console.warn('[IPC] Site haritası uyarısı:', e);
      }

      const result: AnalyzeResult = {
        technologies,
        designTokens,
        siteMap: sitemap,
        security,
        meta,
      };

      lastAnalyzeResult = result;
      analyzeCache.set(normalizeUrlKey(url), {
        result,
        screenshot: lastAnalyzeScreenshot || undefined,
      });
      return result;
    } catch (error: any) {
      console.error('[IPC] Analiz Hatası:', error);
      throw new Error(error.message || 'Site analizi sırasında hata oluştu.');
    }
  });

  // 2. CLONE_START: CrawlerEngine'i başlatır
  ipcMain.handle(IpcChannel.CLONE_START, async (event, { 
    url, 
    settings, 
    outputPath, 
    projectName 
  }: { 
    url: string; 
    settings: CloneSettings; 
    outputPath: string; 
    projectName?: string;
  }) => {
    try {
      const jobId = `job_${Date.now()}`;
      const sender = event.sender;
      const currentAppSettings = settingsStore.get();

      // İndirme dizini çözümleme (Hızlı butonlar veya varsayılan)
      let finalOutputDir = outputPath?.trim();
      if (!finalOutputDir || finalOutputDir.startsWith('[Varsayılan') || finalOutputDir === 'downloads') {
        finalOutputDir = currentAppSettings.defaultOutputDir || path.join(getDynamicFolder('downloads'), 'WebClone');
      } else if (finalOutputDir === 'documents') {
        finalOutputDir = path.join(getDynamicFolder('documents'), 'WebClone');
      } else if (finalOutputDir === 'desktop') {
        finalOutputDir = path.join(getDynamicFolder('desktop'), 'WebClone');
      }

      const parsedDomain = new URL(url).hostname;
      const finalProjectName = projectName?.trim() || parsedDomain;

      // URL bazlı önbellekten analiz sonucunu ve ekran görüntüsünü devral
      const cachedAnalysis = analyzeCache.get(normalizeUrlKey(url));
      const isSameAnalyzedUrl = cachedAnalysis || (lastAnalyzeResult?.siteMap?.url && normalizeUrlKey(lastAnalyzeResult.siteMap.url) === normalizeUrlKey(url));
      const targetAnalyzeResult = cachedAnalysis?.result || (isSameAnalyzedUrl ? lastAnalyzeResult : null);
      const technologies = targetAnalyzeResult?.technologies || [];
      const seedScreenshot = cachedAnalysis?.screenshot || (isSameAnalyzedUrl ? lastAnalyzeScreenshot || undefined : undefined);

      console.log(`[IPC] Klonlama başlatılıyor. Job: ${jobId}, URL: ${url}, Proje: ${finalProjectName}`);

      const crawler = new CrawlerEngine(
        url,
        settings,
        finalOutputDir,
        finalProjectName,
        technologies,
        targetAnalyzeResult || undefined,
        seedScreenshot
      );

      // İlerleme olaylarını renderer'a ilet
      crawler.on('progress', (data) => {
        if (!sender.isDestroyed()) {
          sender.send(IpcChannel.CLONE_PROGRESS, data);
        }
      });

      crawler.on('file-added', (data) => {
        if (!sender.isDestroyed()) {
          sender.send(IpcChannel.CLONE_FILE_ADDED, data);
        }
      });

      crawler.on('log', (data) => {
        if (!sender.isDestroyed()) {
          sender.send(IpcChannel.CLONE_LOG, data);
        }
      });

      crawler.on('complete', (data) => {
        try {
          if (targetAnalyzeResult) {
            const metaDir = path.join(finalOutputDir, '_meta');
            if (!fs.existsSync(metaDir)) fs.mkdirSync(metaDir, { recursive: true });
            const systemMapMd = SystemMapGenerator.generate(targetAnalyzeResult);
            fs.writeFileSync(path.join(metaDir, 'SYSTEM_MAP.md'), systemMapMd, 'utf-8');
          }
        } catch (err) {
          console.warn('[IPC] _meta/SYSTEM_MAP.md kaydetme uyarısı:', err);
        }
        if (!sender.isDestroyed()) {
          sender.send(IpcChannel.CLONE_COMPLETE, data);
        }
        activeJobs.delete(jobId);
      });

      crawler.on('error', (data) => {
        if (!sender.isDestroyed()) {
          sender.send(IpcChannel.CLONE_ERROR, data);
        }
      });

      activeJobs.set(jobId, crawler);
      crawler.start().catch((err) => {
        console.error('[IPC] Crawler başlatma hatası:', err);
        if (!sender.isDestroyed()) {
          sender.send(IpcChannel.CLONE_ERROR, {
            url,
            message: err.message || 'Klonlama motoru başlatılamadı',
            code: 'CRAWLER_INIT_FAILED',
            retryCount: 0,
          });
        }
      });

      return { success: true, jobId, outputPath: finalOutputDir };
    } catch (error: any) {
      console.error('[IPC] Klonlama Başlatma Hatası:', error);
      throw new Error(error.message || 'Klonlama başlatılamadı.');
    }
  });

  // 3. CLONE_PAUSE
  ipcMain.handle(IpcChannel.CLONE_PAUSE, async (_event, jobId: string) => {
    const job = activeJobs.get(jobId);
    if (job) {
      job.pause();
      return true;
    }
    return false;
  });

  // 4. CLONE_RESUME
  ipcMain.handle(IpcChannel.CLONE_RESUME, async (_event, jobId: string) => {
    const job = activeJobs.get(jobId);
    if (job) {
      job.resume();
      return true;
    }
    return false;
  });

  // 5. CLONE_CANCEL
  ipcMain.handle(IpcChannel.CLONE_CANCEL, async (_event, jobId: string) => {
    const job = activeJobs.get(jobId);
    if (job) {
      job.cancel();
      activeJobs.delete(jobId);
      return true;
    }
    return false;
  });

  // 6. DIALOG_SELECT_DIR: Klasör seçme penceresi açar
  ipcMain.handle(IpcChannel.DIALOG_SELECT_DIR, async () => {
    try {
      const parentWindow = mainWindow || BrowserWindow.getFocusedWindow() || undefined;
      const result = await dialog.showOpenDialog(parentWindow as any, {
        title: 'Klonlama Hedef Klasörünü Seçin',
        defaultPath: settingsStore.get().defaultOutputDir || getDynamicFolder('downloads'),
        properties: ['openDirectory', 'createDirectory'],
      });
      return result.canceled ? null : result.filePaths[0];
    } catch (error: any) {
      console.error('[IPC] Klasör Seçim Hatası:', error);
      throw error;
    }
  });

  // 7. SHELL_OPEN_FOLDER: Klasörü Windows Explorer'da açar
  ipcMain.handle(IpcChannel.SHELL_OPEN_FOLDER, async (_event, folderPath: string) => {
    try {
      if (fs.existsSync(folderPath)) {
        await shell.openPath(folderPath);
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('[IPC] Klasör Açma Hatası:', error);
      throw error;
    }
  });

  // 7.1 SHELL_OPEN_FILE: Dosyayı varsayılan uygulamada açar
  ipcMain.handle(IpcChannel.SHELL_OPEN_FILE, async (_event, filePath: string) => {
    try {
      const normalizedPath = path.normalize(filePath.trim());
      if (fs.existsSync(normalizedPath)) {
        await shell.openPath(normalizedPath);
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('[IPC] Dosya Açma Hatası:', error);
      throw error;
    }
  });

  // 8. DIALOG_ESTIMATE: Boyut tahmini ve disk kontrolü
  ipcMain.handle(IpcChannel.DIALOG_ESTIMATE, async (_event, { url, depth }: { url: string; depth: number }) => {
    try {
      let isSameHost = false;
      try {
        isSameHost = Boolean(lastAnalyzeResult?.siteMap?.url && new URL(lastAnalyzeResult.siteMap.url).hostname === new URL(url).hostname);
      } catch {}

      const estimate = await sizeEstimator.estimate(url, depth, isSameHost ? lastAnalyzeResult : null);
      let freeSpaceBytes = 100 * 1024 * 1024 * 1024; // 100 GB fallback
      
      try {
        const targetPath = settingsStore.get().defaultOutputDir || (process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'WebCloneStudio') : os.homedir());
        if (fs.existsSync(targetPath) && (fs.promises as any).statfs) {
          const stat = await (fs.promises as any).statfs(targetPath);
          freeSpaceBytes = stat.bavail * stat.bsize;
        }
      } catch {}

      return {
        ...estimate,
        freeSpaceBytes,
        hasSufficientDisk: freeSpaceBytes > estimate.estimatedSizeBytes * 2,
      };
    } catch (error) {
      const fallbackPages = depth === 1 ? 5 : depth === 2 ? 18 : 45;
      const fallbackAssets = fallbackPages * 18;
      const fallbackBytes = fallbackPages * 25000 + fallbackAssets * 110 * 1024;
      return { 
        estimatedPages: fallbackPages, 
        estimatedAssets: fallbackAssets, 
        estimatedSizeBytes: fallbackBytes,
        freeSpaceBytes: 50 * 1024 * 1024 * 1024,
        hasSufficientDisk: true,
      };
    }
  });

  // 9. PROJECTS_LIST / DELETE / OPEN
  ipcMain.handle(IpcChannel.PROJECTS_LIST, async () => {
    return await projectStore.listProjects();
  });

  ipcMain.handle(IpcChannel.PROJECTS_DELETE, async (_event, projectPath: string) => {
    return await projectStore.deleteProject(projectPath);
  });

  ipcMain.handle(IpcChannel.PROJECTS_OPEN, async (_event, projectPath: string) => {
    return await projectStore.openProject(projectPath);
  });

  // 10. SETTINGS_GET / SETTINGS_SET
  ipcMain.handle(IpcChannel.SETTINGS_GET, async () => {
    return settingsStore.get();
  });

  ipcMain.handle(IpcChannel.SETTINGS_SET, async (_event, newSettings: any) => {
    return settingsStore.set(newSettings);
  });

  // 11. EXPORT_SYSTEM_MAP: Analiz sonucunu ultra detaylı Markdown şartnamesine dönüştürür
  ipcMain.handle(IpcChannel.EXPORT_SYSTEM_MAP, async (_event, customResult?: AnalyzeResult) => {
    const targetResult = customResult || lastAnalyzeResult;
    if (!targetResult) {
      throw new Error('Henüz analiz edilmiş bir web sitesi verisi bulunmuyor.');
    }
    return SystemMapGenerator.generate(targetResult);
  });

  // 12. DIALOG_SAVE_FILE: Sistem haritasını kullanıcı bilgisayarına .md olarak kaydeder
  ipcMain.handle(IpcChannel.DIALOG_SAVE_FILE, async (_event, { content, defaultName }: { content: string; defaultName?: string }) => {
    try {
      const parentWindow = mainWindow || BrowserWindow.getFocusedWindow() || undefined;
      const result = await dialog.showSaveDialog(parentWindow as any, {
        title: 'Sistem Haritasını (.md) Kaydet',
        defaultPath: defaultName || 'SYSTEM_MAP.md',
        filters: [{ name: 'Markdown Dosyası (*.md)', extensions: ['md'] }],
      });

      if (!result.canceled && result.filePath) {
        fs.writeFileSync(result.filePath, content, 'utf-8');
        return { success: true, filePath: result.filePath };
      }
      return { success: false, canceled: true };
    } catch (error: any) {
      console.error('[IPC] Dosya Kaydetme Hatası:', error);
      throw error;
    }
  });

  // 13. SERVER_START_PREVIEW: Klonlanan siteyi 127.0.0.1 üzerinde yerel sunucuda yayına alır ve tarayıcıda açar
  ipcMain.handle(IpcChannel.SERVER_START_PREVIEW, async (_event, targetPath: string) => {
    try {
      let folderToServe = targetPath.trim();
      if (fs.existsSync(folderToServe) && fs.statSync(folderToServe).isFile()) {
        folderToServe = path.dirname(folderToServe);
      }
      const siteSubdir = path.join(folderToServe, 'site');
      if (fs.existsSync(siteSubdir) && fs.statSync(siteSubdir).isDirectory()) {
        folderToServe = siteSubdir;
      }

      const serverUrl = await PreviewServer.getInstance().start(folderToServe);
      await shell.openExternal(serverUrl);
      return { success: true, url: serverUrl };
    } catch (error: any) {
      console.error('[IPC] Önizleme Sunucusu Hatası:', error);
      try {
        const indexFile = path.join(targetPath, 'site', 'index.html');
        if (fs.existsSync(indexFile)) {
          await shell.openPath(indexFile);
        } else {
          await shell.openPath(targetPath);
        }
      } catch {}
      return { success: false, error: error.message };
    }
  });

  // 14. SERVER_STOP_PREVIEW: Önizleme sunucusunu durdurur
  ipcMain.handle(IpcChannel.SERVER_STOP_PREVIEW, async () => {
    await PreviewServer.getInstance().stop();
    return { success: true };
  });
}
