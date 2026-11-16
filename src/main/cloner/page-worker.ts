import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import Bottleneck from 'bottleneck';
import { CloneSettings } from '../../shared/types';
import { decodeTextBuffer } from '../browser/http-client';
import { PageRenderer, PageRenderResult } from '../browser/page-renderer';
import { AssetDownloader } from './asset-downloader';
import { FileOrganizer } from './file-organizer';
import { DiscoveredAsset, PageProcessor, isInternalDomain } from './page-processor';
import { reconstructSourceTree } from './reverse-engineering/sourcemap-reconstructor';
import { extractFrameworkState } from './reverse-engineering/framework-extractor';
import { AdaptiveExtractor } from '../analyzers/adaptive-extractor';
import { ApiTrafficInterceptor } from './reverse-engineering/api-interceptor';
import { CrawlCheckpointDb } from '../storage/crawl-checkpoint-db';

export interface QueueTaskItem {
  url: string;
  depth: number;
  type: DiscoveredAsset['type'];
  isPage: boolean;
}

export function isSpaShell(html: string): boolean {
  if (!html) return true;
  const hasSpaMount =
    /id=["'](?:root|app|__next|__nuxt)["']\s*>\s*<\//i.test(html) ||
    /<app-root\b[^>]*>\s*<\/app-root>/i.test(html);
  const hasNoScriptWarning =
    /enable JavaScript/i.test(html) || /JavaScript is required/i.test(html);
  const bodyText = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (hasSpaMount || hasNoScriptWarning) && bodyText.length < 350;
}

export function isWafChallenge(
  statusCode: number,
  html: string = '',
  headers?: Record<string, string>
): boolean {
  if (statusCode !== 403 && statusCode !== 503 && statusCode !== 429) {
    return false;
  }

  if (headers) {
    const cfMitigated = headers['cf-mitigated'] || headers['CF-Mitigated'];
    if (cfMitigated && cfMitigated.toLowerCase() === 'challenge') {
      return true;
    }
  }

  const lowerHtml = (html || '').toLowerCase();
  const wafSignatures = [
    'just a moment...',
    'attention required! | cloudflare',
    'checking your browser before accessing',
    'cf-turnstile',
    'cf-browser-verification',
    'challenge-running',
    'datadome',
    'captcha-delivery.com',
    'please wait while we verify your browser',
    'enable javascript and cookies to continue',
  ];

  for (const sig of wafSignatures) {
    if (lowerHtml.includes(sig)) {
      return true;
    }
  }

  if (lowerHtml.includes('ray id:') && (statusCode === 403 || statusCode === 503)) {
    return true;
  }

  return false;
}

export interface CrawlSharedContext {
  runId: string;
  settings: CloneSettings;
  allowLocalhostTargets: boolean;
  organizer: FileOrganizer;
  downloader: AssetDownloader;
  pageRenderer: PageRenderer;
  dynamicLimiter: Bottleneck;
  checkpointDb: CrawlCheckpointDb;
  apiInterceptor: ApiTrafficInterceptor;
  visitedUrls: Set<string>;
  processedSourceMaps: Set<string>;
  urlToLocalPathMap: Map<string, string>;
  contentHashToLocalPath: Map<string, string>;
  pagesToRewrite: Array<{ url: string; localPath: string }>;
  failedUrlsList: Array<{ url: string; error: string; time: string }>;
  extractedStates: Record<string, any>;
  extractedAdaptiveData: Record<string, any>;
  getOrigin: () => string;
  updateRootOrigin: (newOrigin: string, finalUrl: string) => void;
  enqueueItems: (items: QueueTaskItem[]) => void;
  registerUrlMapping: (url: string, localPath: string, finalUrl?: string) => void;
  recordFileStats: (type: string, sizeBytes: number) => void;
  onScreenshot: (buf: Buffer) => void;
  onMhtml: (mhtml: string) => void;
  onLog: (level: 'info' | 'warn' | 'error' | 'debug', message: string, url?: string) => void;
  onFileAdded: (
    localPath: string,
    size: number,
    mimeType: string,
    httpStatus: number,
    depth: number
  ) => void;
  onError: (url: string, message: string, code: string) => void;
  incrementFailed: () => void;
  incrementPage: () => void;
  incrementAsset: () => void;
}

/**
 * Executes a single page or static asset fetch, WAF/SPA escalation, SHA-256 deduplication,
 * asset discovery, sourcemap recovery, and reverse-engineering extraction.
 */
export class PageWorker {
  private static applyRenderMetadata(rendered: PageRenderResult, ctx: CrawlSharedContext): void {
    if (rendered.screenshot && rendered.screenshot.length > 0) {
      ctx.onScreenshot(rendered.screenshot);
    }
    if (rendered.mhtmlSnapshot) {
      ctx.onMhtml(rendered.mhtmlSnapshot);
    }
    if (rendered.capturedEndpoints && rendered.capturedEndpoints.length > 0) {
      for (const ep of rendered.capturedEndpoints) {
        ctx.apiInterceptor.record(ep);
      }
    }
    if (rendered.cookies && rendered.cookies.length > 0) {
      ctx.downloader.setCookies(rendered.cookies);
    }
  }

  public static async processItem(
    item: QueueTaskItem,
    ctx: CrawlSharedContext,
    abortSignal: AbortSignal
  ): Promise<void> {
    if (abortSignal.aborted) return;

    const origin = ctx.getOrigin();
    const mapping = ctx.organizer.mapUrlToLocalPath(item.url, origin, item.type);

    if (item.isPage) {
      await this.processPage(item, mapping.absolutePath, origin, ctx, abortSignal);
    } else {
      await this.processAsset(item, mapping.absolutePath, origin, ctx, abortSignal);
    }
  }

  private static async processPage(
    item: QueueTaskItem,
    localPath: string,
    origin: string,
    ctx: CrawlSharedContext,
    abortSignal: AbortSignal
  ): Promise<void> {
    let htmlStr = '';
    let statusCode = 200;
    let sizeBytes = 0;
    let finalUrl = item.url;
    let etag: string | undefined;
    let lastModified: string | undefined;

    const renderOpts = {
      timeoutMs: 25_000,
      captureApi: Boolean(ctx.settings.reverseEngineering),
      captureMhtml: item.depth === 0,
      skipDesignTokens: item.depth > 0,
      skipScreenshot: item.depth > 0,
      allowLocalhostTargets: ctx.allowLocalhostTargets,
      ignoreSslErrors: ctx.settings.ignoreSslErrors,
    };

    if (ctx.settings.mode === 'dynamic') {
      try {
        const rendered = await ctx.dynamicLimiter.schedule(() =>
          ctx.pageRenderer.render(item.url, renderOpts)
        );
        htmlStr = rendered.html;
        sizeBytes = Buffer.byteLength(htmlStr, 'utf-8');
        this.applyRenderMetadata(rendered, ctx);
      } catch (renderErr: any) {
        if (abortSignal.aborted) return;
        ctx.onLog('warn', `Dinamik render uyarısı (${item.url}), statik moda geçiliyor: ${renderErr.message}`);
        const staticRes = await ctx.downloader.downloadToBuffer(item.url, ctx.settings.maxFileSize, abortSignal);
        if (!staticRes.buffer || staticRes.statusCode >= 400) {
          ctx.incrementFailed();
          const msg = `HTTP ${staticRes.statusCode}`;
          ctx.failedUrlsList.push({ url: item.url, error: msg, time: new Date().toISOString() });
          ctx.checkpointDb.markFailed(ctx.runId, item.url, msg);
          ctx.onError(item.url, msg, 'HTTP_ERROR');
          return;
        }
        htmlStr = decodeTextBuffer(staticRes.buffer, staticRes.mimeType).text;
        statusCode = staticRes.statusCode;
        sizeBytes = staticRes.sizeBytes;
        finalUrl = staticRes.finalUrl || item.url;
        etag = staticRes.etag;
        lastModified = staticRes.lastModified;
      }
    } else {
      const staticRes = await ctx.downloader.downloadToBuffer(item.url, ctx.settings.maxFileSize, abortSignal);
      const staticHtml = staticRes.buffer
        ? decodeTextBuffer(staticRes.buffer, staticRes.mimeType).text
        : '';
      etag = staticRes.etag;
      lastModified = staticRes.lastModified;

      let resolvedViaEscalation = false;
      if (isWafChallenge(staticRes.statusCode, staticHtml)) {
        ctx.onLog(
          'info',
          `WAF/güvenlik kalkanı tespit edildi (${item.url}), Chromium oturum render devrede...`
        );
        try {
          const rendered = await ctx.dynamicLimiter.schedule(() =>
            ctx.pageRenderer.render(item.url, { ...renderOpts, timeoutMs: 30_000 })
          );
          if (rendered.html && !isWafChallenge(200, rendered.html)) {
            htmlStr = rendered.html;
            statusCode = 200;
            sizeBytes = Buffer.byteLength(htmlStr, 'utf-8');
            this.applyRenderMetadata(rendered, ctx);
            resolvedViaEscalation = true;
          }
        } catch (wafErr: any) {
          ctx.onLog('warn', `WAF render tamamlanamadı: ${wafErr.message}`);
        }
      }

      if (!resolvedViaEscalation) {
        if (!staticRes.buffer || staticRes.statusCode >= 400) {
          ctx.incrementFailed();
          const errLabel =
            staticRes.statusCode === 404
              ? 'HTTP 404 (Hedef sitede mevcut değil / kırık sayfa)'
              : `HTTP ${staticRes.statusCode}`;
          ctx.failedUrlsList.push({ url: item.url, error: errLabel, time: new Date().toISOString() });
          ctx.checkpointDb.markFailed(ctx.runId, item.url, errLabel);
          ctx.onError(item.url, errLabel, 'HTTP_ERROR');
          return;
        }
        htmlStr = staticHtml;
        statusCode = staticRes.statusCode;
        sizeBytes = staticRes.sizeBytes;
        finalUrl = staticRes.finalUrl || item.url;
      }

      if (!abortSignal.aborted && isSpaShell(htmlStr)) {
        ctx.onLog('info', `SPA istemci iskeleti tespit edildi (${item.url}), dinamik render uygulanıyor...`);
        try {
          const rendered = await ctx.dynamicLimiter.schedule(() =>
            ctx.pageRenderer.render(item.url, renderOpts)
          );
          if (rendered.html && rendered.html.length > htmlStr.length) {
            htmlStr = rendered.html;
            sizeBytes = Buffer.byteLength(htmlStr, 'utf-8');
            this.applyRenderMetadata(rendered, ctx);
          }
        } catch (spaErr: any) {
          ctx.onLog('debug', `SPA render uyarısı: ${spaErr.message}`);
        }
      }
    }

    if (abortSignal.aborted) return;

    // Update shared origin across all workers if root URL redirected (e.g. apex -> www)
    let effectiveOrigin = origin;
    if (item.depth === 0 && finalUrl && finalUrl !== item.url) {
      try {
        const finalParsed = new URL(finalUrl);
        effectiveOrigin = finalParsed.origin;
        ctx.updateRootOrigin(effectiveOrigin, finalUrl);
      } catch {}
    }

    ctx.registerUrlMapping(item.url, localPath, finalUrl);

    const processed = PageProcessor.process(htmlStr, item.url, ctx.settings, effectiveOrigin);
    const nextQueueItems: QueueTaskItem[] = [];

    for (const asset of processed.discoveredAssets) {
      if (ctx.visitedUrls.has(asset.url)) continue;
      if (asset.isPage) {
        let allowPage =
          item.depth + 1 <= ctx.settings.maxDepth && isInternalDomain(asset.url, effectiveOrigin);
        if (allowPage && !ctx.settings.crawlSubdomains) {
          try {
            const targetHost = new URL(asset.url).hostname.toLowerCase().replace(/^www\./, '');
            const baseHost = new URL(effectiveOrigin).hostname.toLowerCase().replace(/^www\./, '');
            if (targetHost !== baseHost) allowPage = false;
          } catch {
            allowPage = false;
          }
        }
        if (allowPage) {
          nextQueueItems.push({ url: asset.url, depth: item.depth + 1, type: asset.type, isPage: true });
        }
      } else {
        nextQueueItems.push({ url: asset.url, depth: item.depth, type: asset.type, isPage: false });
      }
    }

    if (nextQueueItems.length > 0) {
      ctx.enqueueItems(nextQueueItems);
    }

    if (ctx.settings.reverseEngineering) {
      try {
        const state = extractFrameworkState(htmlStr);
        if (state && Object.keys(state).length > 0) {
          ctx.extractedStates[item.url] = state;
        }
      } catch {}
      try {
        const adaptiveRes = AdaptiveExtractor.extract(htmlStr, item.url);
        if (adaptiveRes.entities.length > 0 || adaptiveRes.paginationTrigger) {
          ctx.extractedAdaptiveData[item.url] = adaptiveRes;
        }
      } catch {}
    }

    const htmlBuf = Buffer.from(htmlStr, 'utf-8');
    const contentSha256 = crypto.createHash('sha256').update(htmlBuf).digest('hex');
    await ctx.organizer.writeAsset(localPath, htmlBuf);
    ctx.pagesToRewrite.push({ url: item.url, localPath });

    ctx.checkpointDb.markDone(ctx.runId, item.url, {
      localPath,
      httpStatus: statusCode,
      etag,
      lastModified,
      contentSha256,
      sizeBytes,
      mimeType: 'text/html',
      kind: 'PAGE',
    });

    ctx.recordFileStats('html', sizeBytes);
    ctx.incrementPage();
    ctx.onFileAdded(localPath, sizeBytes, 'text/html', statusCode, item.depth);
  }

  private static async processAsset(
    item: QueueTaskItem,
    targetPath: string,
    origin: string,
    ctx: CrawlSharedContext,
    abortSignal: AbortSignal
  ): Promise<void> {
    const downloadRes = await ctx.downloader.downloadToFile(
      item.url,
      targetPath,
      ctx.settings.maxFileSize,
      abortSignal
    );

    if (abortSignal.aborted) return;

    if (downloadRes.statusCode >= 400 || !downloadRes.localPath) {
      ctx.incrementFailed();
      const errLabel =
        downloadRes.statusCode === 404
          ? 'HTTP 404 (Hedef sitede mevcut değil / kırık dosya)'
          : `HTTP ${downloadRes.statusCode}`;
      ctx.failedUrlsList.push({ url: item.url, error: errLabel, time: new Date().toISOString() });
      ctx.checkpointDb.markFailed(ctx.runId, item.url, errLabel);
      ctx.onError(item.url, errLabel, 'HTTP_ERROR');
      return;
    }

    let finalLocalPath = downloadRes.localPath || targetPath;
    let contentSha256: string | undefined;

    if (downloadRes.sizeBytes > 0 && downloadRes.sizeBytes <= 15 * 1024 * 1024) {
      try {
        const buf = await fs.promises.readFile(finalLocalPath);
        contentSha256 = crypto.createHash('sha256').update(buf).digest('hex');
        if (item.type !== 'css' && item.type !== 'js') {
          const existingMem = ctx.contentHashToLocalPath.get(contentSha256);
          const existingDb = existingMem || ctx.checkpointDb.findAssetBySha256(contentSha256);
          if (existingDb && existingDb !== finalLocalPath && fs.existsSync(existingDb)) {
            await fs.promises.unlink(finalLocalPath).catch(() => {});
            finalLocalPath = existingDb;
          } else {
            ctx.contentHashToLocalPath.set(contentSha256, finalLocalPath);
          }
        }
      } catch {}
    }

    ctx.registerUrlMapping(item.url, finalLocalPath, downloadRes.finalUrl);

    if (item.type === 'css' || finalLocalPath.endsWith('.css')) {
      try {
        const cssContent = await fs.promises.readFile(finalLocalPath, 'utf-8');
        const cssAssets = PageProcessor.extractCssUrls(cssContent, item.url, ctx.settings, origin);
        if (cssAssets.length > 0) {
          ctx.enqueueItems(
            cssAssets
              .filter((a) => !ctx.visitedUrls.has(a.url))
              .map((a) => ({ url: a.url, depth: item.depth, type: a.type, isPage: false }))
          );
        }
      } catch {}
    }

    if (
      ctx.settings.reverseEngineering &&
      (item.type === 'js' || item.type === 'css' || finalLocalPath.endsWith('.js') || finalLocalPath.endsWith('.css'))
    ) {
      try {
        const fileContent = await fs.promises.readFile(finalLocalPath, 'utf-8');
        const hiddenAssets = PageProcessor.extractHiddenAssetsFromJs(fileContent, item.url);
        if (hiddenAssets.length > 0) {
          const toAdd = hiddenAssets.filter((a) => !ctx.visitedUrls.has(a.url));
          if (toAdd.length > 0) {
            ctx.enqueueItems(
              toAdd.map((a) => ({ url: a.url, depth: item.depth + 1, type: a.type, isPage: false }))
            );
          }
        }

        const mapUrl = PageProcessor.extractSourceMapUrl(fileContent, item.url);
        if (mapUrl && !ctx.processedSourceMaps.has(mapUrl)) {
          ctx.processedSourceMaps.add(mapUrl);
          const sourceCodeOutDir = path.join(ctx.organizer.getFolders().siteDir, '_source-code');
          if (mapUrl.startsWith('data:')) {
            const commaIdx = mapUrl.indexOf(',');
            if (commaIdx !== -1) {
              const mapJson = Buffer.from(mapUrl.slice(commaIdx + 1), 'base64').toString('utf-8');
              await reconstructSourceTree(mapJson, sourceCodeOutDir);
            }
          } else {
            const mapRes = await ctx.downloader.downloadToBuffer(mapUrl, ctx.settings.maxFileSize, abortSignal);
            if (mapRes.buffer && mapRes.statusCode < 400) {
              await reconstructSourceTree(mapRes.buffer.toString('utf-8'), sourceCodeOutDir);
            }
          }
        }
      } catch {}
    }

    ctx.checkpointDb.markDone(ctx.runId, item.url, {
      localPath: finalLocalPath,
      httpStatus: downloadRes.statusCode,
      etag: downloadRes.etag,
      lastModified: downloadRes.lastModified,
      contentSha256,
      sizeBytes: downloadRes.sizeBytes,
      mimeType: downloadRes.mimeType,
      kind: 'ASSET',
    });

    const fileTypeKey =
      item.type === 'image'
        ? 'images'
        : item.type === 'document'
        ? 'documents'
        : item.type === 'archive'
        ? 'archives'
        : item.type === 'data'
        ? 'data'
        : item.type;
    ctx.recordFileStats(fileTypeKey, downloadRes.sizeBytes);
    ctx.incrementAsset();
    ctx.onFileAdded(finalLocalPath, downloadRes.sizeBytes, downloadRes.mimeType, downloadRes.statusCode, item.depth);
  }
}
