import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CrawlerOrchestrator } from '../../src/main/cloner/crawler-orchestrator';
import { PreviewServer } from '../../src/main/server/preview-server';
import { CrawlCheckpointDb } from '../../src/main/storage/crawl-checkpoint-db';
import { clampCloneSettings } from '../../src/shared/validators';
import { MockTargetServerController, startMockTargetServer } from '../fixtures/mock-target-server';

describe('Full End-to-End Clone Pipeline Integration (Local Fixture + SQLite WAL + WACZ + PreviewServer)', () => {
  let fixture: MockTargetServerController;
  let tempOutputDir: string;

  beforeEach(async () => {
    fixture = await startMockTargetServer();
    tempOutputDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'wc-e2e-int-'));
  });

  afterEach(async () => {
    await PreviewServer.getInstance().stop();
    await fixture.close();
    await fs.promises.rm(tempOutputDir, { recursive: true, force: true });
  });

  it('clones fixture end-to-end, blocks SSRF 302 redirect, separates query images, recovers source map, exports WACZ, serves SW+Range, and diffs ETag', async () => {
    const settings = clampCloneSettings({
      mode: 'static',
      maxDepth: 2,
      concurrentDownloads: 3,
      rateLimit: 0,
      respectRobotsTxt: false,
      downloadImages: true,
      downloadMedia: true,
      downloadFonts: true,
      downloadData: true,
      downloadExternalAssets: false,
      reverseEngineering: true,
      exportWacz: true,
    });

    const orchestrator = new CrawlerOrchestrator(
      fixture.baseUrl,
      settings,
      tempOutputDir,
      'fixture_integration',
      [],
      undefined,
      undefined,
      { allowLocalhostTargets: true }
    );

    const capturedErrors: Array<{ url: string; message: string; code: string }> = [];
    const completePromise = new Promise<any>((resolve) => {
      orchestrator.on('complete', resolve);
      orchestrator.on('error', (err) => {
        capturedErrors.push(err);
      });
    });

    await orchestrator.start();
    const result = await completePromise;
    const projectDir = result.outputPath;
    const siteDir = path.join(projectDir, 'site');

    expect(result.totalFiles).toBeGreaterThanOrEqual(6);
    expect(CrawlCheckpointDb.hasIncompleteCheckpoint(projectDir)).toBe(false);

    // 1. SSRF protection: /redirect-ssrf to 169.254.169.254 must be blocked with ERR_SSRF_BLOCKED and NOT saved offline
    expect(capturedErrors.some((e) => e.message.includes('ERR_SSRF_BLOCKED'))).toBe(true);
    expect(fs.existsSync(path.join(siteDir, 'redirect-ssrf.html'))).toBe(false);

    // 2. CSS Color 4 & Tailwind v4 @theme + RSC Flight state + TSX Component export
    const themeCss = await fs.promises.readFile(path.join(projectDir, '_meta', 'tokens.theme.css'), 'utf-8');
    expect(themeCss).toContain('@theme {');
    expect(themeCss).toContain('oklch(0.65 0.18 220)');
    expect(themeCss).toContain('color(display-p3 0.1 0.8 0.9)');

    const extractedState = JSON.parse(
      await fs.promises.readFile(path.join(projectDir, '_meta', 'extracted-state.json'), 'utf-8')
    );
    const rootState = Object.values(extractedState)[0] as Record<string, any>;
    expect(Array.isArray(rootState.nextRscPayloads)).toBe(true);
    expect(rootState.nextRscPayloads.length).toBeGreaterThanOrEqual(1);

    const tsxFiles = await fs.promises.readdir(path.join(projectDir, '_components'));
    expect(tsxFiles.length).toBeGreaterThanOrEqual(1);
    const tsxContent = await fs.promises.readFile(path.join(projectDir, '_components', tsxFiles[0]), 'utf-8');
    expect(tsxContent).toContain('<header>');
    expect(tsxContent).toContain('<main>');
    expect(tsxContent).toContain('<footer>');
    expect(tsxContent).toContain('data:image/svg+xml;base64,PHN2Zy8+');

    // 3. Async SourceMap reconstruction with _up_/ mapping
    expect(
      fs.existsSync(path.join(siteDir, '_source-code', '_up_', 'src', 'components', 'PricingCard.tsx'))
    ).toBe(true);

    // 4. WACZ 1.1.1 export present inside _exports/
    const exportFiles = await fs.promises.readdir(path.join(projectDir, '_exports'));
    expect(exportFiles.some((f) => f.endsWith('.wacz'))).toBe(true);

    // 5. Distinct query-variant image extensions & PreviewServer replay (/ _sw-replay.js + query + 206 Range)
    const previewUrl = await PreviewServer.getInstance().start(siteDir);

    const indexRes = await fetch(previewUrl);
    expect(indexRes.status).toBe(200);
    const indexHtml = await indexRes.text();
    expect(indexHtml).toContain('/_sw-replay.js');
    expect(indexHtml).toContain('navigator.serviceWorker.register');

    const swRes = await fetch(`${previewUrl}_sw-replay.js`);
    expect(swRes.status).toBe(200);
    expect(swRes.headers.get('service-worker-allowed')).toBe('/');

    const heroRes = await fetch(`${previewUrl}_next/image?w=640&url=%2Fhero.png`);
    expect(heroRes.status).toBe(200);
    expect(heroRes.headers.get('content-type')).toBe('image/webp');
    expect(await heroRes.text()).toContain('HERO_IMAGE_DATA');

    const cardRes = await fetch(`${previewUrl}_next/image?url=%2Fcard.png&w=640`);
    expect(cardRes.status).toBe(200);
    expect(cardRes.headers.get('content-type')).toBe('image/png');

    const rangeRes = await fetch(`${previewUrl}assets/media/${
      (await fs.promises.readdir(path.join(siteDir, 'assets', 'media'))).find((f) => f.includes('sample'))
    }`, {
      headers: { Range: 'bytes=0-9' },
    });
    expect(rangeRes.status).toBe(206);
    expect(await rangeRes.text()).toBe('0123456789');

    // 6. ETag 304 vs MODIFIED incremental diff
    fixture.setPricingVersion('v2');
    const diff = await CrawlerOrchestrator.runIncrementalDiff(projectDir, {
      allowLocalhostTargets: true,
    });
    expect(diff.modified).toBe(1);
    expect(diff.items.some((item) => item.url.endsWith('/pricing') && item.changeType === 'MODIFIED')).toBe(
      true
    );
    expect(diff.unchanged).toBeGreaterThanOrEqual(1);
  }, 25_000);
});
