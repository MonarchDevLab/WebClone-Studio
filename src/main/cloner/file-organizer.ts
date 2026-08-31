import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sanitizeFilename from 'sanitize-filename';

export interface FileOrganizerConfig {
  baseOutputDir: string;
  projectName?: string;
  targetUrl: string;
}

export interface FolderStructure {
  projectDir: string;
  metaDir: string;
  screenshotsDir: string;
  siteDir: string;
}

/**
 * İndirilen sitelerin kusursuz, gezilebilir ve offline çalışabilir dosya düzenini yönetir.
 */
export class FileOrganizer {
  private config: FileOrganizerConfig;
  private folders: FolderStructure;

  constructor(config: FileOrganizerConfig) {
    this.config = config;
    const dateSlug = new Date().toISOString().split('T')[0];
    const rawName = config.projectName?.trim() || new URL(config.targetUrl).hostname;
    const safeName = sanitizeFilename(rawName.replace(/[^a-zA-Z0-9.-]/g, '_')) || 'site';
    const projectFolderName = `${safeName}_${dateSlug}`;
    
    const projectDir = path.join(config.baseOutputDir, projectFolderName);
    const metaDir = path.join(projectDir, '_meta');
    const screenshotsDir = path.join(projectDir, '_screenshots');
    const siteDir = path.join(projectDir, 'site');

    this.folders = {
      projectDir,
      metaDir,
      screenshotsDir,
      siteDir,
    };
  }

  /**
   * Temel klasör yapısını disk üzerinde güvenle oluşturur.
   */
  public async initializeDirectories(): Promise<FolderStructure> {
    await fs.promises.mkdir(this.folders.projectDir, { recursive: true });
    await fs.promises.mkdir(this.folders.metaDir, { recursive: true });
    await fs.promises.mkdir(this.folders.screenshotsDir, { recursive: true });
    await fs.promises.mkdir(this.folders.siteDir, { recursive: true });
    return this.folders;
  }

  public getFolders(): FolderStructure {
    return this.folders;
  }

  /**
   * Bir URL'yi lokal dosya yoluyla eşleştirir (Düzenli, tür bazlı ve temiz klasörleme).
   */
  public mapUrlToLocalPath(assetUrl: string, targetOrigin: string, assetType: string = 'other'): {
    absolutePath: string;
    relativePathFromSiteRoot: string;
    isExternal: boolean;
  } {
    try {
      const parsed = new URL(assetUrl);
      const isExternal = parsed.origin !== new URL(targetOrigin).origin;

      // 1. HTML Sayfaları İçin Düzen
      if (assetType === 'html') {
        let subPath = parsed.pathname || '';
        if (!subPath || subPath === '/') {
          subPath = 'index.html';
        } else if (subPath.endsWith('/')) {
          subPath = `${subPath}index.html`;
        } else if (!path.extname(subPath)) {
          subPath = `${subPath}.html`;
        }

        // Eğer URL'de sorgu parametreleri varsa (?page=2 gibi), üzerine yazmayı önleyen benzersiz hash ekle
        if (parsed.search && parsed.search.length > 1) {
          const queryHash = crypto.createHash('md5').update(parsed.search).digest('hex').slice(0, 8);
          const ext = path.extname(subPath) || '.html';
          const base = subPath.slice(0, subPath.length - ext.length);
          subPath = `${base}_q${queryHash}${ext}`;
        }

        // Temizle ve başında slash varsa kaldır
        subPath = subPath.replace(/^\/+/, '');
        const cleanHtmlParts = subPath.split('/').map(p => sanitizeFilename(p)).filter(Boolean);
        const relPath = cleanHtmlParts.length > 0 ? path.join(...cleanHtmlParts) : 'index.html';
        const absolutePath = path.join(this.folders.siteDir, relPath);
        const relativePathFromSiteRoot = cleanHtmlParts.join('/');

        return {
          absolutePath,
          relativePathFromSiteRoot,
          isExternal: false,
        };
      }

      // 2. Statik Varlıklar İçin Temiz ve Düzenli Dosyalama (assets/{type}/...)
      const typeFolder = assetType === 'image' ? 'images' 
        : assetType === 'media' ? 'media'
        : ['css', 'js', 'font'].includes(assetType) ? `${assetType === 'font' ? 'fonts' : assetType}`
        : 'other';

      // Dosya adı ve uzantı ayıklama
      let rawFilename = path.basename(parsed.pathname) || 'asset';
      // URL parametrelerini dosya adından temizle
      rawFilename = rawFilename.split('?')[0].split('#')[0];

      let ext = path.extname(rawFilename);
      let baseName = path.basename(rawFilename, ext);

      // Eksik uzantı tamamlama
      if (!ext) {
        if (assetType === 'css') ext = '.css';
        else if (assetType === 'js') ext = '.js';
        else if (assetType === 'font') ext = '.woff2';
        else if (assetType === 'image') ext = '.png';
      }

      const safeBase = sanitizeFilename(baseName).slice(0, 40) || 'file';
      const safeExt = sanitizeFilename(ext) || '';
      // İsim çakışmalarını önleyen benzersiz 8 haneli MD5 hash
      const shortHash = crypto.createHash('md5').update(assetUrl).digest('hex').slice(0, 8);
      const finalFileName = `${safeBase}_${shortHash}${safeExt}`;

      let relPath: string;
      let relativePathFromSiteRoot: string;

      if (isExternal) {
        const hostFolder = sanitizeFilename(parsed.hostname);
        relPath = path.join('assets', 'vendor', hostFolder, typeFolder, finalFileName);
        relativePathFromSiteRoot = path.posix.join('assets', 'vendor', hostFolder, typeFolder, finalFileName);
      } else {
        relPath = path.join('assets', typeFolder, finalFileName);
        relativePathFromSiteRoot = path.posix.join('assets', typeFolder, finalFileName);
      }

      const absolutePath = path.join(this.folders.siteDir, relPath);

      return {
        absolutePath,
        relativePathFromSiteRoot,
        isExternal,
      };
    } catch {
      // Güvenli Fallback
      const safeFallback = sanitizeFilename(assetUrl.replace(/[^a-zA-Z0-9.-]/g, '_')).slice(0, 50);
      const typeFolder = assetType === 'image' ? 'images' : (assetType !== 'html' ? assetType : 'html');
      const absolutePath = path.join(this.folders.siteDir, 'assets', typeFolder, safeFallback);
      return {
        absolutePath,
        relativePathFromSiteRoot: path.posix.join('assets', typeFolder, safeFallback),
        isExternal: false,
      };
    }
  }

  /**
   * Dosyayı diske yazar, gerekirse ara dizinleri otomatik oluşturur.
   */
  public async writeAsset(absolutePath: string, buffer: Buffer): Promise<void> {
    const parentDir = path.dirname(absolutePath);
    await fs.promises.mkdir(parentDir, { recursive: true });
    await fs.promises.writeFile(absolutePath, buffer);
  }

  /**
   * Meta dosyası kaydeder (_meta klasörüne).
   */
  public async writeMetaFile(filename: string, content: string | object): Promise<string> {
    const filePath = path.join(this.folders.metaDir, filename);
    const data = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    await fs.promises.writeFile(filePath, data, 'utf-8');
    return filePath;
  }
}
