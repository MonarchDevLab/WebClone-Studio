import { BrowserWindow, shell } from 'electron';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { is } from '@electron-toolkit/utils';
// @ts-ignore: Asset import handled by Vite
import icon from '../../resources/icon-256.png?asset';

/**
 * Checks whether navigation stays within the trusted application shell origin.
 */
export function isAllowedAppNavigation(targetUrl: string): boolean {
  const devUrl = process.env['ELECTRON_RENDERER_URL'] || process.env['VITE_DEV_SERVER_URL'];
  if (is.dev && devUrl) {
    return targetUrl.startsWith(devUrl);
  }
  const prodHtmlUrl = pathToFileURL(join(__dirname, '../renderer/index.html')).toString();
  return targetUrl === prodHtmlUrl || targetUrl.startsWith(`${prodHtmlUrl}#`);
}

/**
 * Creates the hardened main desktop application window.
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
      height: 36,
    },
    backgroundColor: '#08090C',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Block external popups and route explicit https:// links safely via OS browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Prevent main application window with preload bridge from navigating to untrusted origins
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (!isAllowedAppNavigation(targetUrl)) {
      event.preventDefault();
    }
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else if (process.env['VITE_DEV_SERVER_URL']) {
    mainWindow.loadURL(process.env['VITE_DEV_SERVER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
}
