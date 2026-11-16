import { BrowserWindow, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { IpcChannel } from '../../shared/ipc-channels';
import { PageRenderer, PageRenderCookie } from '../browser/page-renderer';
import { PreviewServer } from '../server/preview-server';
import { handleSecure } from '../security/ipc-guard';
import { IpcRuntimeContext } from './context';

export function registerPreviewIpc(ctx: IpcRuntimeContext): void {
  handleSecure<
    string | { targetPath: string; openExternal?: boolean },
    { success: boolean; url?: string; error?: string }
  >(IpcChannel.SERVER_START_PREVIEW, async (_event, payload) => {
    const rawTarget = typeof payload === 'string' ? payload : payload?.targetPath || '';
    const openExternal = typeof payload === 'string' ? true : payload?.openExternal !== false;
    try {
      let folderToServe = rawTarget.trim();
      if (fs.existsSync(folderToServe) && fs.statSync(folderToServe).isFile()) {
        folderToServe = path.dirname(folderToServe);
      }
      const siteSubdir = path.join(folderToServe, 'site');
      if (fs.existsSync(siteSubdir) && fs.statSync(siteSubdir).isDirectory()) {
        folderToServe = siteSubdir;
      }

      const serverUrl = await PreviewServer.getInstance().start(folderToServe);
      if (openExternal) {
        await shell.openExternal(serverUrl);
      }
      return { success: true, url: serverUrl };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  handleSecure<void, { success: boolean }>(IpcChannel.SERVER_STOP_PREVIEW, async () => {
    await PreviewServer.getInstance().stop();
    return { success: true };
  });

  handleSecure<string, { cookieCount: number; cookies: PageRenderCookie[] }>(
    IpcChannel.AUTH_OPEN_SESSION,
    async (_event, targetUrl) => {
      const parentWin = ctx.mainWindow || BrowserWindow.getFocusedWindow() || undefined;
      const appSettings = ctx.settingsStore.get();
      return await PageRenderer.openAuthSession(targetUrl, parentWin, {
        allowLocalhostTargets: Boolean(appSettings.allowLocalhostTargets),
      });
    }
  );
}
