import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Bottleneck from 'bottleneck';
import robotsParser from 'robots-parser';
import {
  AnalyzeResult,
  CloneCompleteEvent,
  CloneErrorEvent,
  CloneLogEntry,
  CloneProgress,
  CloneSettings,
  DiffChangeItem,
  DiffSummary,
  TechSignature,
} from '../../shared/types';
import { buildDefaultUserAgent } from '../../shared/version';
import { HttpClient } from '../browser/http-client';
import { PageRenderer } from '../browser/page-renderer';
import { CrawlCheckpointDb } from '../storage/crawl-checkpoint-db';
import { AssetDownloader } from './asset-downloader';
import { CloneFinalizer } from './clone-finalizer';
import { FileOrganizer } from './file-organizer';
import { PageWorker, QueueTaskItem } from './page-worker';
import { ApiTrafficInterceptor } from './reverse-engineering/api-interceptor';

function escapeWildcardToRegExp(pattern: string): RegExp {
  const escaped = pattern.trim().replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(escaped, 'i');
}

export interface CrawlerOrchestratorOptions {
  pageRenderer?: PageRenderer;
  allowLocalhostTargets?: boolean;
  existingProjectDir?: string;
  runId?: string;
}

/**
 * Coordinates crash-safe hybrid website cloning backed by node:sqlite WAL checkpointing,
 * clean AbortController cancellation, content deduplication, and incremental ETag/SHA-256 diffing.
 */
export class CrawlerOrchestrator extends EventEmitter {
  private targetUrl: string;
  private activeOrigin: string;
  private settings: CloneSettings;
  private outputPath: string;
  private projectName: string;
  private technologies: TechSignature[];
  private analyzeResult?: AnalyzeResult;
  private allowLocalhostTargets: boolean;
  private runId: string;

  private organizer: FileOrganizer;
  private downloader: AssetDownloader;
  private limiter: Bottleneck;
  private dynamicLimiter = new Bottleneck({ maxConcurrent: 2 });
  private pageRenderer: PageRenderer;
  private abortController = new AbortController();
  private checkpointDb?: CrawlCheckpointDb;

  private queue: QueueTaskItem[] = [];
  private queueHead = 0;
  private visitedUrls = new Set<string>();
  private urlToLocalPathMap = new Map<string, string>();
  private contentHashToLocalPath = new Map<string, string>();
  private pagesToRewrite: Array<{ url: string; localPath: string }> = [];
  private failedUrlsList: Array<{ url: string; error: string; time: string }> = [];
  private processedSourceMaps = new Set<string>();
  private extractedStates: Record<string, any> = {};
  private extractedAdaptiveData: Record<string, any> = {};
  private apiInterceptor = new ApiTrafficInterceptor();

  private isRunning = false;
  private isPaused = false;
  private isCancelled = false;
  private resumeResolver: (() => void) | null = null;
  private robotsChecker: any = null;
  private screenshotBuffer: Buffer | null = null;
  private mhtmlSnapshot: string | null = null;

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
    analyzeScreenshot?: Buffer,
    options: CrawlerOrchestratorOptions = {}
  ) {
    super();
    this.targetUrl = targetUrl;
    this.activeOrigin = new URL(targetUrl).origin;
    this.settings = settings;
    this.outputPath = outputPath;
    this.projectName = projectName || new URL(targetUrl).hostname;
    this.technologies = technologies;
    this.analyzeResult = analyzeResult;
    this.screenshotBuffer = analyzeScreenshot || null;
    this.allowLocalhostTargets = Boolean(options.allowLocalhostTargets);
    this.runId = options.runId || `run_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    this.organizer = new FileOrganizer({
      baseOutputDir: outputPath,
      projectName: this.projectName,
      targetUrl,
      existingProjectDir: options.existingProjectDir,
    });

    this.downloader = new AssetDownloader(
      settings.userAgent || buildDefaultUserAgent(),
      30_000,
      {
        ignoreSslErrors: Boolean(settings.ignoreSslErrors),
        allowLocalhostTargets: this.allowLocalhostTargets,
      }
    );

    this.pageRenderer = options.pageRenderer || new PageRenderer();
    this.limiter = new Bottleneck({
      maxConcurrent: settings.concurrentDownloads || 5,
      minTime: settings.rateLimit ?? 100,
    });
  }

  public getProjectDir(): string {
    return this.organizer.getFolders().projectDir;
  }

  public async start(): Promise<void> {
    this.isRunning = true;
    this.isPaused = false;
    this.isCancelled = false;
    this.abortController = new AbortController();
    this.stats.startTime = Date.now();
    this.stats.lastSpeedCalcTime = Date.now();

    const folders = await this.organizer.initializeDirectories();
    const db = new CrawlCheckpointDb(folders.projectDir);
    this.checkpointDb = db;

    const cpState = db.createOrResumeRun(
      this.runId,
      this.targetUrl,
      JSON.stringify(this.settings)
    );

    if (cpState.resumed) {
      const latest = db.getLatestRun();
      if (latest) {
        this.runId = latest.run_id;
      }
      const completed = db.getCompletedEntries(this.runId);
      for (const entry of completed) {
        this.visitedUrls.add(entry.rawUrl);
        this.registerUrlMapping(entry.rawUrl, entry.localPath);
        if (entry.contentSha256) {
          this.contentHashToLocalPath.set(entry.contentSha256, entry.localPath);
        }
        if (entry.kind === 'PAGE') {
          this.pagesToRewrite.push({ url: entry.rawUrl, localPath: entry.localPath });
          this.stats.totalPages++;
        } else {
          this.stats.totalAssets++;
        }
        this.stats.totalFiles++;
      }

      // Restore pending queue from SQLite
      let batch = db.claimPendingBatch(this.runId, 100);
      while (batch.length > 0) {
        for (const row of batch) {
          db.resetInFlightToPending(this.runId);
          this.queue.push({
            url: row.raw_url,
            depth: row.depth,
            type: row.kind === 'PAGE' ? 'html' : 'other',
            isPage: row.kind === 'PAGE',
          });
        }
        break;
      }
      db.resetInFlightToPending(this.runId);
      this.emitLog(
        'info',
        `Yarım kalmış tarama SQLite kontrol noktasından sürdürülüyor (${cpState.doneCount} tamamlandı, ${cpState.pendingCount} bekliyor).`
      );
    } else {
      this.emitLog('info', `Klonlama başlatılıyor: ${this.targetUrl}`);
      this.enqueueItems([
        { url: this.targetUrl, depth: 0, type: 'html', isPage: true },
      ]);
    }

    try {
      const authCookies = await PageRenderer.getSessionCookies(this.targetUrl);
      if (authCookies.length > 0) {
        this.downloader.setCookies(authCookies);
      }
    } catch {}

    if (this.settings.respectRobotsTxt) {
      try {
        const robotsUrl = `${this.activeOrigin}/robots.txt`;
        const robotsRes = await this.downloader.downloadToBuffer(robotsUrl);
        if (robotsRes.statusCode === 200 && robotsRes.buffer) {
          this.robotsChecker = robotsParser(robotsUrl, robotsRes.buffer.toString('utf-8'));
        }
      } catch {}
    }

    this.processQueueLoop().catch((err) => {
      this.emitError(this.targetUrl, err.message || 'Kuyruk işleme hatası', 'QUEUE_FATAL');
    });
  }

  public pause(): void {
    this.isPaused = true;
    this.checkpointDb?.setRunStatus(this.runId, 'PAUSED');
    this.emitLog('warn', 'Klonlama duraklatıldı.');
  }

  public resume(): void {
    if (this.isPaused) {
      this.isPaused = false;
      this.checkpointDb?.setRunStatus(this.runId, 'RUNNING');
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
    this.abortController.abort(new Error('Cancelled by user'));
    try {
      void this.limiter.stop({ dropWaitingJobs: true });
      void this.dynamicLimiter.stop({ dropWaitingJobs: true });
    } catch {}
    if (this.resumeResolver) {
      this.resumeResolver();
      this.resumeResolver = null;
    }
    this.emitLog('warn', 'Klonlama kullanıcı tarafından iptal edildi. Kısmi durum SQLite veritabanına kaydedildi.');
  }

  /**
   * Resumes an incomplete or paused crawl from its persisted SQLite checkpoint directory.
   */
  public static async resumeFromCheckpoint(
    projectDir: string,
    options: Omit<CrawlerOrchestratorOptions, 'existingProjectDir'> = {}
  ): Promise<CrawlerOrchestrator> {
    const db = new CrawlCheckpointDb(projectDir);
    const run = db.getLatestRun();
    db.close();
    if (!run) {
      throw new Error(`No crawl checkpoint found in ${projectDir}`);
    }

    const parsedSettings = JSON.parse(run.config_json) as CloneSettings;
    const orchestrator = new CrawlerOrchestrator(
      run.root_url,
      parsedSettings,
      path.dirname(projectDir),
      path.basename(projectDir),
      [],
      undefined,
      undefined,
      {
        ...options,
        existingProjectDir: projectDir,
        runId: run.run_id,
      }
    );
    await orchestrator.start();
    return orchestrator;
  }

  /**
   * Performs an incremental conditional HTTP diff (ETag / Last-Modified + SHA-256 comparison)
   * against a previously cloned project directory and writes _meta/diff-report.json.
   */
  public static async runIncrementalDiff(
    projectDir: string,
    options: { allowLocalhostTargets?: boolean } = {}
  ): Promise<DiffSummary> {
    const db = new CrawlCheckpointDb(projectDir);
    try {
      const run = db.getLatestRun();
      if (!run) {
        throw new Error(`No crawl history found in ${projectDir}`);
      }

      const completed = db.getCompletedEntries(run.run_id);
      const pageEntries = completed.filter((e) => e.kind === 'PAGE');
      const diffItems: DiffChangeItem[] = [];
      let unchangedCount = 0;

      for (const entry of pageEntries.slice(0, 100)) {
        try {
          const condHeaders: Record<string, string> = {
            'user-agent': buildDefaultUserAgent(),
          };
          if (entry.etag) condHeaders['if-none-match'] = entry.etag;
          if (entry.lastModified) condHeaders['if-modified-since'] = entry.lastModified;

          const res = await HttpClient.fetchBuffer({
            url: entry.rawUrl,
            method: 'GET',
            headers: condHeaders,
            timeoutMs: 12_000,
            maxRetries: 1,
            allowLocalhostTargets: Boolean(options.allowLocalhostTargets),
          });

          if (res.statusCode === 304) {
            unchangedCount++;
            continue;
          }

          if (res.statusCode === 404 || res.statusCode === 410) {
            diffItems.push({
              url: entry.rawUrl,
              changeType: 'REMOVED',
              oldSha256: entry.contentSha256,
              newSha256: null,
            });
            continue;
          }

          if (res.statusCode < 400) {
            const newHash = crypto.createHash('sha256').update(res.body).digest('hex');
            if (entry.contentSha256 && newHash === entry.contentSha256) {
              unchangedCount++;
            } else {
              diffItems.push({
                url: entry.rawUrl,
                changeType: entry.contentSha256 ? 'MODIFIED' : 'ADDED',
                oldSha256: entry.contentSha256,
                newSha256: newHash,
              });
            }
          }
        } catch {}
      }

      const summary = db.recordDiffBatch(run.run_id, projectDir, diffItems, unchangedCount);
      const diffPath = path.join(projectDir, '_meta', 'diff-report.json');
      await fs.promises.writeFile(diffPath, JSON.stringify(summary, null, 2), 'utf-8');
      return summary;
    } finally {
      db.close();
    }
  }

  private enqueueItems(items: QueueTaskItem[]): void {
    const newItems: QueueTaskItem[] = [];
    for (const item of items) {
      if (!this.visitedUrls.has(item.url)) {
        newItems.push(item);
        this.queue.push(item);
      }
    }
    if (newItems.length > 0 && this.checkpointDb) {
      this.checkpointDb.enqueueBatch(
        this.runId,
        newItems.map((it) => ({
          normalizedUrl: it.url,
          rawUrl: it.url,
          depth: it.depth,
          kind: it.isPage ? 'PAGE' : 'ASSET',
        }))
      );
    }
  }

  private isUrlAllowed(urlStr: string, isPage: boolean = false): boolean {
    try {
      const pathname = new URL(urlStr).pathname;
      if (
        isPage &&
        this.settings.respectRobotsTxt &&
        this.robotsChecker &&
        !this.robotsChecker.isAllowed(urlStr, this.settings.userAgent || 'WebCloneStudio')
      ) {
        return false;
      }

      if (this.settings.excludedPatterns?.length) {
        for (const pattern of this.settings.excludedPatterns) {
          if (!pattern.trim()) continue;
          const regex = escapeWildcardToRegExp(pattern);
          if (regex.test(pathname) || regex.test(urlStr)) return false;
        }
      }

      const validIncludes = (this.settings.includedPatterns || []).filter((p) => p.trim().length > 0);
      if (validIncludes.length > 0) {
        const matched = validIncludes.some((p) => {
          const regex = escapeWildcardToRegExp(p);
          return regex.test(pathname) || regex.test(urlStr);
        });
        if (!matched) return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  private get queueLength(): number {
    return Math.max(0, this.queue.length - this.queueHead);
  }

  private dequeueItem(): QueueTaskItem | undefined {
    if (this.queueHead >= this.queue.length) return undefined;
    const item = this.queue[this.queueHead++];
    if (this.queueHead > 200 && this.queueHead * 2 >= this.queue.length) {
      this.queue = this.queue.slice(this.queueHead);
      this.queueHead = 0;
    }
    return item;
  }

  private async processQueueLoop(): Promise<void> {
    const db = this.checkpointDb!;
    const maxConcurrency = Math.max(1, Math.min(this.settings.concurrentDownloads || 5, 15));
    const inFlight = new Set<Promise<void>>();

    const sharedContext = {
      runId: this.runId,
      settings: this.settings,
      allowLocalhostTargets: this.allowLocalhostTargets,
      organizer: this.organizer,
      downloader: this.downloader,
      pageRenderer: this.pageRenderer,
      dynamicLimiter: this.dynamicLimiter,
      checkpointDb: db,
      apiInterceptor: this.apiInterceptor,
      visitedUrls: this.visitedUrls,
      processedSourceMaps: this.processedSourceMaps,
      urlToLocalPathMap: this.urlToLocalPathMap,
      contentHashToLocalPath: this.contentHashToLocalPath,
      pagesToRewrite: this.pagesToRewrite,
      failedUrlsList: this.failedUrlsList,
      extractedStates: this.extractedStates,
      extractedAdaptiveData: this.extractedAdaptiveData,
      getOrigin: () => this.activeOrigin,
      updateRootOrigin: (newOrigin: string, finalUrl: string) => {
        this.activeOrigin = newOrigin;
        this.targetUrl = finalUrl;
      },
      enqueueItems: (items: QueueTaskItem[]) => this.enqueueItems(items),
      registerUrlMapping: (url: string, localPath: string, finalUrl?: string) =>
        this.registerUrlMapping(url, localPath, finalUrl),
      recordFileStats: (type: string, sizeBytes: number) => this.recordFileStats(type, sizeBytes),
      onScreenshot: (buf: Buffer) => {
        if (!this.screenshotBuffer) this.screenshotBuffer = buf;
      },
      onMhtml: (mhtml: string) => {
        if (!this.mhtmlSnapshot) this.mhtmlSnapshot = mhtml;
      },
      onLog: (level: CloneLogEntry['level'], message: string, url?: string) =>
        this.emitLog(level, message, url),
      onFileAdded: (
        localPath: string,
        size: number,
        mimeType: string,
        httpStatus: number,
        depth: number
      ) => this.emitFileAdded(localPath, size, mimeType, httpStatus, depth),
      onError: (url: string, message: string, code: string) => this.emitError(url, message, code),
      incrementFailed: () => {
        this.stats.failedUrls++;
      },
      incrementPage: () => {
        this.stats.totalPages++;
      },
      incrementAsset: () => {
        this.stats.totalAssets++;
      },
    };

    while ((this.queueLength > 0 || inFlight.size > 0) && this.isRunning && !this.isCancelled) {
      if (this.isPaused) {
        await new Promise<void>((resolve) => {
          this.resumeResolver = resolve;
        });
        continue;
      }

      if (this.stats.totalFiles >= 10_000) {
        this.emitLog('warn', 'Maksimum dosya limitine (10.000) ulaşıldı.');
        break;
      }

      while (
        this.queueLength > 0 &&
        inFlight.size < maxConcurrency &&
        !this.isPaused &&
        !this.isCancelled
      ) {
        const item = this.dequeueItem();
        if (!item || this.visitedUrls.has(item.url)) continue;
        if (!this.isUrlAllowed(item.url, item.isPage)) continue;

        this.visitedUrls.add(item.url);

        const task: Promise<void> = this.limiter
          .schedule(() => PageWorker.processItem(item, sharedContext, this.abortController.signal))
          .catch((err) => {
            if (this.isCancelled || this.abortController.signal.aborted) return;
            this.stats.failedUrls++;
            const msg = err?.message || 'İndirme hatası';
            this.failedUrlsList.push({ url: item.url, error: msg, time: new Date().toISOString() });
            db.markFailed(this.runId, item.url, msg);
            this.emitError(item.url, msg, 'DOWNLOAD_EXCEPTION');
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

    if (inFlight.size > 0) {
      await Promise.allSettled(Array.from(inFlight));
    }

    // Strict cancellation contract: do NOT finalize or emit 'complete' when user cancelled
    if (this.isCancelled) {
      db.setRunStatus(this.runId, 'CANCELLED');
      db.close();
      this.emit('cancelled', { projectDir: this.organizer.getFolders().projectDir });
      return;
    }

    try {
      const completeEvent: CloneCompleteEvent = await CloneFinalizer.finalize({
        targetUrl: this.targetUrl,
        projectName: this.projectName,
        settings: this.settings,
        technologies: this.technologies,
        analyzeResult: this.analyzeResult,
        organizer: this.organizer,
        pagesToRewrite: this.pagesToRewrite,
        urlToLocalPathMap: this.urlToLocalPathMap,
        failedUrlsList: this.failedUrlsList,
        extractedStates: this.extractedStates,
        extractedAdaptiveData: this.extractedAdaptiveData,
        apiInterceptor: this.apiInterceptor,
        screenshotBuffer: this.screenshotBuffer,
        mhtmlSnapshot: this.mhtmlSnapshot,
        stats: this.stats,
        fileCounts: this.fileCounts,
        onLog: (level, msg) => this.emitLog(level, msg),
      });

      this.isRunning = false;
      db.setRunStatus(this.runId, 'COMPLETED');
      db.close();
      this.emit('complete', completeEvent);
    } catch (err: any) {
      this.isRunning = false;
      db.setRunStatus(this.runId, 'FAILED');
      db.close();
      this.emitError(this.targetUrl, err.message || 'Sonlandırma hatası', 'FINALIZE_ERROR');
    }
  }

  private registerUrlMapping(url: string, localPath: string, finalUrl?: string): void {
    if (!url || !localPath) return;
    this.urlToLocalPathMap.set(url, localPath);

    const registerVariant = (candidate: string) => {
      const noHash = candidate.split('#')[0];
      if (!this.urlToLocalPathMap.has(noHash)) {
        this.urlToLocalPathMap.set(noHash, localPath);
      }

      let isDynamicProxy = false;
      try {
        const parsed = new URL(noHash);
        isDynamicProxy = /\/(?:_next\/image|_ipx|cdn-cgi\/image)(?:\/|$)/i.test(parsed.pathname);
        if (parsed.search) {
          const sorted = new URLSearchParams(
            Array.from(parsed.searchParams.entries()).sort()
          ).toString();
          const canonicalSorted = `${parsed.origin}${parsed.pathname}?${sorted}`;
          if (!this.urlToLocalPathMap.has(canonicalSorted)) {
            this.urlToLocalPathMap.set(canonicalSorted, localPath);
          }
        }
      } catch {}

      if (!isDynamicProxy) {
        const noQuery = noHash.split('?')[0];
        if (!this.urlToLocalPathMap.has(noQuery)) {
          this.urlToLocalPathMap.set(noQuery, localPath);
        }
        const slashToggle = noQuery.endsWith('/') ? noQuery.slice(0, -1) : `${noQuery}/`;
        if (!this.urlToLocalPathMap.has(slashToggle)) {
          this.urlToLocalPathMap.set(slashToggle, localPath);
        }
      }
    };

    registerVariant(url);
    if (finalUrl && finalUrl !== url) {
      this.urlToLocalPathMap.set(finalUrl, localPath);
      registerVariant(finalUrl);
    }
  }

  private recordFileStats(type: string, sizeBytes: number): void {
    this.stats.totalFiles++;
    this.stats.totalSizeBytes += sizeBytes;
    const countKey = (
      type === 'image'
        ? 'images'
        : type === 'document'
        ? 'documents'
        : type === 'archive'
        ? 'archives'
        : type === 'data'
        ? 'data'
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
    const eta =
      this.stats.currentSpeedBps > 0 && queued > 0
        ? Math.round((queued * 50 * 1024) / this.stats.currentSpeedBps)
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
    this.emit('log', { level, message, timestamp: Date.now(), url } satisfies CloneLogEntry);
  }

  private emitFileAdded(
    localPath: string,
    size: number,
    mimeType: string,
    httpStatus: number,
    depth: number
  ): void {
    this.emit('file-added', {
      path: localPath,
      size,
      mimeType,
      httpStatus,
      depth,
    });
  }

  private emitError(url: string, message: string, code: string): void {
    const event: CloneErrorEvent = {
      url,
      message,
      code,
      retryCount: 2,
    };
    this.emit('error', event);
    this.emitLog('error', `[${code}] ${url} - ${message}`, url);
  }
}
