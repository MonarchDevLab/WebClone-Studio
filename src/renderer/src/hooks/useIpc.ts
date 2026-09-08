import { useEffect } from 'react';
import { useCloneStore } from '../stores/clone-store';
import { useProjectStore } from '../stores/project-store';
import { 
  CloneProgress, 
  FileAddedEvent, 
  CloneLogEntry, 
  CloneCompleteEvent, 
  CloneErrorEvent,
  AnalyzeResult,
  CloneSettings,
  SizeEstimate,
  ProjectInfo,
  AppSettings
} from '@shared/types';
import { toast } from 'sonner';

declare global {
  interface Window {
    electronAPI?: {
      send?: (channel: string, ...args: unknown[]) => void;
      invoke?: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>;
      on?: (channel: string, callback: (event: unknown, ...args: unknown[]) => void) => () => void;
      removeListener?: (channel: string, callback: (event: unknown, ...args: unknown[]) => void) => void;

      analyze: (url: string) => Promise<AnalyzeResult>;
      clone: (url: string, settings: CloneSettings, outputPath: string, projectName?: string) => Promise<{ success: boolean; jobId: string; outputPath: string }>;
      pauseClone: (jobId: string) => Promise<boolean>;
      resumeClone: (jobId: string) => Promise<boolean>;
      cancelClone: (jobId: string) => Promise<boolean>;
      selectDirectory: () => Promise<string | null>;
      openFolder: (folderPath: string) => Promise<boolean>;
      openBrowser: (filePath: string) => Promise<boolean>;
      getEstimate: (url: string, depth: number) => Promise<SizeEstimate>;
      listProjects: () => Promise<ProjectInfo[]>;
      deleteProject: (projectPath: string) => Promise<boolean>;
      openProject: (projectPath: string) => Promise<boolean>;
      getSettings: () => Promise<AppSettings>;
      saveSettings: (settings: AppSettings) => Promise<AppSettings>;
      
      exportSystemMap: (result?: AnalyzeResult) => Promise<string>;
      saveSystemMapFile: (content: string, defaultName?: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean }>;
      startPreviewServer: (targetPath: string) => Promise<{ success: boolean; url?: string; error?: string }>;
      stopPreviewServer: () => Promise<{ success: boolean }>;

      onProgress: (callback: (event: unknown, data: CloneProgress) => void) => () => void;
      onFileAdded: (callback: (event: unknown, data: FileAddedEvent) => void) => () => void;
      onLog: (callback: (event: unknown, data: CloneLogEntry) => void) => () => void;
      onComplete: (callback: (event: unknown, data: CloneCompleteEvent) => void) => () => void;
      onError: (callback: (event: unknown, data: CloneErrorEvent) => void) => () => void;
    };
  }
}

export function useIpc() {
  const { updateProgress, addFile, addLog, setComplete, addError } = useCloneStore();
  const { fetchProjects } = useProjectStore();

  useEffect(() => {
    if (!window.electronAPI) return;

    const api = window.electronAPI;

    // İlk açılışta projeleri getir
    fetchProjects();

    const unsubProgress = api.onProgress?.((_, data) => {
      updateProgress(data);
    });

    const unsubFileAdded = api.onFileAdded?.((_, data) => {
      addFile(data);
    });

    const unsubLog = api.onLog?.((_, data) => {
      addLog(data);
    });

    const unsubComplete = api.onComplete?.((_, data) => {
      setComplete(data);
      fetchProjects();
      toast.success(`Klonlama Tamamlandı! Toplam ${data.totalFiles} dosya indirildi.`);

      const state = useCloneStore.getState();
      
      if (state.openFolderOnComplete && data.outputPath && api.openFolder) {
        api.openFolder(data.outputPath);
      }
      
      if (state.openBrowserOnComplete && data.outputPath) {
        if (api.startPreviewServer) {
          api.startPreviewServer(data.outputPath);
        } else if (api.openBrowser && data.manifestPath) {
          const isWindows = data.manifestPath.includes('\\');
          const sep = isWindows ? '\\' : '/';
          const indexPath = data.manifestPath.replace(/manifest\.json$/, `site${sep}index.html`);
          api.openBrowser(indexPath);
        }
      }
    });

    const unsubError = api.onError?.((_, data) => {
      addError(data);
      toast.error(data.message || 'Klonlama sırasında bir hata oluştu');
    });

    return () => {
      unsubProgress?.();
      unsubFileAdded?.();
      unsubLog?.();
      unsubComplete?.();
      unsubError?.();
    };
  }, [updateProgress, addFile, addLog, setComplete, addError, fetchProjects]);

  return {
    isElectron: Boolean(window.electronAPI),
  };
}
