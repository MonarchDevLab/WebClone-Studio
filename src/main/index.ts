import { app, BrowserWindow } from 'electron';
import { createWindow } from './window';
import { registerIpcHandlers } from './ipc-handlers';
import { WindowPool } from './browser/window-pool';
import { PreviewServer } from './server/preview-server';

app
  .whenReady()
  .then(() => {
    const mainWindow = createWindow();
    registerIpcHandlers(mainWindow);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  })
  .catch((err) => {
    console.error('[Main] Application startup error:', err);
  });

app.on('before-quit', () => {
  WindowPool.getInstance().destroyAll();
  void PreviewServer.getInstance().stop();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
