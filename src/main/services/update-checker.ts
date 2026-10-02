import got from 'got';
import { app } from 'electron';
import { AppUpdateInfo, AppUpdateAsset } from '../../shared/types';

export class UpdateChecker {
  private static GITHUB_REPO = 'MonarchDevLab/WebClone-Studio';

  /**
   * Mevcut uygulama sürümünü döndürür.
   */
  public static getCurrentVersion(): string {
    try {
      if (app && app.isPackaged) {
        return app.getVersion();
      }
    } catch {}
    // Fallback veya geliştirme ortamı sürümü
    return '1.0.0';
  }

  /**
   * GitHub API üzerinden en son yayınlanmış sürümü sorgular ve karşılaştırır.
   */
  public static async checkForUpdates(): Promise<AppUpdateInfo> {
    const currentVersion = this.getCurrentVersion();
    const apiUrl = `https://api.github.com/repos/${this.GITHUB_REPO}/releases/latest`;

    try {
      const response = await got.get(apiUrl, {
        headers: {
          'User-Agent': 'WebCloneStudio-Updater',
          'Accept': 'application/vnd.github.v3+json',
        },
        timeout: {
          request: 8000,
        },
        responseType: 'json',
      });

      const release = response.body as any;
      if (!release || !release.tag_name) {
        return {
          hasUpdate: false,
          currentVersion,
          latestVersion: currentVersion,
        };
      }

      const latestTag = String(release.tag_name).trim();
      const latestVersion = latestTag.replace(/^v/i, '');
      const hasUpdate = this.compareVersions(latestVersion, currentVersion) > 0;

      const assets: AppUpdateAsset[] = Array.isArray(release.assets)
        ? release.assets.map((a: any) => ({
            name: a.name,
            downloadUrl: a.browser_download_url,
            size: a.size,
            downloadCount: a.download_count || 0,
          }))
        : [];

      const totalDownloads = assets.reduce((sum, a) => sum + (a.downloadCount || 0), 0);

      return {
        hasUpdate,
        currentVersion,
        latestVersion,
        releaseName: release.name || latestTag,
        releaseNotes: release.body || '',
        publishedAt: release.published_at,
        htmlUrl: release.html_url || `https://github.com/${this.GITHUB_REPO}/releases`,
        assets,
        totalDownloads,
      };
    } catch (err: any) {
      // 404 (henüz release açılmamışsa) veya internet bağlantısı yoksa
      if (err.response?.statusCode === 404) {
        return {
          hasUpdate: false,
          currentVersion,
          latestVersion: currentVersion,
          releaseNotes: 'GitHub üzerinde henüz yayınlanmış bir sürüm bulunmuyor.',
        };
      }

      return {
        hasUpdate: false,
        currentVersion,
        latestVersion: currentVersion,
        error: `Güncelleme kontrolü başarısız: ${err.message || 'Bağlantı hatası'}`,
      };
    }
  }

  /**
   * Basit semver karşılaştırması: v1 > v2 ise 1, v1 < v2 ise -1, eşitse 0 döner.
   */
  private static compareVersions(v1: string, v2: string): number {
    const p1 = v1.split('.').map((n) => parseInt(n, 10) || 0);
    const p2 = v2.split('.').map((n) => parseInt(n, 10) || 0);

    const len = Math.max(p1.length, p2.length);
    for (let i = 0; i < len; i++) {
      const num1 = p1[i] || 0;
      const num2 = p2[i] || 0;
      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }
    return 0;
  }
}
