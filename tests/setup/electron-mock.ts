import os from 'node:os';

export const app = {
  isPackaged: false,
  getVersion: () => '2.0.0',
  getPath: () => os.tmpdir(),
  on: () => {},
  whenReady: async () => {},
  quit: () => {},
};

export const ipcMain = {
  handle: () => {},
  on: () => {},
  removeHandler: () => {},
  removeAllListeners: () => {},
};

export const ipcRenderer = {
  invoke: async () => undefined,
  on: () => {},
  removeListener: () => {},
};

export const contextBridge = {
  exposeInMainWorld: () => {},
};

export const shell = {
  openPath: async () => '',
  openExternal: async () => {},
  showItemInFolder: () => {},
};

export const dialog = {
  showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
  showSaveDialog: async () => ({ canceled: true, filePath: undefined }),
};

export class BrowserWindow {
  static getAllWindows() {
    return [];
  }
  static getFocusedWindow() {
    return null;
  }
}

export const session = undefined;
