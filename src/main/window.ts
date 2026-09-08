import { BrowserWindow } from 'electron';
import { join } from 'path';
import { is } from '@electron-toolkit/utils';
// @ts-ignore: Asset import handled by Vite
import icon from '../../resources/icon.png?asset';

/**
 * Uygulamanın ana tarayıcı penceresini oluşturur.
 */
export function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    icon: icon,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#08090C',
      symbolColor: '#A1A1AA',
      height: 36
    },
    backgroundColor: '#08090C',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Geliştirme ortamında dev sunucusu, üretimde derlenmiş statik bundle
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else if (process.env['VITE_DEV_SERVER_URL']) {
    mainWindow.loadURL(process.env['VITE_DEV_SERVER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
}
