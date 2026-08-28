import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { IpcChannel } from '../shared/ipc-channels';
import { CloneSettings } from '../shared/types';

// Olay dinleyici callback tipleri
type Callback<T = any> = (event: IpcRendererEvent, ...args: T[]) => void;

/**
 * Ana süreç ile Renderer süreci arasında güvenli bir köprü (API) oluşturur.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // Temel IPC metotları
  send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  on: (channel: string, callback: Callback) => {
    const subscription = (_event: IpcRendererEvent, ...args: any[]) => callback(_event, ...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },
  removeListener: (channel: string, callback: Callback) => ipcRenderer.removeListener(channel, callback),
  
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
  saveSettings: (settings: any) => ipcRenderer.invoke(IpcChannel.SETTINGS_SET, settings),

  // Sistem Haritası ve Mimari Şartname (.md) Dışa Aktarımı
  exportSystemMap: (result?: any) => ipcRenderer.invoke(IpcChannel.EXPORT_SYSTEM_MAP, result),
  saveSystemMapFile: (content: string, defaultName?: string) => 
    ipcRenderer.invoke(IpcChannel.DIALOG_SAVE_FILE, { content, defaultName }),

  // Yerel Önizleme Sunucusu (127.0.0.1 HTTP)
  startPreviewServer: (targetPath: string) => ipcRenderer.invoke(IpcChannel.SERVER_START_PREVIEW, targetPath),
  stopPreviewServer: () => ipcRenderer.invoke(IpcChannel.SERVER_STOP_PREVIEW),

  // Klonlama süreci dinleyicileri
  onProgress: (callback: Callback) => {
    const sub = (_event: any, data: any) => callback(_event, data);
    ipcRenderer.on(IpcChannel.CLONE_PROGRESS, sub);
    return () => ipcRenderer.removeListener(IpcChannel.CLONE_PROGRESS, sub);
  },
  onFileAdded: (callback: Callback) => {
    const sub = (_event: any, data: any) => callback(_event, data);
    ipcRenderer.on(IpcChannel.CLONE_FILE_ADDED, sub);
    return () => ipcRenderer.removeListener(IpcChannel.CLONE_FILE_ADDED, sub);
  },
  onLog: (callback: Callback) => {
    const sub = (_event: any, data: any) => callback(_event, data);
    ipcRenderer.on(IpcChannel.CLONE_LOG, sub);
    return () => ipcRenderer.removeListener(IpcChannel.CLONE_LOG, sub);
  },
  onComplete: (callback: Callback) => {
    const sub = (_event: any, data: any) => callback(_event, data);
    ipcRenderer.on(IpcChannel.CLONE_COMPLETE, sub);
    return () => ipcRenderer.removeListener(IpcChannel.CLONE_COMPLETE, sub);
  },
  onError: (callback: Callback) => {
    const sub = (_event: any, data: any) => callback(_event, data);
    ipcRenderer.on(IpcChannel.CLONE_ERROR, sub);
    return () => ipcRenderer.removeListener(IpcChannel.CLONE_ERROR, sub);
  }
});
