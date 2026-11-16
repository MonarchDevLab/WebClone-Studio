import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { DiffChangeItem, DiffSummary } from '../../shared/types';

export type CrawlRunStatus =
  | 'RUNNING'
  | 'PAUSED'
  | 'INTERRUPTED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'FAILED';

export interface QueueRow {
  normalized_url: string;
  run_id: string;
  raw_url: string;
  depth: number;
  kind: 'PAGE' | 'ASSET';
  status: 'PENDING' | 'IN_FLIGHT' | 'DONE' | 'SKIPPED' | 'FAILED';
  retry_count: number;
  local_path: string | null;
  http_status: number | null;
  etag: string | null;
  last_modified: string | null;
  content_sha256: string | null;
  last_error: string | null;
}

export interface EnqueueCandidate {
  normalizedUrl: string;
  rawUrl: string;
  depth: number;
  kind: 'PAGE' | 'ASSET';
}

export interface RunSummaryRow {
  run_id: string;
  root_url: string;
  config_json: string;
  status: CrawlRunStatus;
  started_at: number;
  updated_at: number;
  pages_done: number;
  assets_done: number;
  total_bytes: number;
}

/**
 * Crash-safe WAL-mode SQLite checkpoint store backed by Node 24 built-in `node:sqlite`.
 * Persists crawl queues, SHA-256 deduplication index, conditional HTTP validators (ETag/Last-Modified),
 * captured API mocks, and incremental diff records with zero native C++ build dependencies.
 */
export class CrawlCheckpointDb {
  private db: DatabaseSync;
  private readonly dbPath: string;

  constructor(projectDir: string) {
    const metaDir = path.join(projectDir, '_meta');
    if (!fs.existsSync(metaDir)) {
      fs.mkdirSync(metaDir, { recursive: true });
    }
    this.dbPath = path.join(metaDir, 'crawl-state.sqlite');
    this.db = new DatabaseSync(this.dbPath);
    this.initializeSchema();
  }

  public static hasIncompleteCheckpoint(projectDir: string): boolean {
    const dbFile = path.join(projectDir, '_meta', 'crawl-state.sqlite');
    if (!fs.existsSync(dbFile)) return false;
    let db: DatabaseSync | null = null;
    try {
      db = new DatabaseSync(dbFile);
      const row = db
        .prepare(
          "SELECT status FROM crawl_runs ORDER BY updated_at DESC LIMIT 1"
        )
        .get() as { status?: string } | undefined;
      return Boolean(
        row?.status && ['RUNNING', 'PAUSED', 'INTERRUPTED'].includes(row.status)
      );
    } catch {
      return false;
    } finally {
      try {
        db?.close();
      } catch {}
    }
  }

  private initializeSchema(): void {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS crawl_runs (
        run_id TEXT PRIMARY KEY,
        root_url TEXT NOT NULL,
        config_json TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('RUNNING','PAUSED','INTERRUPTED','CANCELLED','COMPLETED','FAILED')),
        started_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        pages_done INTEGER NOT NULL DEFAULT 0,
        assets_done INTEGER NOT NULL DEFAULT 0,
        total_bytes INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS url_queue (
        normalized_url TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES crawl_runs(run_id) ON DELETE CASCADE,
        raw_url TEXT NOT NULL,
        depth INTEGER NOT NULL DEFAULT 0,
        kind TEXT NOT NULL CHECK(kind IN ('PAGE','ASSET')),
        status TEXT NOT NULL CHECK(status IN ('PENDING','IN_FLIGHT','DONE','SKIPPED','FAILED')),
        retry_count INTEGER NOT NULL DEFAULT 0,
        local_path TEXT,
        http_status INTEGER,
        etag TEXT,
        last_modified TEXT,
        content_sha256 TEXT,
        last_error TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_queue_claim ON url_queue(run_id, status, kind, depth);

      CREATE TABLE IF NOT EXISTS assets (
        content_sha256 TEXT PRIMARY KEY,
        canonical_local_path TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS api_mocks (
        mock_key TEXT PRIMARY KEY,
        method TEXT NOT NULL,
        pathname TEXT NOT NULL,
        query_hash TEXT NOT NULL,
        body_hash TEXT NOT NULL,
        status_code INTEGER NOT NULL,
        content_type TEXT NOT NULL,
        response_body BLOB NOT NULL
      );

      CREATE TABLE IF NOT EXISTS crawl_diffs (
        diff_id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL REFERENCES crawl_runs(run_id) ON DELETE CASCADE,
        normalized_url TEXT NOT NULL,
        change_type TEXT NOT NULL CHECK(change_type IN ('ADDED','MODIFIED','REMOVED')),
        old_sha256 TEXT,
        new_sha256 TEXT
      );
    `);
  }

  public createOrResumeRun(
    runId: string,
    rootUrl: string,
    configJson: string
  ): { resumed: boolean; pendingCount: number; doneCount: number } {
    const existing = this.getLatestRun();
    const now = Date.now();

    if (
      existing &&
      ['RUNNING', 'PAUSED', 'INTERRUPTED'].includes(existing.status)
    ) {
      // Recover any in-flight tasks left behind by an abrupt crash back to PENDING
      this.db
        .prepare(
          "UPDATE url_queue SET status = 'PENDING' WHERE run_id = ? AND status = 'IN_FLIGHT'"
        )
        .run(existing.run_id);

      this.db
        .prepare(
          "UPDATE crawl_runs SET status = 'RUNNING', updated_at = ? WHERE run_id = ?"
        )
        .run(now, existing.run_id);

      const counts = this.getQueueCounts(existing.run_id);
      return {
        resumed: true,
        pendingCount: counts.pending,
        doneCount: counts.done,
      };
    }

    this.db
      .prepare(
        `INSERT OR REPLACE INTO crawl_runs (
          run_id, root_url, config_json, status, started_at, updated_at, pages_done, assets_done, total_bytes
        ) VALUES (?, ?, ?, 'RUNNING', ?, ?, 0, 0, 0)`
      )
      .run(runId, rootUrl, configJson, now, now);

    return { resumed: false, pendingCount: 0, doneCount: 0 };
  }

  public getLatestRun(): RunSummaryRow | null {
    const row = this.db
      .prepare('SELECT * FROM crawl_runs ORDER BY updated_at DESC LIMIT 1')
      .get() as RunSummaryRow | undefined;
    return row || null;
  }

  public setRunStatus(runId: string, status: CrawlRunStatus): void {
    this.db
      .prepare('UPDATE crawl_runs SET status = ?, updated_at = ? WHERE run_id = ?')
      .run(status, Date.now(), runId);
  }

  public enqueueBatch(runId: string, items: EnqueueCandidate[]): number {
    if (items.length === 0) return 0;
    const stmt = this.db.prepare(
      `INSERT OR IGNORE INTO url_queue (
        normalized_url, run_id, raw_url, depth, kind, status, retry_count
      ) VALUES (?, ?, ?, ?, ?, 'PENDING', 0)`
    );

    let inserted = 0;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const item of items) {
        const res = stmt.run(
          item.normalizedUrl,
          runId,
          item.rawUrl,
          item.depth,
          item.kind
        );
        inserted += Number(res.changes || 0);
      }
      this.db.exec('COMMIT');
    } catch (err) {
      try {
        this.db.exec('ROLLBACK');
      } catch {}
      throw err;
    }
    return inserted;
  }

  public claimPendingBatch(runId: string, limit: number): QueueRow[] {
    const cap = Math.max(1, Math.min(limit, 100));
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const rows = this.db
        .prepare(
          `SELECT * FROM url_queue
           WHERE run_id = ? AND status = 'PENDING'
           ORDER BY CASE WHEN kind = 'PAGE' THEN 0 ELSE 1 END, depth ASC, rowid ASC
           LIMIT ?`
        )
        .all(runId, cap) as unknown as QueueRow[];

      if (rows.length > 0) {
        const markStmt = this.db.prepare(
          "UPDATE url_queue SET status = 'IN_FLIGHT' WHERE normalized_url = ?"
        );
        for (const r of rows) {
          markStmt.run(r.normalized_url);
        }
      }

      this.db.exec('COMMIT');
      return rows;
    } catch (err) {
      try {
        this.db.exec('ROLLBACK');
      } catch {}
      throw err;
    }
  }

  public markDone(
    runId: string,
    normalizedUrl: string,
    info: {
      localPath: string;
      httpStatus: number;
      etag?: string;
      lastModified?: string;
      contentSha256?: string;
      sizeBytes?: number;
      mimeType?: string;
      kind: 'PAGE' | 'ASSET';
    }
  ): void {
    const now = Date.now();
    const sizeBytes = info.sizeBytes || 0;

    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db
        .prepare(
          `UPDATE url_queue
           SET status = 'DONE', local_path = ?, http_status = ?, etag = ?, last_modified = ?, content_sha256 = ?, last_error = NULL
           WHERE normalized_url = ? AND run_id = ?`
        )
        .run(
          info.localPath,
          info.httpStatus,
          info.etag || null,
          info.lastModified || null,
          info.contentSha256 || null,
          normalizedUrl,
          runId
        );

      if (info.contentSha256 && info.localPath) {
        this.db
          .prepare(
            `INSERT OR IGNORE INTO assets (
              content_sha256, canonical_local_path, mime_type, size_bytes, created_at
            ) VALUES (?, ?, ?, ?, ?)`
          )
          .run(
            info.contentSha256,
            info.localPath,
            info.mimeType || 'application/octet-stream',
            sizeBytes,
            now
          );
      }

      if (info.kind === 'PAGE') {
        this.db
          .prepare(
            'UPDATE crawl_runs SET pages_done = pages_done + 1, total_bytes = total_bytes + ?, updated_at = ? WHERE run_id = ?'
          )
          .run(sizeBytes, now, runId);
      } else {
        this.db
          .prepare(
            'UPDATE crawl_runs SET assets_done = assets_done + 1, total_bytes = total_bytes + ?, updated_at = ? WHERE run_id = ?'
          )
          .run(sizeBytes, now, runId);
      }

      this.db.exec('COMMIT');
    } catch (err) {
      try {
        this.db.exec('ROLLBACK');
      } catch {}
      throw err;
    }
  }

  public markFailed(runId: string, normalizedUrl: string, errorMsg: string): void {
    this.db
      .prepare(
        `UPDATE url_queue
         SET status = 'FAILED', retry_count = retry_count + 1, last_error = ?
         WHERE normalized_url = ? AND run_id = ?`
      )
      .run(errorMsg.slice(0, 500), normalizedUrl, runId);
  }

  public resetInFlightToPending(runId: string): number {
    const res = this.db
      .prepare("UPDATE url_queue SET status = 'PENDING' WHERE run_id = ? AND status = 'IN_FLIGHT'")
      .run(runId);
    return Number(res.changes || 0);
  }

  public getQueueCounts(runId: string): {
    pending: number;
    inFlight: number;
    done: number;
    failed: number;
  } {
    const row = this.db
      .prepare(
        `SELECT
           SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS pending,
           SUM(CASE WHEN status = 'IN_FLIGHT' THEN 1 ELSE 0 END) AS inFlight,
           SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END) AS done,
           SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failed
         FROM url_queue
         WHERE run_id = ?`
      )
      .get(runId) as Record<string, number | null> | undefined;

    return {
      pending: Number(row?.pending || 0),
      inFlight: Number(row?.inFlight || 0),
      done: Number(row?.done || 0),
      failed: Number(row?.failed || 0),
    };
  }

  public findAssetBySha256(sha256: string): string | null {
    const row = this.db
      .prepare('SELECT canonical_local_path FROM assets WHERE content_sha256 = ? LIMIT 1')
      .get(sha256) as { canonical_local_path?: string } | undefined;
    return row?.canonical_local_path || null;
  }

  public getCompletedEntries(runId: string): Array<{
    normalizedUrl: string;
    rawUrl: string;
    kind: 'PAGE' | 'ASSET';
    localPath: string;
    etag: string | null;
    lastModified: string | null;
    contentSha256: string | null;
  }> {
    const rows = this.db
      .prepare(
        `SELECT normalized_url, raw_url, kind, local_path, etag, last_modified, content_sha256
         FROM url_queue
         WHERE run_id = ? AND status = 'DONE' AND local_path IS NOT NULL`
      )
      .all(runId) as Array<Record<string, any>>;

    return rows.map((r) => ({
      normalizedUrl: r.normalized_url,
      rawUrl: r.raw_url,
      kind: r.kind,
      localPath: r.local_path,
      etag: r.etag,
      lastModified: r.last_modified,
      contentSha256: r.content_sha256,
    }));
  }

  public recordDiffBatch(
    runId: string,
    projectDir: string,
    items: DiffChangeItem[],
    unchangedCount: number
  ): DiffSummary {
    const stmt = this.db.prepare(
      `INSERT INTO crawl_diffs (run_id, normalized_url, change_type, old_sha256, new_sha256)
       VALUES (?, ?, ?, ?, ?)`
    );

    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const item of items) {
        stmt.run(
          runId,
          item.url,
          item.changeType,
          item.oldSha256 || null,
          item.newSha256 || null
        );
      }
      this.db.exec('COMMIT');
    } catch (err) {
      try {
        this.db.exec('ROLLBACK');
      } catch {}
      throw err;
    }

    const summary: DiffSummary = {
      projectDir,
      comparedAt: new Date().toISOString(),
      added: items.filter((i) => i.changeType === 'ADDED').length,
      modified: items.filter((i) => i.changeType === 'MODIFIED').length,
      removed: items.filter((i) => i.changeType === 'REMOVED').length,
      unchanged: unchangedCount,
      items,
    };

    return summary;
  }

  public getDbPath(): string {
    return this.dbPath;
  }

  public close(): void {
    try {
      this.db.close();
    } catch {}
  }
}
