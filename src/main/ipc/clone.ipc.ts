import path from 'node:path';
import { WebContents } from 'electron';
import { IpcChannel } from '../../shared/ipc-channels';
import {
  CloneCompleteEvent,
  CloneErrorEvent,
  CloneLogEntry,
  CloneProgress,
  CloneSettings,
  DiffSummary,
  FileAddedEvent,
  TelemetryBatchPayload,
} from '../../shared/types';
import { clampCloneSettings } from '../../shared/validators';
import { CrawlerOrchestrator } from '../cloner/crawler-orchestrator';
import { handleSecure } from '../security/ipc-guard';
import { assertSafeRemoteUrl } from '../security/url-guard';
import { getDynamicFolder, IpcRuntimeContext, normalizeUrlKey } from './context';

function attachOrchestratorTelemetry(
  jobId: string,
  crawler: CrawlerOrchestrator,
  sender: WebContents,
  ctx: IpcRuntimeContext
): void {
  let latestProgress: CloneProgress | undefined;
  let pendingFiles: FileAddedEvent[] = [];
  let pendingLogs: CloneLogEntry[] = [];
  let warningCountDelta = 0;

  const flushBatch = () => {
    if (
      !latestProgress &&
      pendingFiles.length === 0 &&
      pendingLogs.length === 0 &&
      warningCountDelta === 0
    ) {
      return;
    }

    if (!sender.isDestroyed()) {
      const payload: TelemetryBatchPayload = {
        progress: latestProgress,
        addedFiles: pendingFiles,
        logs: pendingLogs,
        warningCountDelta,
      };
      sender.send(IpcChannel.CLONE_TELEMETRY_BATCH, payload);
      if (latestProgress) {
        sender.send(IpcChannel.CLONE_PROGRESS, latestProgress);
      }
    }

    latestProgress = undefined;
    pendingFiles = [];
    pendingLogs = [];
    warningCountDelta = 0;
  };

  const intervalId = setInterval(flushBatch, 100);

  crawler.on('progress', (data: CloneProgress) => {
    latestProgress = data;
    if (data.queued === 0) {
      flushBatch();
    }
  });

  crawler.on('file-added', (data: FileAddedEvent) => {
    pendingFiles.push(data);
    if (pendingFiles.length >= 25) {
      flushBatch();
    }
  });

  crawler.on('log', (data: CloneLogEntry) => {
    pendingLogs.push(data);
    if (pendingLogs.length >= 25) {
      flushBatch();
    }
  });

  crawler.on('error', (data: CloneErrorEvent) => {
    // Non-fatal HTTP asset warnings increment status bar counter instead of toast storm
    if (data.code === 'HTTP_ERROR') {
      warningCountDelta++;
      return;
    }
    if (!sender.isDestroyed()) {
      sender.send(IpcChannel.CLONE_ERROR, data);
    }
  });

  crawler.on('complete', (data: CloneCompleteEvent) => {
    clearInterval(intervalId);
    flushBatch();
    if (!sender.isDestroyed()) {
      sender.send(IpcChannel.CLONE_COMPLETE, data);
    }
    ctx.activeJobs.delete(jobId);
  });

  crawler.on('cancelled', () => {
    clearInterval(intervalId);
    flushBatch();
    ctx.activeJobs.delete(jobId);
  });
}

export function registerCloneIpc(ctx: IpcRuntimeContext): void {
  handleSecure<
    { url: string; settings: CloneSettings; outputPath: string; projectName?: string },
    { success: boolean; jobId: string; outputPath: string }
  >(IpcChannel.CLONE_START, async (event, { url, settings, outputPath, projectName }) => {
    const appSettings = ctx.settingsStore.get();
    const allowLocalhostTargets = Boolean(appSettings.allowLocalhostTargets);
    const parsedUrl = await assertSafeRemoteUrl(url, { allowLocalhostTargets });
    const clampedSettings = clampCloneSettings(settings);

    const jobId = `job_${Date.now()}`;
    let finalOutputDir = outputPath?.trim();
    if (
      !finalOutputDir ||
      finalOutputDir.startsWith('[Varsayılan') ||
      finalOutputDir === 'downloads'
    ) {
      finalOutputDir =
        appSettings.defaultOutputDir || path.join(getDynamicFolder('downloads'), 'WebClone');
    } else if (finalOutputDir === 'documents') {
      finalOutputDir = path.join(getDynamicFolder('documents'), 'WebClone');
    } else if (finalOutputDir === 'desktop') {
      finalOutputDir = path.join(getDynamicFolder('desktop'), 'WebClone');
    }

    const finalProjectName = projectName?.trim() || parsedUrl.hostname;
    const cachedAnalysis = ctx.analyzeCache.get(normalizeUrlKey(parsedUrl.href));
    const isSameAnalyzedUrl =
      cachedAnalysis ||
      (ctx.lastAnalyzeResult?.siteMap?.url &&
        normalizeUrlKey(ctx.lastAnalyzeResult.siteMap.url) === normalizeUrlKey(parsedUrl.href));

    const targetAnalyzeResult =
      cachedAnalysis?.result || (isSameAnalyzedUrl ? ctx.lastAnalyzeResult : null);
    const technologies = targetAnalyzeResult?.technologies || [];
    const seedScreenshot =
      cachedAnalysis?.screenshot ||
      (isSameAnalyzedUrl ? ctx.lastAnalyzeScreenshot || undefined : undefined);

    const crawler = new CrawlerOrchestrator(
      parsedUrl.href,
      clampedSettings,
      finalOutputDir,
      finalProjectName,
      technologies,
      targetAnalyzeResult || undefined,
      seedScreenshot,
      {
        pageRenderer: ctx.pageRenderer,
        allowLocalhostTargets,
      }
    );

    attachOrchestratorTelemetry(jobId, crawler, event.sender, ctx);
    ctx.activeJobs.set(jobId, crawler);

    crawler.start().catch((err) => {
      ctx.activeJobs.delete(jobId);
      if (!event.sender.isDestroyed()) {
        event.sender.send(IpcChannel.CLONE_ERROR, {
          url: parsedUrl.href,
          message: err.message || 'Klonlama motoru başlatılamadı',
          code: 'CRAWLER_INIT_FAILED',
          retryCount: 0,
        });
      }
    });

    return { success: true, jobId, outputPath: finalOutputDir };
  });

  handleSecure<string, boolean>(IpcChannel.CLONE_PAUSE, (_event, jobId) => {
    const job = ctx.activeJobs.get(jobId);
    if (!job) return false;
    job.pause();
    return true;
  });

  handleSecure<string, boolean>(IpcChannel.CLONE_RESUME, (_event, jobId) => {
    const job = ctx.activeJobs.get(jobId);
    if (!job) return false;
    job.resume();
    return true;
  });

  handleSecure<string, boolean>(IpcChannel.CLONE_CANCEL, (_event, jobId) => {
    const job = ctx.activeJobs.get(jobId);
    if (!job) return false;
    job.cancel();
    ctx.activeJobs.delete(jobId);
    return true;
  });

  handleSecure<string, boolean>(
    IpcChannel.CLONE_RESUME_CHECKPOINT,
    async (event, projectDir) => {
      const appSettings = ctx.settingsStore.get();
      const jobId = `resume_${Date.now()}`;
      const crawler = await CrawlerOrchestrator.resumeFromCheckpoint(projectDir, {
        pageRenderer: ctx.pageRenderer,
        allowLocalhostTargets: Boolean(appSettings.allowLocalhostTargets),
      });
      attachOrchestratorTelemetry(jobId, crawler, event.sender, ctx);
      ctx.activeJobs.set(jobId, crawler);
      return true;
    }
  );

  handleSecure<string, DiffSummary>(IpcChannel.CLONE_DIFF, async (_event, projectDir) => {
    const appSettings = ctx.settingsStore.get();
    return await CrawlerOrchestrator.runIncrementalDiff(projectDir, {
      allowLocalhostTargets: Boolean(appSettings.allowLocalhostTargets),
    });
  });
}
