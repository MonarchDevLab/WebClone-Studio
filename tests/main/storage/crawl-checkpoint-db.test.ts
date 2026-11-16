import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CrawlCheckpointDb } from '../../../src/main/storage/crawl-checkpoint-db';

describe('CrawlCheckpointDb (node:sqlite WAL)', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'wc-sqlite-cp-'));
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it('recovers IN_FLIGHT rows back to PENDING after simulated crash and deduplicates SHA-256 assets', () => {
    // Session 1: start crawl, enqueue 3 items, claim 2, finish 1, leave 1 IN_FLIGHT and simulate abrupt close
    const db1 = new CrawlCheckpointDb(tempDir);
    const runId = 'run_1';
    const startRes = db1.createOrResumeRun(runId, 'https://example.com', JSON.stringify({ maxDepth: 2 }));
    expect(startRes.resumed).toBe(false);

    db1.enqueueBatch(runId, [
      { normalizedUrl: 'https://example.com/', rawUrl: 'https://example.com/', depth: 0, kind: 'PAGE' },
      { normalizedUrl: 'https://example.com/about', rawUrl: 'https://example.com/about', depth: 1, kind: 'PAGE' },
      { normalizedUrl: 'https://example.com/app.css', rawUrl: 'https://example.com/app.css', depth: 0, kind: 'ASSET' },
    ]);

    const claimed = db1.claimPendingBatch(runId, 2);
    expect(claimed.length).toBe(2);

    db1.markDone(runId, claimed[0].normalized_url, {
      localPath: path.join(tempDir, 'site', 'index.html'),
      httpStatus: 200,
      etag: '"v1"',
      contentSha256: 'abc123sha',
      sizeBytes: 1024,
      mimeType: 'text/html',
      kind: 'PAGE',
    });

    // Leave claimed[1] as IN_FLIGHT and close DB abruptly (crash simulation)
    db1.close();

    expect(CrawlCheckpointDb.hasIncompleteCheckpoint(tempDir)).toBe(true);

    // Session 2: reopen DB and recover
    const db2 = new CrawlCheckpointDb(tempDir);
    const resumed = db2.createOrResumeRun('run_unused', 'https://example.com', '{}');
    expect(resumed.resumed).toBe(true);
    expect(resumed.doneCount).toBe(1);
    expect(resumed.pendingCount).toBe(2); // Both remaining (/about recovered from IN_FLIGHT + app.css)

    expect(db2.findAssetBySha256('abc123sha')).toBe(path.join(tempDir, 'site', 'index.html'));

    const diff = db2.recordDiffBatch(
      runId,
      tempDir,
      [
        { url: 'https://example.com/about', changeType: 'MODIFIED', oldSha256: 'old', newSha256: 'new' },
        { url: 'https://example.com/new', changeType: 'ADDED', oldSha256: null, newSha256: 'brandnew' },
      ],
      1
    );
    expect(diff.modified).toBe(1);
    expect(diff.added).toBe(1);
    expect(diff.unchanged).toBe(1);

    db2.setRunStatus(runId, 'COMPLETED');
    db2.close();
    expect(CrawlCheckpointDb.hasIncompleteCheckpoint(tempDir)).toBe(false);
  });
});
