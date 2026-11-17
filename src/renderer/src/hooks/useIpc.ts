import { useEffect } from 'react';
import { useCloneStore } from '../stores/clone-store';
import { useProjectStore } from '../stores/project-store';
import {
  CloneProgress,
  FileAddedEvent,
  CloneLogEntry,
  CloneCompleteEvent,
  CloneErrorEvent,
  TelemetryBatchPayload,
  AnalyzeResult,
  CloneSettings,
  SizeEstimate,
  ProjectInfo,
  AppSettings,
  AppUpdateInfo,
  DiffSummary,
  ProjectArtifactSummary,
  ArtifactReadResult,
} from '@shared/types';
import { toast } from 'sonner';

declare global {
  interface Window {
    electronAPI?: {
      analyze: (url: string) => Promise<AnalyzeResult>;
      clone: (
        url: string,
        settings: CloneSettings,
        outputPath: string,
        projectName?: string
      ) => Promise<{ success: boolean; jobId: string; outputPath: string }>;
      pauseClone: (jobId: string) => Promise<boolean>;
      resumeClone: (jobId: string) => Promise<boolean>;
      resumeIncompleteCrawl: (projectPath: string) => Promise<boolean>;
      runIncrementalDiff: (projectPath: string) => Promise<DiffSummary>;
      cancelClone: (jobId: string) => Promise<boolean>;
      selectDirectory: () => Promise<string | null>;
      openFolder: (folderPath: string) => Promise<boolean>;
      openBrowser: (filePath: string) => Promise<boolean>;
      openExternalUrl: (httpsUrl: string) => Promise<boolean>;
      getEstimate: (url: string, depth: number) => Promise<SizeEstimate>;
      listProjects: () => Promise<ProjectInfo[]>;
      deleteProject: (projectPath: string) => Promise<boolean>;
      openProject: (projectPath: string) => Promise<boolean>;
      getArtifactSummary: (projectPath: string) => Promise<ProjectArtifactSummary>;
      readProjectArtifact: (projectDir: string, relativePath: string) => Promise<ArtifactReadResult>;
      exportWacz: (projectPath: string) => Promise<{ filePath: string; sizeBytes: number; sha256: string }>;
      getSettings: () => Promise<AppSettings>;
      saveSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;

      exportSystemMap: (result?: AnalyzeResult) => Promise<string>;
      saveSystemMapFile: (
        content: string,
        defaultName?: string
      ) => Promise<{ success: boolean; filePath?: string; canceled?: boolean }>;
      startPreviewServer: (
        targetPath: string,
        options?: { openExternal?: boolean }
      ) => Promise<{ success: boolean; url?: string; error?: string }>;
      stopPreviewServer: () => Promise<{ success: boolean }>;
      openAuthSession: (
        url: string
      ) => Promise<{
        cookieCount: number;
        cookies: Array<{ name: string; value: string; domain: string; path: string }>;
      }>;

      checkForUpdates: () => Promise<AppUpdateInfo>;
      getAppVersion: () => Promise<string>;

      onTelemetryBatch?: (callback: (data: TelemetryBatchPayload) => void) => () => void;
      onProgress: (callback: (data: CloneProgress) => void) => () => void;
      onFileAdded: (callback: (data: FileAddedEvent) => void) => () => void;
      onLog: (callback: (data: CloneLogEntry) => void) => () => void;
      onComplete: (callback: (data: CloneCompleteEvent) => void) => () => void;
      onError: (callback: (data: CloneErrorEvent) => void) => () => void;
    };
  }
}

export function useIpc() {
  const { updateProgress, addFile, addLog, applyTelemetryBatch, setComplete, addError } = useCloneStore();
  const { fetchProjects } = useProjectStore();

  useEffect(() => {
    if (!window.electronAPI) return;

    const api = window.electronAPI;

    fetchProjects();

    const hasBatch = typeof api.onTelemetryBatch === 'function';
    const unsubTelemetryBatch = hasBatch
      ? api.onTelemetryBatch!((batch) => {
          applyTelemetryBatch(batch);
        })
      : undefined;

    const unsubProgress = !hasBatch
      ? api.onProgress?.((data) => {
          updateProgress(data);
        })
      : undefined;

    const unsubFileAdded = !hasBatch
      ? api.onFileAdded?.((data) => {
          addFile(data);
        })
      : undefined;

    const unsubLog = !hasBatch
      ? api.onLog?.((data) => {
          addLog(data);
        })
      : undefined;

    const unsubComplete = api.onComplete?.((data) => {
      setComplete(data);
      fetchProjects();
      toast.success(`Klonlama Tamamlandı! Toplam ${data.totalFiles} dosya indirildi.`);

      const state = useCloneStore.getState();

      if (state.openFolderOnComplete && data.outputPath && api.openFolder) {
        api.openFolder(data.outputPath);
      }

      if (state.openBrowserOnComplete && data.outputPath) {
        if (api.startPreviewServer) {
          api.startPreviewServer(data.outputPath, { openExternal: true });
        } else if (api.openBrowser && data.manifestPath) {
          const isWindows = data.manifestPath.includes('\\');
          const sep = isWindows ? '\\' : '/';
          const indexPath = data.manifestPath.replace(/manifest\.json$/, `site${sep}index.html`);
          api.openBrowser(indexPath);
        }
      }
    });

    const unsubError = api.onError?.((data) => {
      addError(data);
      toast.error(data.message || 'Klonlama sırasında bir hata oluştu');
    });

    return () => {
      unsubTelemetryBatch?.();
      unsubProgress?.();
      unsubFileAdded?.();
      unsubLog?.();
      unsubComplete?.();
      unsubError?.();
    };
  }, [updateProgress, addFile, addLog, applyTelemetryBatch, setComplete, addError, fetchProjects]);

  return {
    isElectron: Boolean(window.electronAPI),
  };
}
