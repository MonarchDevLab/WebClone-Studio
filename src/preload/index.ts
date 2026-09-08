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
  CloneErrorEvent 
} from '../shared/types';

const ALLOWED_CHANNELS = new Set<string>(Object.values(IpcChannel));

function assertAllowedChannel(channel: string): void {
  if (!ALLOWED_CHANNELS.has(channel)) {
    throw new Error(`[Preload Security] İzin verilmeyen IPC kanalı: ${channel}`);
  }
}

// Olay dinleyici callback tipleri
type Callback<T = unknown> = (event: IpcRendererEvent, data: T) => void;
const subscriptionMap = new Map<Callback<any>, (_event: IpcRendererEvent, data: any) => void>();

/**
 * Ana süreç ile Renderer süreci arasında güvenli bir köprü (API) oluşturur.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // Temel IPC metotları (Kanal beyaz liste korumalı)
  send: (channel: string, ...args: unknown[]) => {
    assertAllowedChannel(channel);
    ipcRenderer.send(channel, ...args);
  },
  invoke: (channel: string, ...args: unknown[]) => {
    assertAllowedChannel(channel);
    return ipcRenderer.invoke(channel, ...args);
  },
  on: (channel: string, callback: Callback<any>) => {
    assertAllowedChannel(channel);
    const subscription = (_event: IpcRendererEvent, data: any) => callback(_event, data);
    subscriptionMap.set(callback, subscription);
    ipcRenderer.on(channel, subscription);
    return () => {
      ipcRenderer.removeListener(channel, subscription);
      subscriptionMap.delete(callback);
    };
  },
  removeListener: (channel: string, callback: Callback<any>) => {
    assertAllowedChannel(channel);
    const sub = subscriptionMap.get(callback);
    if (sub) {
      ipcRenderer.removeListener(channel, sub);
      subscriptionMap.delete(callback);
    } else {
      ipcRenderer.removeListener(channel, callback);
    }
  },
  
  // Analiz işlemleri
  analyze: (url: string) => ipcRenderer.invoke(IpcChannel.ANALYZE_START, url),
  
  // Klonlama işlemleri
  clone: (url: string, settings: CloneSettings, outputPath: string, projectName?: string) => 
    ipcRenderer.invoke(IpcChannel.CLONE_START, { url, settings, outputPath, projectName }),
  pauseClone: (jobId: string) => ipcRenderer.invoke(IpcChannel.CLONE_PAUSE, jobId),
  resumeClone: (jobId: string) => ipcRenderer.invoke(IpcChannel.CLONE_RESUME, jobId),
  cancelClone: (jobId: string) => ipcRenderer.invoke(IpcChannel.CLONE_CANCEL, jobId),
  
  // Sistem diyalogları ve tahmini
  selectDirectory: () => ipcRenderer.invoke(IpcChannel.DIALOG_SELECT_DIR),
  openFolder: (path: string) => ipcRenderer.invoke(IpcChannel.SHELL_OPEN_FOLDER, path),
  openBrowser: (filePath: string) => ipcRenderer.invoke(IpcChannel.SHELL_OPEN_FILE, filePath),
  getEstimate: (url: string, depth: number) => ipcRenderer.invoke(IpcChannel.DIALOG_ESTIMATE, { url, depth }),
  
  // Proje yönetimi
  listProjects: () => ipcRenderer.invoke(IpcChannel.PROJECTS_LIST),
  deleteProject: (projectPath: string) => ipcRenderer.invoke(IpcChannel.PROJECTS_DELETE, projectPath),
  openProject: (projectPath: string) => ipcRenderer.invoke(IpcChannel.PROJECTS_OPEN, projectPath),
  
  // Ayar yönetimi
  getSettings: () => ipcRenderer.invoke(IpcChannel.SETTINGS_GET),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke(IpcChannel.SETTINGS_SET, settings),

  // Sistem Haritası ve Mimari Şartname (.md) Dışa Aktarımı
  exportSystemMap: (result?: AnalyzeResult) => ipcRenderer.invoke(IpcChannel.EXPORT_SYSTEM_MAP, result),
  saveSystemMapFile: (content: string, defaultName?: string) => 
    ipcRenderer.invoke(IpcChannel.DIALOG_SAVE_FILE, { content, defaultName }),

  // Yerel Önizleme Sunucusu (127.0.0.1 HTTP)
  startPreviewServer: (targetPath: string) => ipcRenderer.invoke(IpcChannel.SERVER_START_PREVIEW, targetPath),
  stopPreviewServer: () => ipcRenderer.invoke(IpcChannel.SERVER_STOP_PREVIEW),

  // Klonlama süreci dinleyicileri
  onProgress: (callback: (event: IpcRendererEvent, data: CloneProgress) => void) => {
    const sub = (_event: IpcRendererEvent, data: CloneProgress) => callback(_event, data);
    ipcRenderer.on(IpcChannel.CLONE_PROGRESS, sub);
    return () => ipcRenderer.removeListener(IpcChannel.CLONE_PROGRESS, sub);
  },
  onFileAdded: (callback: (event: IpcRendererEvent, data: FileAddedEvent) => void) => {
    const sub = (_event: IpcRendererEvent, data: FileAddedEvent) => callback(_event, data);
    ipcRenderer.on(IpcChannel.CLONE_FILE_ADDED, sub);
    return () => ipcRenderer.removeListener(IpcChannel.CLONE_FILE_ADDED, sub);
  },
  onLog: (callback: (event: IpcRendererEvent, data: CloneLogEntry) => void) => {
    const sub = (_event: IpcRendererEvent, data: CloneLogEntry) => callback(_event, data);
    ipcRenderer.on(IpcChannel.CLONE_LOG, sub);
    return () => ipcRenderer.removeListener(IpcChannel.CLONE_LOG, sub);
  },
  onComplete: (callback: (event: IpcRendererEvent, data: CloneCompleteEvent) => void) => {
    const sub = (_event: IpcRendererEvent, data: CloneCompleteEvent) => callback(_event, data);
    ipcRenderer.on(IpcChannel.CLONE_COMPLETE, sub);
    return () => ipcRenderer.removeListener(IpcChannel.CLONE_COMPLETE, sub);
  },
  onError: (callback: (event: IpcRendererEvent, data: CloneErrorEvent) => void) => {
    const sub = (_event: IpcRendererEvent, data: CloneErrorEvent) => callback(_event, data);
    ipcRenderer.on(IpcChannel.CLONE_ERROR, sub);
    return () => ipcRenderer.removeListener(IpcChannel.CLONE_ERROR, sub);
  }
});
