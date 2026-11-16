import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';

import { AppSettings } from '../../shared/types';
import { buildDefaultUserAgent } from '../../shared/version';
import { sanitizeSettingsPatch } from '../../shared/validators';
export type { AppSettings };

function resolveDefaultDownloadDir(): string {
  try {
    if (app) {
      return path.join(app.getPath('downloads'), 'WebClone');
    }
  } catch {
    // fallback
  }
  if (process.env.USERPROFILE) {
    return path.join(process.env.USERPROFILE, 'Downloads', 'WebClone');
  }
  return path.join(os.homedir(), 'Downloads', 'WebClone');
}

function resolveAppDataDir(): string {
  if (process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, 'WebCloneStudio');
  }
  try {
    if (app) {
      return app.getPath('userData');
    }
  } catch {
    // fallback
  }
  return path.join(os.homedir(), '.webclone-studio');
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultOutputDir: resolveDefaultDownloadDir(),
  userAgent: buildDefaultUserAgent(),
  defaultThreads: 5,
  defaultRateLimit: 200,
  defaultDownloadImages: true,
  defaultDownloadFonts: true,
  defaultDownloadMedia: true,
  defaultDownloadDocuments: true,
  defaultDownloadArchives: true,
  defaultDownloadData: true,
  defaultCrawlSubdomains: false,
  defaultDownloadExternalAssets: true,
  defaultReverseEngineering: true,
  allowLocalhostTargets: false,
  defaultExportWacz: false,
};

export class SettingsStore {
  private static instance: SettingsStore;
  private settingsFilePath: string;
  private currentSettings: AppSettings;

  private constructor() {
    try {
      const userDataDir = resolveAppDataDir();
      if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
      }
      this.settingsFilePath = path.join(userDataDir, 'settings.json');
    } catch {
      this.settingsFilePath = path.join(os.homedir(), '.webclone-settings.json');
    }

    this.currentSettings = this.load();
  }

  public static getInstance(): SettingsStore {
    if (!SettingsStore.instance) {
      SettingsStore.instance = new SettingsStore();
    }
    return SettingsStore.instance;
  }

  private load(): AppSettings {
    try {
      if (fs.existsSync(this.settingsFilePath)) {
        const raw = fs.readFileSync(this.settingsFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            ...DEFAULT_SETTINGS,
            ...sanitizeSettingsPatch(parsed),
          };
        }
      }
    } catch (e) {
      console.warn('[SettingsStore] Ayarlar okunamadı, varsayılanlar kullanılıyor:', e);
    }
    return { ...DEFAULT_SETTINGS };
  }

  public get(): AppSettings {
    return { ...this.currentSettings };
  }

  public set(newSettings: Partial<AppSettings>): AppSettings {
    const sanitized = sanitizeSettingsPatch(newSettings);
    this.currentSettings = {
      ...this.currentSettings,
      ...sanitized,
    };

    // Asenkron ve bloke etmeyen disk kaydı
    fs.promises.writeFile(this.settingsFilePath, JSON.stringify(this.currentSettings, null, 2), 'utf-8')
      .catch((e) => console.error('[SettingsStore] Ayarlar kaydedilemedi:', e));

    return { ...this.currentSettings };
  }
}
