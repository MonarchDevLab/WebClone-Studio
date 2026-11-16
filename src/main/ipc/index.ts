import { BrowserWindow } from 'electron';
import { createIpcRuntimeContext } from './context';
import { registerAnalyzeIpc } from './analyze.ipc';
import { registerCloneIpc } from './clone.ipc';
import { registerProjectIpc } from './project.ipc';
import { registerPreviewIpc } from './preview.ipc';
import { registerArtifactsIpc } from './artifacts.ipc';
import { registerSettingsAndShellIpc } from './settings.ipc';

/**
 * Registers all domain-isolated, senderFrame-verified IPC handlers for the desktop application.
 */
export function registerIpcHandlers(mainWindow?: BrowserWindow): void {
  const ctx = createIpcRuntimeContext(mainWindow);
  registerAnalyzeIpc(ctx);
  registerCloneIpc(ctx);
  registerProjectIpc(ctx);
  registerPreviewIpc(ctx);
  registerArtifactsIpc(ctx);
  registerSettingsAndShellIpc(ctx);
}
