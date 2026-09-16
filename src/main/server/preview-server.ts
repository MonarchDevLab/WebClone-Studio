import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';

const MIME_MAP: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

/**
 * Klonlanan web sitelerini `file:///` CORS kısıtlamalarına takılmadan
 * gerçek bir yerel HTTP sunucusu üzerinden yayınlayan hafif mikro sunucu.
 */
export class PreviewServer {
  private static instance: PreviewServer;
  private server: http.Server | null = null;
  private currentRoot: string = '';
  private currentUrl: string | null = null;

  public static getInstance(): PreviewServer {
    if (!PreviewServer.instance) {
      PreviewServer.instance = new PreviewServer();
    }
    return PreviewServer.instance;
  }

  /**
   * Belirtilen klasörü 127.0.0.1 üzerinde rastgele müsait bir portta yayına alır.
   */
  public async start(folderPath: string): Promise<string> {
    const rootDir = path.resolve(folderPath);

    // Eğer zaten aynı klasör yayındaysa mevcut URL'i dön
    if (this.server && this.currentRoot === rootDir && this.currentUrl) {
      return this.currentUrl;
    }

    // Önceki sunucu varsa kapat
    await this.stop();

    this.currentRoot = rootDir;

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        // CORS başlıkları (ES Modülleri ve font yüklemeleri için zorunlu)
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        try {
          const parsedUrl = url.parse(req.url || '/');
          let pathname = decodeURIComponent(parsedUrl.pathname || '/');

          // Null byte injection denetimi
          if (pathname.includes('\0')) {
            res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('400 - Geçersiz İstek (Null byte engellendi)');
            return;
          }

          // Dizin yolu güvenliği kontrolü (Directory traversal engeli)
          let targetPath = path.normalize(path.join(this.currentRoot, pathname));
          const relative = path.relative(this.currentRoot, targetPath);

          if (relative.startsWith('..') || path.isAbsolute(relative)) {
            res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('403 - Erişim Engellendi');
            return;
          }

          // 1. Eğer dizin isteniyorsa index.html ara
          if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
            targetPath = path.join(targetPath, 'index.html');
          }

          // 2. Temiz URL, trailing slash ve uzantısız rota çözümlemesi
          if (!fs.existsSync(targetPath)) {
            const trimmedPath = targetPath.replace(/[/\\]+$/, '');
            if (fs.existsSync(`${trimmedPath}.html`)) {
              targetPath = `${trimmedPath}.html`;
            } else if (fs.existsSync(path.join(trimmedPath, 'index.html'))) {
              targetPath = path.join(trimmedPath, 'index.html');
            } else {
              // 3. SPA Rota Fallback (React Router / Vue Router desteği)
              const rootIndex = path.join(this.currentRoot, 'index.html');
              const acceptHeader = (req.headers['accept'] as string) || '';
              if (fs.existsSync(rootIndex) && !path.extname(pathname) && (acceptHeader.includes('text/html') || !acceptHeader)) {
                targetPath = rootIndex;
              }
            }
          }

          if (!fs.existsSync(targetPath) || fs.statSync(targetPath).isDirectory()) {
            const custom404 = path.join(this.currentRoot, '_404.html');
            if (fs.existsSync(custom404)) {
              res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
              const content = fs.readFileSync(custom404, 'utf-8');
              res.end(content);
              return;
            }

            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <!DOCTYPE html>
              <html>
              <head><meta charset="utf-8"><title>404 - Sayfa Bulunamadı</title></head>
              <body style="background:#08090C;color:#F1F5F9;font-family:sans-serif;padding:40px;text-align:center;">
                <h1 style="color:#F43F5E;">404 - Sayfa Bulunamadı</h1>
                <p>İstenen varlık yerel klon klasöründe mevcut değil: <code>${pathname}</code></p>
                <hr style="border-color:#1E293B;margin:20px 0;">
                <p style="color:#64748B;font-size:12px;">WebClone Studio Yerel Önizleme Sunucusu</p>
              </body>
              </html>
            `);
            return;
          }

          const ext = path.extname(targetPath).toLowerCase();
          const contentType = MIME_MAP[ext] || 'application/octet-stream';

          res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          });

          const readStream = fs.createReadStream(targetPath);
          readStream.on('error', (streamErr) => {
            console.warn('[PreviewServer] Dosya okuma akış hatası:', streamErr);
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            }
            res.end();
          });
          res.on('close', () => {
            readStream.destroy();
          });
          readStream.pipe(res);
        } catch (err) {
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          }
          res.end('500 - Sunucu Hatası');
        }
      });

      // Port 0: İşletim sistemi boş bir port atar
      this.server.listen(0, '127.0.0.1', () => {
        const address = this.server?.address() as any;
        const port = address?.port;
        this.currentUrl = `http://127.0.0.1:${port}/`;
        console.log(`[PreviewServer] Yerel web sunucusu başlatıldı: ${this.currentUrl} (Hedef: ${this.currentRoot})`);
        resolve(this.currentUrl);
      });

      this.server.on('error', (err) => {
        console.error('[PreviewServer] Sunucu başlatılamadı:', err);
        reject(err);
      });
    });
  }

  /**
   * Çalışan sunucuyu durdurur.
   */
  public async stop(): Promise<void> {
    if (this.server) {
      if (typeof (this.server as any).closeAllConnections === 'function') {
        (this.server as any).closeAllConnections();
      }
      return new Promise((resolve) => {
        this.server?.close(() => {
          this.server = null;
          this.currentUrl = null;
          console.log('[PreviewServer] Yerel web sunucusu durduruldu.');
          resolve();
        });
      });
    }
  }

  /**
   * Aktif sunucu URL'i
   */
  public getUrl(): string | null {
    return this.currentUrl;
  }
}
