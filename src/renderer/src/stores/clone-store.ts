import { create } from 'zustand';
import { 
  CloneSettings, CloneProgress, FileAddedEvent, CloneLogEntry, 
  CloneErrorEvent, CloneCompleteEvent 
} from '@shared/types';
import { DEFAULT_DEPTH, DEFAULT_CONCURRENT, DEFAULT_RATE_LIMIT, DEFAULT_MAX_FILE_SIZE, DEFAULT_USER_AGENT } from '../lib/constants';

interface CloneState {
  isCloning: boolean;
  isPaused: boolean;
  progress: CloneProgress | null;
  files: FileAddedEvent[];
  logs: CloneLogEntry[];
  errors: CloneErrorEvent[];
  settings: CloneSettings;
  outputPath: string;
  projectName: string;
  jobId: string | null;
  openFolderOnComplete: boolean;
  openBrowserOnComplete: boolean;

  startClone: (url: string, settings: CloneSettings, outputPath: string, projectName?: string, openFolderOnComplete?: boolean, openBrowserOnComplete?: boolean) => Promise<any>;
  pauseClone: () => Promise<void>;
  resumeClone: () => Promise<void>;
  cancelClone: () => Promise<void>;
  
  updateProgress: (progress: CloneProgress) => void;
  addFile: (file: FileAddedEvent) => void;
  addLog: (log: CloneLogEntry) => void;
  addError: (error: CloneErrorEvent) => void;
  setComplete: (result: CloneCompleteEvent) => void;
  clearLogs: () => void;
  reset: () => void;
}

export const useCloneStore = create<CloneState>((set, get) => ({
  isCloning: false,
  isPaused: false,
  progress: null,
  files: [],
  logs: [],
  errors: [],
  settings: {
    mode: 'static',
    maxDepth: DEFAULT_DEPTH,
    concurrentDownloads: DEFAULT_CONCURRENT,
    rateLimit: DEFAULT_RATE_LIMIT,
    respectRobotsTxt: true,
    downloadImages: true,
    downloadFonts: true,
    downloadMedia: false,
    downloadExternalAssets: true,
    includedPatterns: [],
    excludedPatterns: [],
    maxFileSize: DEFAULT_MAX_FILE_SIZE,
    userAgent: DEFAULT_USER_AGENT,
  },
  outputPath: '',
  projectName: '',
  jobId: null,
  openFolderOnComplete: true,
  openBrowserOnComplete: false,

  startClone: async (url, settings, outputPath, projectName, openFolderOnComplete = true, openBrowserOnComplete = false) => {
    set({
      isCloning: true,
      isPaused: false,
      settings,
      outputPath,
      projectName: projectName || '',
      openFolderOnComplete,
      openBrowserOnComplete,
      errors: [],
      logs: [],
      files: [],
      progress: null
    });

    if (window.electronAPI?.clone) {
      try {
        const res = await window.electronAPI.clone(url, settings, outputPath, projectName);
        if (res?.jobId) {
          set({ jobId: res.jobId });
        }
        if (res?.outputPath) {
          set({ outputPath: res.outputPath });
        }
        return res;
      } catch (err: any) {
        set({ isCloning: false });
        throw err;
      }
    }
  },
  
  pauseClone: async () => {
    const { jobId } = get();
    set({ isPaused: true });
    if (jobId && window.electronAPI?.pauseClone) {
      await window.electronAPI.pauseClone(jobId);
    }
  },

  resumeClone: async () => {
    const { jobId } = get();
    set({ isPaused: false });
    if (jobId && window.electronAPI?.resumeClone) {
      await window.electronAPI.resumeClone(jobId);
    }
  },

  cancelClone: async () => {
    const { jobId } = get();
    set({ isCloning: false, isPaused: false });
    if (jobId && window.electronAPI?.cancelClone) {
      await window.electronAPI.cancelClone(jobId);
    }
  },
  
  updateProgress: (progress) => set({ progress }),
  addFile: (file) => set((state) => ({ files: [...state.files, file] })),
  addLog: (log) => set((state) => ({ logs: [...state.logs, log] })),
  addError: (error) => set((state) => ({ errors: [...state.errors, error] })),
  setComplete: (result) => set({ isCloning: false, isPaused: false, outputPath: result?.outputPath || get().outputPath }),
  clearLogs: () => set({ logs: [] }),
  
  reset: () => set({
    isCloning: false,
    isPaused: false,
    progress: null,
    files: [],
    logs: [],
    errors: [],
    jobId: null,
    openFolderOnComplete: true,
  })
}));
