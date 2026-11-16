import fs from 'node:fs';
import path from 'node:path';
import {
  AnalyzeResult,
  CloneCompleteEvent,
  CloneSettings,
  TechSignature,
} from '../../shared/types';
import { FileOrganizer } from './file-organizer';
import { UrlRewriter } from './url-rewriter';
import { ApiTrafficInterceptor } from './reverse-engineering/api-interceptor';
import { extractDesignTokensFromCss } from './reverse-engineering/token-extractor';
import { ReportGenerator } from '../output/report-generator';
import { SystemMapGenerator } from '../generators/system-map-generator';
import { ApiContractGenerator } from '../generators/api-contract-generator';
import { ComponentExporter } from '../generators/component-exporter';
import { SingleFileExporter } from '../generators/singlefile-exporter';
import { WaczExporter } from '../generators/wacz-exporter';
import { ManifestGenerator } from '../output/manifest-generator';
import { ReadmeGenerator } from '../output/readme-generator';

export interface FinalizeInput {
  targetUrl: string;
  projectName: string;
  settings: CloneSettings;
  technologies: TechSignature[];
  analyzeResult?: AnalyzeResult;
  organizer: FileOrganizer;
  pagesToRewrite: Array<{ url: string; localPath: string }>;
  urlToLocalPathMap: Map<string, string>;
  failedUrlsList: Array<{ url: string; error: string; time: string }>;
  extractedStates: Record<string, any>;
  extractedAdaptiveData: Record<string, any>;
  apiInterceptor: ApiTrafficInterceptor;
  screenshotBuffer: Buffer | null;
  mhtmlSnapshot: string | null;
  stats: {
    totalPages: number;
    totalAssets: number;
    totalFiles: number;
    totalSizeBytes: number;
    failedUrls: number;
    startTime: number;
  };
  fileCounts: {
    html: { count: number; sizeBytes: number };
    css: { count: number; sizeBytes: number };
    js: { count: number; sizeBytes: number };
    images: { count: number; sizeBytes: number };
    fonts: { count: number; sizeBytes: number };
    media: { count: number; sizeBytes: number };
    documents: { count: number; sizeBytes: number };
    archives: { count: number; sizeBytes: number };
    data: { count: number; sizeBytes: number };
    other: { count: number; sizeBytes: number };
  };
  onLog: (level: 'info' | 'warn' | 'error' | 'debug', message: string) => void;
}

function escapeHtml(raw: string): string {
  return (raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Finalizes a completed clone run: rewrites HTML/CSS links for offline viewing, writes _meta reports,
 * reverse-engineering artifacts (OpenAPI, TSX components, design tokens), standalone SingleFile/MHTML exports,
 * manifest.json, and README.md.
 */
export class CloneFinalizer {
  public static async finalize(input: FinalizeInput): Promise<CloneCompleteEvent> {
    const folders = input.organizer.getFolders();
    const siteRoot = folders.siteDir;
    const mockApiDb = input.settings.reverseEngineering
      ? input.apiInterceptor.exportMockDatabase()
      : undefined;

    input.onLog('info', 'URL yeniden yazım ve tersine mühendislik çıktıları hazırlanıyor...');

    // 1. Rewrite HTML pages
    for (const page of input.pagesToRewrite) {
      try {
        if (!fs.existsSync(page.localPath)) continue;
        const rawHtml = await fs.promises.readFile(page.localPath, 'utf-8');
        const rewrittenHtml = UrlRewriter.rewriteHtml(rawHtml, {
          currentPageUrl: page.url,
          currentLocalFilePath: page.localPath,
          siteRootPath: siteRoot,
          urlMap: input.urlToLocalPathMap,
          mockApiDb,
        });
        await input.organizer.writeAsset(page.localPath, Buffer.from(rewrittenHtml, 'utf-8'));
      } catch (err: any) {
        input.onLog('warn', `Sayfa rewrite hatası (${page.url}): ${err.message}`);
      }
    }

    // 2. Rewrite CSS files and collect stylesheets for design token extraction
    const rewrittenCssPaths = new Set<string>();
    const collectedCssList: string[] = [];
    for (const [assetUrl, localPath] of input.urlToLocalPathMap.entries()) {
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
              urlMap: input.urlToLocalPathMap,
            });
            await fs.promises.writeFile(localPath, rewrittenCss, 'utf-8');
          }
        } catch {}
      }
    }

    // Persist normalized path+query -> relative site path map for PreviewServer / Service Worker replay
    try {
      const swUrlMap: Record<string, string> = {};
      for (const [rawUrl, absLocal] of input.urlToLocalPathMap.entries()) {
        try {
          const parsed = new URL(rawUrl);
          const relFromSite = path.relative(siteRoot, absLocal).split(path.sep).join('/');
          if (!relFromSite.startsWith('..')) {
            swUrlMap[`${parsed.pathname}${parsed.search}`] = relFromSite;
          }
        } catch {}
      }
      await input.organizer.writeMetaFile('url-map.json', swUrlMap);
    } catch {}

    // 3. Screenshot thumbnail
    if (input.screenshotBuffer && input.screenshotBuffer.length > 0) {
      try {
        const thumbPath = path.join(folders.screenshotsDir, 'thumbnail.png');
        await fs.promises.writeFile(thumbPath, input.screenshotBuffer);
      } catch {}
    }

    // 4. Meta reports & offline 404 helper
    const domain = new URL(input.targetUrl).hostname;
    if (input.analyzeResult) {
      try {
        await input.organizer.writeMetaFile(
          'tech-report.html',
          ReportGenerator.generateHtmlReport(input.analyzeResult, domain)
        );
        await input.organizer.writeMetaFile('analyze.json', input.analyzeResult);
        await input.organizer.writeMetaFile(
          'SYSTEM_MAP.md',
          SystemMapGenerator.generate(input.analyzeResult)
        );
      } catch {}
    }

    if (input.failedUrlsList.length > 0) {
      try {
        const errorLogContent = input.failedUrlsList
          .map((item) => `[${item.time}] ${item.url} -> ${item.error}`)
          .join('\n');
        await input.organizer.writeMetaFile('errors.log', errorLogContent);

        const deadLinksList = input.failedUrlsList
          .filter((item) => item.error.includes('404'))
          .map((item) => `<li><code>${escapeHtml(item.url)}</code></li>`)
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
    .card { background: #13161C; border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; padding: 36px; max-width: 560px; text-align: center; }
    .badge { display: inline-block; background: rgba(244,63,94,0.15); color: #F43F5E; border: 1px solid rgba(244,63,94,0.3); padding: 4px 14px; border-radius: 9999px; font-size: 11px; font-family: monospace; font-weight: 700; margin-bottom: 16px; }
    h1 { color: #F1F5F9; font-size: 22px; margin: 0 0 12px 0; font-weight: 700; }
    p { color: #94A3B8; font-size: 13px; line-height: 1.6; margin: 0 0 18px 0; }
    .details { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 14px; text-align: left; max-height: 140px; overflow-y: auto; font-size: 11px; font-family: monospace; color: #CBD5E1; }
    .details ul { margin: 0; padding-left: 20px; }
    .details li { margin: 4px 0; word-break: break-all; }
    .btn { display: inline-block; margin-top: 24px; background: #06B6D4; color: #000; padding: 10px 22px; border-radius: 10px; font-size: 13px; font-weight: 700; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">ORİJİNAL SİTEDE HTTP 404</div>
    <h1>Bu Sayfa Orijinal Sunucuda Mevcut Değil</h1>
    <p>Klonlanan web sitesindeki bu bağlantı hedef sunucudan HTTP 404 yanıtı aldı.</p>
    <div class="details"><ul>${deadLinksList}</ul></div>
    <a href="./index.html" class="btn">Ana Sayfaya Geri Dön</a>
  </div>
</body>
</html>`;
          await fs.promises.writeFile(path.join(siteRoot, '_404.html'), offline404Html, 'utf-8');
        }
      } catch {}
    }

    // 5. Reverse engineering outputs
    if (input.settings.reverseEngineering && Object.keys(input.extractedStates).length > 0) {
      await input.organizer.writeMetaFile('extracted-state.json', input.extractedStates).catch(() => {});
    }

    if (input.settings.reverseEngineering && collectedCssList.length > 0) {
      try {
        const { tokens, tailwindConfig, tailwindV4Theme } = extractDesignTokensFromCss(collectedCssList);
        await input.organizer.writeMetaFile('tailwind.config.js', tailwindConfig);
        await input.organizer.writeMetaFile('design-tokens.json', tokens);
        await input.organizer.writeMetaFile('tokens.theme.css', tailwindV4Theme);
      } catch {}
    }

    if (input.settings.reverseEngineering && mockApiDb && Object.keys(mockApiDb).length > 0) {
      try {
        await input.organizer.writeMetaFile('api-endpoints.json', mockApiDb);
        const endpoints = input.apiInterceptor.getEndpoints();
        if (endpoints.length > 0) {
          await input.organizer.writeMetaFile(
            'openapi.json',
            ApiContractGenerator.generateOpenApiSpec(endpoints, domain)
          );
          await input.organizer.writeMetaFile(
            'api-types.d.ts',
            ApiContractGenerator.generateTypeScriptDefinitions(endpoints)
          );
        }
      } catch {}
    }

    if (input.settings.reverseEngineering && Object.keys(input.extractedAdaptiveData).length > 0) {
      await input.organizer
        .writeMetaFile('adaptive-entities.json', input.extractedAdaptiveData)
        .catch(() => {});
    }

    if (input.settings.reverseEngineering) {
      try {
        const componentsDir = path.join(folders.projectDir, '_components');
        await fs.promises.mkdir(componentsDir, { recursive: true });
        let pageIdx = 1;
        for (const page of input.pagesToRewrite) {
          if (page.localPath.endsWith('index.html') && fs.existsSync(page.localPath)) {
            const pageHtml = await fs.promises.readFile(page.localPath, 'utf-8');
            const compName = `PageSection${String(pageIdx++).padStart(2, '0')}`;
            const tsx = ComponentExporter.generateReactComponent(pageHtml, compName);
            await fs.promises.writeFile(path.join(componentsDir, `${compName}.tsx`), tsx, 'utf-8');
          }
        }
      } catch {}
    }

    // 6. Standalone exports (_exports/index.standalone.html + index.mhtml)
    try {
      const exportsDir = path.join(folders.projectDir, '_exports');
      await fs.promises.mkdir(exportsDir, { recursive: true });

      const indexPage =
        input.pagesToRewrite.find((p) => p.localPath.endsWith('index.html')) || input.pagesToRewrite[0];
      if (indexPage && fs.existsSync(indexPage.localPath)) {
        const indexHtml = await fs.promises.readFile(indexPage.localPath, 'utf-8');
        const standaloneHtml = await SingleFileExporter.export(indexHtml, siteRoot);
        await fs.promises.writeFile(
          path.join(exportsDir, 'index.standalone.html'),
          standaloneHtml,
          'utf-8'
        );
      }

      if (input.mhtmlSnapshot) {
        await fs.promises.writeFile(
          path.join(exportsDir, 'index.mhtml'),
          input.mhtmlSnapshot,
          'utf-8'
        );
      }

      if (input.settings.exportWacz) {
        await WaczExporter.exportProject(folders.projectDir);
      }
    } catch {}

    // 7. Manifest + README
    const durationSeconds = Math.max(1, Math.round((Date.now() - input.stats.startTime) / 1000));
    const manifest = ManifestGenerator.generate({
      projectName: input.projectName,
      targetUrl: input.targetUrl,
      settings: input.settings,
      technologies: input.technologies,
      stats: {
        totalPages: input.stats.totalPages,
        totalAssets: input.stats.totalAssets,
        totalFiles: input.stats.totalFiles,
        totalSizeBytes: input.stats.totalSizeBytes,
        failedUrls: input.stats.failedUrls,
        durationSeconds,
      },
      fileCounts: input.fileCounts,
      entryPoint: 'site/index.html',
      screenshotPath:
        input.screenshotBuffer && input.screenshotBuffer.length > 0
          ? '_screenshots/thumbnail.png'
          : undefined,
    });

    const projectDir = folders.projectDir;
    const manifestPath = path.join(projectDir, 'manifest.json');
    const readmePath = path.join(projectDir, 'README.md');

    await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    await fs.promises.writeFile(readmePath, ReadmeGenerator.generate(manifest), 'utf-8');

    input.onLog('info', `Klonlama başarıyla tamamlandı. Proje dizini: ${projectDir}`);

    return {
      totalFiles: input.stats.totalFiles,
      totalSize: input.stats.totalSizeBytes,
      duration: durationSeconds,
      outputPath: projectDir,
      manifestPath,
    };
  }
}
