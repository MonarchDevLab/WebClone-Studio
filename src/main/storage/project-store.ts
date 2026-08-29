import fs from 'fs';
import path from 'path';
import { shell } from 'electron';
import { ProjectInfo, ProjectManifest } from '../../shared/types';
import { SettingsStore } from './settings-store';
import { PreviewServer } from '../server/preview-server';

export class ProjectStore {
  private static instance: ProjectStore;

  public static getInstance(): ProjectStore {
    if (!ProjectStore.instance) {
      ProjectStore.instance = new ProjectStore();
    }
    return ProjectStore.instance;
  }

  /**
   * Varsayılan kayıt dizini altındaki tüm manifest.json içeren klonlanmış projeleri listeler.
   */
  public async listProjects(): Promise<ProjectInfo[]> {
    const settings = SettingsStore.getInstance().get();
    const baseDir = settings.defaultOutputDir;

    if (!fs.existsSync(baseDir)) {
      return [];
    }

    try {
      const entries = await fs.promises.readdir(baseDir, { withFileTypes: true });
      const projects: ProjectInfo[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const projectDir = path.join(baseDir, entry.name);
          const manifestPath = path.join(projectDir, 'manifest.json');

          if (fs.existsSync(manifestPath)) {
            try {
              const rawData = await fs.promises.readFile(manifestPath, 'utf-8');
              const manifest: ProjectManifest = JSON.parse(rawData);

              const screenshotRelative = manifest.screenshotPath;
              const screenshotAbsPath = screenshotRelative
                ? path.join(projectDir, screenshotRelative)
                : undefined;

              projects.push({
                id: manifest.project?.slug || entry.name,
                name: manifest.project?.name || entry.name,
                slug: entry.name,
                url: manifest.source?.url || '',
                domain: manifest.source?.domain || '',
                createdAt: manifest.project?.createdAt ? new Date(manifest.project.createdAt).getTime() : Date.now(),
                completedAt: manifest.project?.completedAt ? new Date(manifest.project.completedAt).getTime() : undefined,
                totalFiles: manifest.statistics?.totalFiles || 0,
                totalSize: manifest.statistics?.totalSizeBytes || 0,
                screenshotPath: (screenshotAbsPath && fs.existsSync(screenshotAbsPath)) ? screenshotAbsPath : undefined,
                outputPath: projectDir,
              });
            } catch (err) {
              console.warn(`[ProjectStore] Manifest okunamadı (${manifestPath}):`, err);
            }
          }
        }
      }

      // En yeni projeler en üstte
      return projects.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error('[ProjectStore] Proje listeleme hatası:', error);
      return [];
    }
  }

  public async deleteProject(projectPath: string): Promise<boolean> {
    try {
      if (fs.existsSync(projectPath)) {
        await fs.promises.rm(projectPath, { recursive: true, force: true });
        return true;
      }
      return false;
    } catch (e) {
      console.error('[ProjectStore] Proje silme hatası:', e);
      return false;
    }
  }

  public async openProject(projectPath: string): Promise<boolean> {
    try {
      const siteSubdir = path.join(projectPath, 'site');
      const folderToServe = fs.existsSync(siteSubdir) ? siteSubdir : projectPath;
      if (fs.existsSync(folderToServe)) {
        try {
          const url = await PreviewServer.getInstance().start(folderToServe);
          await shell.openExternal(url);
          return true;
        } catch (serverErr) {
          console.warn('[ProjectStore] PreviewServer başlatılamadı, doğrudan shell.openPath fallback:', serverErr);
        }
      }

      const indexFile = path.join(projectPath, 'site', 'index.html');
      if (fs.existsSync(indexFile)) {
        await shell.openPath(indexFile);
        return true;
      } else if (fs.existsSync(projectPath)) {
        await shell.openPath(projectPath);
        return true;
      }
      return false;
    } catch (e) {
      console.error('[ProjectStore] Proje açma hatası:', e);
      return false;
    }
  }
}
