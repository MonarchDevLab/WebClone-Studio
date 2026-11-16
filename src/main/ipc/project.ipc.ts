import { BrowserWindow, dialog } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { IpcChannel } from '../../shared/ipc-channels';
import { ProjectInfo, SizeEstimate } from '../../shared/types';
import { handleSecure } from '../security/ipc-guard';
import { getDynamicFolder, IpcRuntimeContext } from './context';

export function registerProjectIpc(ctx: IpcRuntimeContext): void {
  handleSecure<void, string | null>(IpcChannel.DIALOG_SELECT_DIR, async () => {
    const parentWindow = ctx.mainWindow || BrowserWindow.getFocusedWindow() || undefined;
    const result = await dialog.showOpenDialog(parentWindow as any, {
      title: 'Klonlama Hedef Klasörünü Seçin',
      defaultPath: ctx.settingsStore.get().defaultOutputDir || getDynamicFolder('downloads'),
      properties: ['openDirectory', 'createDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  handleSecure<{ url: string; depth: number }, SizeEstimate>(
    IpcChannel.DIALOG_ESTIMATE,
    async (_event, { url, depth }) => {
      try {
        let isSameHost = false;
        try {
          isSameHost = Boolean(
            ctx.lastAnalyzeResult?.siteMap?.url &&
              new URL(ctx.lastAnalyzeResult.siteMap.url).hostname === new URL(url).hostname
          );
        } catch {}

        const estimate = await ctx.sizeEstimator.estimate(
          url,
          depth,
          isSameHost ? ctx.lastAnalyzeResult : null
        );
        let freeSpaceBytes = 100 * 1024 * 1024 * 1024;
        try {
          const targetPath =
            ctx.settingsStore.get().defaultOutputDir ||
            (process.env.LOCALAPPDATA
              ? path.join(process.env.LOCALAPPDATA, 'WebCloneStudio')
              : os.homedir());
          if (fs.existsSync(targetPath) && typeof fs.promises.statfs === 'function') {
            const stat = await fs.promises.statfs(targetPath);
            freeSpaceBytes = stat.bavail * stat.bsize;
          }
        } catch {}

        return {
          ...estimate,
          freeSpaceBytes,
          hasSufficientDisk: freeSpaceBytes > estimate.estimatedSizeBytes * 2,
        };
      } catch {
        const fallbackPages = depth === 1 ? 5 : depth === 2 ? 18 : 45;
        const fallbackAssets = fallbackPages * 18;
        const fallbackBytes = fallbackPages * 25000 + fallbackAssets * 110 * 1024;
        return {
          estimatedPages: fallbackPages,
          estimatedAssets: fallbackAssets,
          estimatedSizeBytes: fallbackBytes,
          freeSpaceBytes: 50 * 1024 * 1024 * 1024,
          hasSufficientDisk: true,
        };
      }
    }
  );

  handleSecure<void, ProjectInfo[]>(IpcChannel.PROJECTS_LIST, async () => {
    return await ctx.projectStore.listProjects();
  });

  handleSecure<string, boolean>(IpcChannel.PROJECTS_DELETE, async (_event, projectPath) => {
    return await ctx.projectStore.deleteProject(projectPath);
  });

  handleSecure<string, boolean>(IpcChannel.PROJECTS_OPEN, async (_event, projectPath) => {
    return await ctx.projectStore.openProject(projectPath);
  });
}
