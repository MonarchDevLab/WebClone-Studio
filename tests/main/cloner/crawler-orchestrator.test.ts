import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CrawlerOrchestrator } from '../../../src/main/cloner/crawler-orchestrator';
import { CrawlCheckpointDb } from '../../../src/main/storage/crawl-checkpoint-db';
import { clampCloneSettings } from '../../../src/shared/validators';

describe('CrawlerOrchestrator Cancellation, Resume & Incremental Diff', () => {
  let server: http.Server;
  let baseUrl: string;
  let tempDir: string;
  let etagVersion = '"v1"';
  let pageBody = '<html><head><title>v1</title></head><body><h1>Version 1</h1><a href="/sub">Sub</a></body></html>';

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'wc-orch-'));
    etagVersion = '"v1"';
    pageBody = '<html><head><title>v1</title></head><body><h1>Version 1</h1><a href="/sub">Sub</a></body></html>';

    server = http.createServer((req, res) => {
      if (req.url === '/' || req.url === '/index.html') {
        if (req.headers['if-none-match'] === etagVersion) {
          res.writeHead(304, { ETag: etagVersion });
          res.end();
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ETag: etagVersion });
        res.end(pageBody);
        return;
      }
      if (req.url === '/sub') {
        setTimeout(() => {
          if (req.headers['if-none-match'] === '"sub-v1"') {
            res.writeHead(304, { ETag: '"sub-v1"' });
            res.end();
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ETag: '"sub-v1"' });
          res.end('<html><body><p>Subpage content for clone verification test</p></body></html>');
        }, 40);
        return;
      }
      res.writeHead(404);
      res.end('Not found');
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it('cancels cleanly without running CloneFinalizer or emitting complete', async () => {
    const settings = clampCloneSettings({ mode: 'static', maxDepth: 2, reverseEngineering: false });
    const orch = new CrawlerOrchestrator(baseUrl, settings, tempDir, 'cancel_test', [], undefined, undefined, {
      allowLocalhostTargets: true,
    });

    let completed = false;
    let cancelled = false;
    orch.on('complete', () => {
      completed = true;
    });
    orch.on('cancelled', () => {
      cancelled = true;
    });

    await orch.start();
    await new Promise((r) => setTimeout(r, 15));
    orch.cancel();

    await new Promise((r) => setTimeout(r, 250));
    expect(completed).toBe(false);
    expect(cancelled).toBe(true);
    expect(fs.existsSync(path.join(orch.getProjectDir(), 'manifest.json'))).toBe(false);
  });

  it('completes crawl, writes SQLite checkpoint, and computes ETag 304 vs MODIFIED incremental diff', async () => {
    const settings = clampCloneSettings({ mode: 'static', maxDepth: 2, reverseEngineering: false, rateLimit: 0 });
    const orch = new CrawlerOrchestrator(baseUrl, settings, tempDir, 'diff_test', [], undefined, undefined, {
      allowLocalhostTargets: true,
    });

    const completePromise = new Promise<any>((resolve, reject) => {
      orch.on('complete', resolve);
      orch.on('error', (err) => reject(new Error(err.message)));
    });

    await orch.start();
    const result = await completePromise;
    expect(result.totalFiles).toBeGreaterThanOrEqual(2);
    expect(CrawlCheckpointDb.hasIncompleteCheckpoint(result.outputPath)).toBe(false);

    // 1. Unchanged diff (304 Not Modified for both root and /sub)
    const unchangedDiff = await CrawlerOrchestrator.runIncrementalDiff(result.outputPath, {
      allowLocalhostTargets: true,
    });
    expect(unchangedDiff.unchanged).toBeGreaterThanOrEqual(2);
    expect(unchangedDiff.modified).toBe(0);

    // 2. Mutate root HTML & ETag on live server and re-run incremental diff
    etagVersion = '"v2"';
    pageBody = '<html><head><title>v2</title></head><body><h1>Version 2 Updated!</h1><a href="/sub">Sub</a></body></html>';

    const updatedDiff = await CrawlerOrchestrator.runIncrementalDiff(result.outputPath, {
      allowLocalhostTargets: true,
    });
    expect(updatedDiff.modified).toBe(1);
    expect(fs.existsSync(path.join(result.outputPath, '_meta', 'diff-report.json'))).toBe(true);
  });
});
