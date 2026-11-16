import { BrowserWindow, dialog, shell } from 'electron';
import fs from 'node:fs';
import { IpcChannel } from '../../shared/ipc-channels';
import { AnalyzeResult, AppSettings, AppUpdateInfo } from '../../shared/types';
import { validateHttpUrlShape } from '../../shared/validators';
import { SystemMapGenerator } from '../generators/system-map-generator';
import { UpdateChecker } from '../services/update-checker';
import { handleSecure } from '../security/ipc-guard';
import { assertSafeShellOpenFile } from '../security/path-guard';
import { IpcRuntimeContext } from './context';

export function registerSettingsAndShellIpc(ctx: IpcRuntimeContext): void {
  handleSecure<string, boolean>(IpcChannel.SHELL_OPEN_FOLDER, async (_event, folderPath) => {
    const resolved = fs.existsSync(folderPath) ? folderPath : '';
    if (!resolved) return false;
    await shell.openPath(resolved);
    return true;
  });

  handleSecure<string, boolean>(IpcChannel.SHELL_OPEN_FILE, async (_event, filePath) => {
    try {
      const safePath = await assertSafeShellOpenFile(filePath);
      await shell.openPath(safePath);
      return true;
    } catch (error) {
      console.error('[IPC] Dosya açma engellendi:', error);
      return false;
    }
  });

  handleSecure<string, boolean>(IpcChannel.SHELL_OPEN_EXTERNAL, async (_event, externalUrl) => {
    try {
      const parsed = validateHttpUrlShape(externalUrl);
      if (parsed.protocol !== 'https:') return false;
      await shell.openExternal(parsed.toString());
      return true;
    } catch (error) {
      console.error('[IPC] Harici URL açma hatası:', error);
      return false;
    }
  });

  handleSecure<void, AppSettings>(IpcChannel.SETTINGS_GET, () => {
    return ctx.settingsStore.get();
  });

  handleSecure<Partial<AppSettings>, AppSettings>(
    IpcChannel.SETTINGS_SET,
    (_event, newSettings) => {
      return ctx.settingsStore.set(newSettings);
    }
  );

  handleSecure<AnalyzeResult | undefined, string>(
    IpcChannel.EXPORT_SYSTEM_MAP,
    (_event, customResult) => {
      const targetResult = customResult || ctx.lastAnalyzeResult;
      if (!targetResult) {
        throw new Error('Henüz analiz edilmiş bir web sitesi verisi bulunmuyor.');
      }
      return SystemMapGenerator.generate(targetResult);
    }
  );

  handleSecure<
    { content: string; defaultName?: string },
    { success: boolean; filePath?: string; canceled?: boolean }
  >(IpcChannel.DIALOG_SAVE_FILE, async (_event, { content, defaultName }) => {
    const parentWindow = ctx.mainWindow || BrowserWindow.getFocusedWindow() || undefined;
    const result = await dialog.showSaveDialog(parentWindow as any, {
      title: 'Sistem Haritasını (.md) Kaydet',
      defaultPath: defaultName || 'SYSTEM_MAP.md',
      filters: [{ name: 'Markdown Dosyası (*.md)', extensions: ['md'] }],
    });
    if (!result.canceled && result.filePath) {
      await fs.promises.writeFile(result.filePath, content, 'utf-8');
      return { success: true, filePath: result.filePath };
    }
    return { success: false, canceled: true };
  });

  handleSecure<void, AppUpdateInfo>(IpcChannel.APP_CHECK_UPDATE, async () => {
    return await UpdateChecker.checkForUpdates();
  });

  handleSecure<void, string>(IpcChannel.APP_GET_VERSION, () => {
    return UpdateChecker.getCurrentVersion();
  });
}
