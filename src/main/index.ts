import { app, BrowserWindow } from 'electron';
import { createWindow } from './window';
import { registerIpcHandlers } from './ipc-handlers';

/**
 * Uygulama hazır olduğunda pencereyi oluşturur ve IPC handler'larını kaydeder.
 */
app.whenReady().then(() => {
  const mainWindow = createWindow();
  registerIpcHandlers(mainWindow);

  // macOS desteği - pencere yoksa ve uygulamaya tıklanırsa yeni pencere aç
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}).catch((err) => {
  console.error('[Main] Uygulama başlatma hatası:', err);
});

/**
 * Tüm pencereler kapatıldığında macOS hariç uygulamadan çık.
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
