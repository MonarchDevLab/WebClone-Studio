import http from 'http';
import fs from 'fs';
import path from 'path';
import { findMockResponse, MockDatabase } from '../cloner/reverse-engineering/api-interceptor';
import { assertInsideRoot } from '../security/path-guard';
import { generateSwReplayScript } from './sw-replay-script';

const MIME_MAP: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.vtt': 'text/vtt; charset=utf-8',
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

function escapeHtml(raw: string): string {
  return (raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Local loopback preview server for offline cloned websites.
 * Enforces canonical path containment (realpath), XSS-safe 404 output, nosniff headers, and cached API mocks.
 */
export class PreviewServer {
  private static instance: PreviewServer;
  private server: http.Server | null = null;
  private currentRoot: string = '';
  private currentUrl: string | null = null;
  private startingPromise: Promise<string> | null = null;
  private mockDbCache: MockDatabase | null = null;
  private urlMapCache: Map<string, string> = new Map();
  private urlMapRawCache: Record<string, string> = {};
  private swReplaySource: string = generateSwReplayScript();

  public static getInstance(): PreviewServer {
    if (!PreviewServer.instance) {
      PreviewServer.instance = new PreviewServer();
    }
    return PreviewServer.instance;
  }

  private async loadMockDb(rootDir: string): Promise<MockDatabase | null> {
    const mockDbPaths = [
      path.join(rootDir, '_meta', 'api-endpoints.json'),
      path.join(rootDir, '..', '_meta', 'api-endpoints.json'),
    ];
    for (const dbPath of mockDbPaths) {
      try {
        if (fs.existsSync(dbPath)) {
          const raw = await fs.promises.readFile(dbPath, 'utf-8');
          return JSON.parse(raw) as MockDatabase;
        }
      } catch {}
    }
    return null;
  }

  private async loadUrlMap(rootDir: string): Promise<{ index: Map<string, string>; raw: Record<string, string> }> {
    const urlMapPaths = [
      path.join(rootDir, '_meta', 'url-map.json'),
      path.join(rootDir, '..', '_meta', 'url-map.json'),
    ];
    for (const mapPath of urlMapPaths) {
      try {
        if (fs.existsSync(mapPath)) {
          const rawStr = await fs.promises.readFile(mapPath, 'utf-8');
          const parsed = JSON.parse(rawStr) as Record<string, string>;
          const index = new Map<string, string>();
          if (parsed && typeof parsed === 'object') {
            for (const [k, v] of Object.entries(parsed)) {
              if (typeof v !== 'string') continue;
              index.set(k, v);
              try {
                const u = new URL(k, 'http://127.0.0.1');
                if (u.search) {
                  const sorted = new URLSearchParams(u.search);
                  sorted.sort();
                  const canonicalKey = `${u.pathname}?${sorted.toString()}`;
                  if (!index.has(canonicalKey)) {
                    index.set(canonicalKey, v);
                  }
                }
              } catch {}
            }
            return { index, raw: parsed };
          }
        }
      } catch {}
    }
    return { index: new Map(), raw: {} };
  }

  /**
   * Starts the loopback preview server on an ephemeral port for folderPath.
   */
  public async start(folderPath: string): Promise<string> {
    const rootDir = await fs.promises.realpath(path.resolve(folderPath));

    if (this.startingPromise) {
      await this.startingPromise.catch(() => {});
    }

    if (this.server && this.currentRoot === rootDir && this.currentUrl) {
      return this.currentUrl;
    }

    this.startingPromise = (async () => {
      await this.stop();
      this.currentRoot = rootDir;
      this.mockDbCache = await this.loadMockDb(rootDir);
      const urlMapLoaded = await this.loadUrlMap(rootDir);
      this.urlMapCache = urlMapLoaded.index;
      this.urlMapRawCache = urlMapLoaded.raw;

      return await new Promise<string>((resolve, reject) => {
        const srv = http.createServer(async (req, res) => {
          const serverOrigin = this.currentUrl ? this.currentUrl.replace(/\/$/, '') : 'http://127.0.0.1';
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader('Access-Control-Allow-Origin', serverOrigin);
          res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');

          if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
          }

          try {
            const parsedReq = new URL(req.url || '/', 'http://127.0.0.1');
            const pathname = decodeURIComponent(parsedReq.pathname || '/');

            if (pathname.includes('\0')) {
              res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
              res.end('400 - Invalid Request');
              return;
            }

            if (pathname === '/_sw-replay.js') {
              res.writeHead(200, {
                'Content-Type': 'application/javascript; charset=utf-8',
                'Service-Worker-Allowed': '/',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'X-Content-Type-Options': 'nosniff',
              });
              res.end(req.method === 'HEAD' ? undefined : this.swReplaySource);
              return;
            }

            if (pathname === '/_meta/url-map.json') {
              const payload = JSON.stringify(this.urlMapRawCache);
              res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'X-Content-Type-Options': 'nosniff',
              });
              res.end(req.method === 'HEAD' ? undefined : payload);
              return;
            }

            if (pathname === '/_meta/api-endpoints.json') {
              const payload = JSON.stringify(this.mockDbCache || {});
              res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'X-Content-Type-Options': 'nosniff',
              });
              res.end(req.method === 'HEAD' ? undefined : payload);
              return;
            }

            const requestKey = `${pathname}${parsedReq.search}`;
            let mappedRelPath = parsedReq.search ? this.urlMapCache.get(requestKey) : undefined;
            if (!mappedRelPath && parsedReq.search) {
              const sorted = new URLSearchParams(parsedReq.search);
              sorted.sort();
              mappedRelPath = this.urlMapCache.get(`${pathname}?${sorted.toString()}`);
            }

            const relRequest = (mappedRelPath || pathname).replace(/^\/+/, '');
            let targetPath = path.resolve(this.currentRoot, relRequest);
            if (mappedRelPath && !fs.existsSync(targetPath)) {
              const siteFallback = path.resolve(this.currentRoot, 'site', relRequest);
              if (fs.existsSync(siteFallback)) {
                targetPath = siteFallback;
              }
            }

            try {
              targetPath = await assertInsideRoot(this.currentRoot, targetPath, true);
            } catch {
              res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
              res.end('403 - Forbidden');
              return;
            }

            if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
              targetPath = path.join(targetPath, 'index.html');
            }

            if (!fs.existsSync(targetPath)) {
              const trimmedPath = targetPath.replace(/[/\\]+$/, '');
              if (fs.existsSync(`${trimmedPath}.html`)) {
                targetPath = `${trimmedPath}.html`;
              } else if (fs.existsSync(path.join(trimmedPath, 'index.html'))) {
                targetPath = path.join(trimmedPath, 'index.html');
              } else {
                const rootIndex = path.join(this.currentRoot, 'index.html');
                const acceptHeader = (req.headers['accept'] as string) || '';
                if (
                  fs.existsSync(rootIndex) &&
                  !path.extname(pathname) &&
                  (acceptHeader.includes('text/html') || !acceptHeader)
                ) {
                  targetPath = rootIndex;
                }
              }
            }

            if (!fs.existsSync(targetPath) || fs.statSync(targetPath).isDirectory()) {
              if (this.mockDbCache) {
                const mock = findMockResponse(this.mockDbCache, pathname, req.method || 'GET');
                if (mock) {
                  res.writeHead(mock.status || 200, {
                    'Content-Type': mock.contentType || 'application/json; charset=utf-8',
                    'X-Content-Type-Options': 'nosniff',
                    'Access-Control-Allow-Origin': serverOrigin,
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                  });
                  const responseBody = typeof mock.data === 'string' ? mock.data : JSON.stringify(mock.data);
                  res.end(responseBody);
                  return;
                }
              }

              const custom404 = path.join(this.currentRoot, '_404.html');
              if (fs.existsSync(custom404)) {
                try {
                  const safe404 = await assertInsideRoot(this.currentRoot, custom404, false);
                  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                  const content = await fs.promises.readFile(safe404, 'utf-8');
                  res.end(content);
                  return;
                } catch {}
              }

              res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(`<!DOCTYPE html>
<html lang="tr">
<head><meta charset="utf-8"><title>404 - Sayfa Bulunamadı</title></head>
<body style="background:#08090C;color:#F1F5F9;font-family:sans-serif;padding:40px;text-align:center;">
  <h1 style="color:#F43F5E;">404 - Sayfa Bulunamadı</h1>
  <p>İstenen varlık yerel klon klasöründe mevcut değil: <code>${escapeHtml(pathname)}</code></p>
  <hr style="border-color:#1E293B;margin:20px 0;">
  <p style="color:#64748B;font-size:12px;">WebClone Studio Yerel Önizleme Sunucusu</p>
</body>
</html>`);
              return;
            }

            // Re-verify resolved file symlink containment inside currentRoot
            let safeTargetPath: string;
            try {
              safeTargetPath = await assertInsideRoot(this.currentRoot, targetPath, false);
            } catch {
              res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
              res.end('403 - Forbidden');
              return;
            }

            const ext = path.extname(safeTargetPath).toLowerCase();
            const contentType = MIME_MAP[ext] || 'application/octet-stream';
            const stat = await fs.promises.stat(safeTargetPath);
            const rangeHeader = req.headers.range;

            if (rangeHeader && typeof rangeHeader === 'string' && rangeHeader.startsWith('bytes=')) {
              const rangeMatch = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
              if (!rangeMatch || (!rangeMatch[1] && !rangeMatch[2])) {
                res.writeHead(416, {
                  'Content-Range': `bytes */${stat.size}`,
                  'Accept-Ranges': 'bytes',
                });
                res.end();
                return;
              }

              const startStr = rangeMatch[1];
              const endStr = rangeMatch[2];
              const start = startStr
                ? parseInt(startStr, 10)
                : Math.max(0, stat.size - parseInt(endStr, 10));
              const end = startStr
                ? endStr
                  ? Math.min(stat.size - 1, parseInt(endStr, 10))
                  : stat.size - 1
                : stat.size - 1;

              if (
                Number.isNaN(start) ||
                Number.isNaN(end) ||
                start < 0 ||
                start > end ||
                start >= stat.size
              ) {
                res.writeHead(416, {
                  'Content-Range': `bytes */${stat.size}`,
                  'Accept-Ranges': 'bytes',
                });
                res.end();
                return;
              }

              const chunkLength = end - start + 1;
              res.writeHead(206, {
                'Content-Type': contentType,
                'Accept-Ranges': 'bytes',
                'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                'Content-Length': String(chunkLength),
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'X-Content-Type-Options': 'nosniff',
              });

              if (req.method === 'HEAD') {
                res.end();
                return;
              }

              const rangeStream = fs.createReadStream(safeTargetPath, { start, end });
              rangeStream.on('error', () => {
                if (!res.headersSent) {
                  res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                }
                res.end();
              });
              res.on('close', () => {
                rangeStream.destroy();
              });
              rangeStream.pipe(res);
              return;
            }

            res.writeHead(200, {
              'Content-Type': contentType,
              'Accept-Ranges': 'bytes',
              'Content-Length': String(stat.size),
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'X-Content-Type-Options': 'nosniff',
            });

            if (req.method === 'HEAD') {
              res.end();
              return;
            }

            const readStream = fs.createReadStream(safeTargetPath);
            readStream.on('error', () => {
              if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
              }
              res.end();
            });
            res.on('close', () => {
              readStream.destroy();
            });
            readStream.pipe(res);
          } catch {
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            }
            res.end('500 - Internal Server Error');
          }
        });

        this.server = srv;
        srv.listen(0, '127.0.0.1', () => {
          const address = srv.address();
          const port = typeof address === 'object' && address ? address.port : 0;
          this.currentUrl = `http://127.0.0.1:${port}/`;
          resolve(this.currentUrl);
        });

        srv.on('error', (err) => {
          reject(err);
        });
      });
    })();

    try {
      return await this.startingPromise;
    } finally {
      this.startingPromise = null;
    }
  }

  public async stop(): Promise<void> {
    if (this.server) {
      const srv = this.server;
      if (typeof srv.closeAllConnections === 'function') {
        srv.closeAllConnections();
      }
      await new Promise<void>((resolve) => {
        srv.close(() => {
          this.server = null;
          this.currentUrl = null;
          this.mockDbCache = null;
          resolve();
        });
      });
    }
  }

  public getUrl(): string | null {
    return this.currentUrl;
  }
}
