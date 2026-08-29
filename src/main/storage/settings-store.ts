import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';

export interface AppSettings {
  defaultOutputDir: string;
  userAgent: string;
  defaultThreads: number;
  defaultRateLimit: number;
}

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
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 WebCloneStudio/1.0',
  defaultThreads: 5,
  defaultRateLimit: 200,
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
        return { ...DEFAULT_SETTINGS, ...parsed };
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
    this.currentSettings = {
      ...this.currentSettings,
      ...newSettings,
    };

    try {
      fs.writeFileSync(this.settingsFilePath, JSON.stringify(this.currentSettings, null, 2), 'utf-8');
    } catch (e) {
      console.error('[SettingsStore] Ayarlar kaydedilemedi:', e);
    }

    return { ...this.currentSettings };
  }
}
