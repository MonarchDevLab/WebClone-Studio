import * as cheerio from 'cheerio';
import { IpcChannel } from '../../shared/ipc-channels';
import { AnalyzeResult, SiteMapNode, SiteMeta } from '../../shared/types';
import { buildDefaultUserAgent } from '../../shared/version';
import { HttpClient } from '../browser/http-client';
import { handleSecure } from '../security/ipc-guard';
import { assertSafeRemoteUrl } from '../security/url-guard';
import { IpcRuntimeContext, normalizeUrlKey } from './context';

export function registerAnalyzeIpc(ctx: IpcRuntimeContext): void {
  handleSecure<string, AnalyzeResult>(IpcChannel.ANALYZE_START, async (_event, rawUrl) => {
    const allowLocalhostTargets = Boolean(ctx.settingsStore.get().allowLocalhostTargets);
    const parsedUrl = await assertSafeRemoteUrl(rawUrl, { allowLocalhostTargets });
    const url = parsedUrl.href;

    let htmlBody = '';
    let globals: string[] = [];
    let renderedDesignTokens: any = null;
    let rawHeaders: Record<string, string> = {};
    ctx.lastAnalyzeScreenshot = null;

    try {
      const renderResult = await ctx.pageRenderer.render(url, {
        timeoutMs: 18_000,
        allowLocalhostTargets,
      });
      htmlBody = renderResult.html;
      globals = renderResult.globals;
      renderedDesignTokens = renderResult.designTokens;
      rawHeaders = renderResult.responseHeaders || {};
      ctx.lastAnalyzeScreenshot =
        renderResult.screenshot && renderResult.screenshot.length > 0
          ? renderResult.screenshot
          : null;
    } catch (renderError) {
      console.warn(`[IPC] Offscreen render uyarısı (${url}), HttpClient fallback devrede:`, renderError);
      try {
        const res = await HttpClient.fetchText({
          url,
          timeoutMs: 8000,
          maxRetries: 0,
          headers: { 'user-agent': buildDefaultUserAgent() },
          allowLocalhostTargets,
        });
        htmlBody = res.text;
        rawHeaders = res.headers;
      } catch (httpFallbackErr) {
        console.warn('[IPC] Statik HTTP fallback başarısız:', httpFallbackErr);
      }
    }

    const $ = cheerio.load(htmlBody || '');
    const meta: SiteMeta = {
      title:
        $('title').text().trim() ||
        $('meta[property="og:title"]').attr('content') ||
        parsedUrl.hostname,
      description:
        $('meta[name="description"]').attr('content') ||
        $('meta[property="og:description"]').attr('content') ||
        '',
      ogImage: $('meta[property="og:image"]').attr('content'),
      canonical: $('link[rel="canonical"]').attr('href'),
      language: $('html').attr('lang') || 'tr',
      encoding: $('meta[charset]').attr('charset') || 'UTF-8',
      viewport: $('meta[name="viewport"]').attr('content'),
      favicon: $('link[rel*="icon"]').attr('href'),
    };

    const technologies = await ctx.techDetector.analyze(url, {
      html: htmlBody,
      headers: rawHeaders,
      globals,
      allowLocalhostTargets,
    });

    const designTokens = await ctx.designAnalyzer.analyze(url, renderedDesignTokens);

    const security = await ctx.securityScanner.scan(url, {
      existingHeaders: rawHeaders,
      allowLocalhostTargets,
    });

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
      sitemap = await ctx.siteMapper.map(url, 3, 500);
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

    ctx.lastAnalyzeResult = result;
    ctx.analyzeCache.set(normalizeUrlKey(url), {
      result,
      screenshot: ctx.lastAnalyzeScreenshot || undefined,
    });

    return result;
  });
}
