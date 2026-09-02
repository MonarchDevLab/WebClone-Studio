import { useEffect } from 'react';
import { useCloneStore } from '../stores/clone-store';
import { useProjectStore } from '../stores/project-store';
import { CloneProgress, FileAddedEvent, CloneLogEntry, CloneCompleteEvent, CloneErrorEvent } from '@shared/types';
import { toast } from 'sonner';

declare global {
  interface Window {
    electronAPI?: {
      analyze: (url: string) => Promise<any>;
      clone: (url: string, settings: any, outputPath: string, projectName?: string) => Promise<any>;
      pauseClone: (jobId: string) => Promise<boolean>;
      resumeClone: (jobId: string) => Promise<boolean>;
      cancelClone: (jobId: string) => Promise<boolean>;
      selectDirectory: () => Promise<string | null>;
      openFolder: (folderPath: string) => Promise<boolean>;
      openBrowser: (filePath: string) => Promise<boolean>;
      getEstimate: (url: string, depth: number) => Promise<any>;
      listProjects: () => Promise<any[]>;
      deleteProject: (projectPath: string) => Promise<boolean>;
      openProject: (projectPath: string) => Promise<boolean>;
      getSettings: () => Promise<any>;
      saveSettings: (settings: any) => Promise<any>;
      
      exportSystemMap: (result?: any) => Promise<string>;
      saveSystemMapFile: (content: string, defaultName?: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean }>;
      startPreviewServer: (targetPath: string) => Promise<{ success: boolean; url?: string; error?: string }>;
      stopPreviewServer: () => Promise<{ success: boolean }>;

      onProgress: (callback: (event: any, data: CloneProgress) => void) => () => void;
      onFileAdded: (callback: (event: any, data: FileAddedEvent) => void) => () => void;
      onLog: (callback: (event: any, data: CloneLogEntry) => void) => () => void;
      onComplete: (callback: (event: any, data: CloneCompleteEvent) => void) => () => void;
      onError: (callback: (event: any, data: CloneErrorEvent) => void) => () => void;
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
