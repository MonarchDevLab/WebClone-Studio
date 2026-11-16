import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { IpcChannel } from '../shared/ipc-channels';
import {
  CloneSettings,
  AppSettings,
  AnalyzeResult,
  CloneProgress,
  FileAddedEvent,
  CloneLogEntry,
  CloneCompleteEvent,
  CloneErrorEvent,
  TelemetryBatchPayload,
} from '../shared/types';

function subscribe<T>(channel: IpcChannel, callback: (data: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, data: T) => callback(data);
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

/**
 * Least-privilege typed IPC bridge between Electron main and isolated renderer.
 * Raw generic send/invoke channels and native IpcRendererEvent objects are intentionally withheld.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // Analysis
  analyze: (url: string) => ipcRenderer.invoke(IpcChannel.ANALYZE_START, url),

  // Cloning lifecycle & checkpoint operations
  clone: (url: string, settings: CloneSettings, outputPath: string, projectName?: string) =>
    ipcRenderer.invoke(IpcChannel.CLONE_START, { url, settings, outputPath, projectName }),
  pauseClone: (jobId: string) => ipcRenderer.invoke(IpcChannel.CLONE_PAUSE, jobId),
  resumeClone: (jobId: string) => ipcRenderer.invoke(IpcChannel.CLONE_RESUME, jobId),
  resumeIncompleteCrawl: (projectPath: string) =>
    ipcRenderer.invoke(IpcChannel.CLONE_RESUME_CHECKPOINT, projectPath),
  runIncrementalDiff: (projectPath: string) =>
    ipcRenderer.invoke(IpcChannel.CLONE_DIFF, projectPath),
  cancelClone: (jobId: string) => ipcRenderer.invoke(IpcChannel.CLONE_CANCEL, jobId),

  // Dialogs & local/external shell triggers
  selectDirectory: () => ipcRenderer.invoke(IpcChannel.DIALOG_SELECT_DIR),
  openFolder: (folderPath: string) => ipcRenderer.invoke(IpcChannel.SHELL_OPEN_FOLDER, folderPath),
  openBrowser: (filePath: string) => ipcRenderer.invoke(IpcChannel.SHELL_OPEN_FILE, filePath),
  openExternalUrl: (httpsUrl: string) => ipcRenderer.invoke(IpcChannel.SHELL_OPEN_EXTERNAL, httpsUrl),
  getEstimate: (url: string, depth: number) =>
    ipcRenderer.invoke(IpcChannel.DIALOG_ESTIMATE, { url, depth }),

  // Projects & Artifact Explorer
  listProjects: () => ipcRenderer.invoke(IpcChannel.PROJECTS_LIST),
  deleteProject: (projectPath: string) => ipcRenderer.invoke(IpcChannel.PROJECTS_DELETE, projectPath),
  openProject: (projectPath: string) => ipcRenderer.invoke(IpcChannel.PROJECTS_OPEN, projectPath),
  getArtifactSummary: (projectPath: string) =>
    ipcRenderer.invoke(IpcChannel.ARTIFACTS_SUMMARY, projectPath),
  readProjectArtifact: (projectDir: string, relativePath: string) =>
    ipcRenderer.invoke(IpcChannel.ARTIFACTS_READ, { projectDir, relativePath }),
  exportWacz: (projectPath: string) => ipcRenderer.invoke(IpcChannel.EXPORT_WACZ, projectPath),

  // Application settings
  getSettings: () => ipcRenderer.invoke(IpcChannel.SETTINGS_GET),
  saveSettings: (settings: Partial<AppSettings>) =>
    ipcRenderer.invoke(IpcChannel.SETTINGS_SET, settings),

  // System Map export
  exportSystemMap: (result?: AnalyzeResult) => ipcRenderer.invoke(IpcChannel.EXPORT_SYSTEM_MAP, result),
  saveSystemMapFile: (content: string, defaultName?: string) =>
    ipcRenderer.invoke(IpcChannel.DIALOG_SAVE_FILE, { content, defaultName }),

  // Local 127.0.0.1 preview server
  startPreviewServer: (targetPath: string, options?: { openExternal?: boolean }) =>
    ipcRenderer.invoke(IpcChannel.SERVER_START_PREVIEW, { targetPath, openExternal: options?.openExternal }),
  stopPreviewServer: () => ipcRenderer.invoke(IpcChannel.SERVER_STOP_PREVIEW),

  // Interactive user auth session capture
  openAuthSession: (url: string) => ipcRenderer.invoke(IpcChannel.AUTH_OPEN_SESSION, url),

  // Updates & version
  checkForUpdates: () => ipcRenderer.invoke(IpcChannel.APP_CHECK_UPDATE),
  getAppVersion: () => ipcRenderer.invoke(IpcChannel.APP_GET_VERSION),

  // Typed event streams (stripped of internal IpcRendererEvent)
  onTelemetryBatch: (callback: (data: TelemetryBatchPayload) => void) =>
    subscribe<TelemetryBatchPayload>(IpcChannel.CLONE_TELEMETRY_BATCH, callback),
  onProgress: (callback: (data: CloneProgress) => void) =>
    subscribe<CloneProgress>(IpcChannel.CLONE_PROGRESS, callback),
  onFileAdded: (callback: (data: FileAddedEvent) => void) =>
    subscribe<FileAddedEvent>(IpcChannel.CLONE_FILE_ADDED, callback),
  onLog: (callback: (data: CloneLogEntry) => void) =>
    subscribe<CloneLogEntry>(IpcChannel.CLONE_LOG, callback),
  onComplete: (callback: (data: CloneCompleteEvent) => void) =>
    subscribe<CloneCompleteEvent>(IpcChannel.CLONE_COMPLETE, callback),
  onError: (callback: (data: CloneErrorEvent) => void) =>
    subscribe<CloneErrorEvent>(IpcChannel.CLONE_ERROR, callback),
});
