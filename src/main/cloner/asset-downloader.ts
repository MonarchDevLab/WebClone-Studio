import got, { Response } from 'got';
import { pipeline } from 'stream/promises';
import fs from 'fs';
import path from 'path';

export interface DownloadResult {
  url: string;
  finalUrl?: string;
  statusCode: number;
  mimeType: string;
  sizeBytes: number;
  localPath: string;
  buffer?: Buffer;
}

const REAL_BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/**
 * Web varlıklarını yüksek performanslı, stream tabanlı ve anti-bot/anti-hotlink korumalarını
 * aşabilen modern tarayıcı başlıklarıyla indiren yönetici.
 */
export class AssetDownloader {
  private userAgent: string;
  private timeoutMs: number;

  constructor(userAgent?: string, timeoutMs: number = 30000) {
    this.userAgent = userAgent && !userAgent.includes('WebCloneStudio') ? userAgent : REAL_BROWSER_UA;
    this.timeoutMs = timeoutMs;
  }

  private getBrowserHeaders(targetUrl: string): Record<string, string> {
    let originReferer = '';
    try {
      originReferer = new URL(targetUrl).origin + '/';
    } catch {}

    const headers: Record<string, string> = {
      'user-agent': this.userAgent,
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,font/woff2,*/*;q=0.8',
      'accept-language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      'cache-control': 'no-cache',
      'pragma': 'no-cache',
      'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'upgrade-insecure-requests': '1',
    };

    if (originReferer) {
      headers['referer'] = originReferer;
    }

    return headers;
  }

  /**
   * Bir URL'yi stream olarak doğrudan diske kaydeder.
   * 4xx/5xx veya hata durumunda diske yazılan çöp dosyayı temizler.
   */
  public async downloadToFile(url: string, destinationPath: string, maxSizeBytes?: number): Promise<DownloadResult> {
    const parentDir = path.dirname(destinationPath);
    await fs.promises.mkdir(parentDir, { recursive: true });

    let statusCode = 200;
    let mimeType = 'application/octet-stream';
    let sizeBytes = 0;
    let finalUrl = url;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const downloadStream = got.stream(url, {
          headers: this.getBrowserHeaders(url),
          https: {
            rejectUnauthorized: false,
          },
          timeout: {
            request: this.timeoutMs,
          },
          retry: {
            limit: 2,
            methods: ['GET'],
            errorCodes: ['ETIMEDOUT', 'ECONNRESET', 'EADDRINUSE', 'ECONNREFUSED', 'EPIPE', 'ENOTFOUND', 'ENETUNREACH', 'EAI_AGAIN'],
          },
          throwHttpErrors: false,
        });

        downloadStream.on('response', (response: Response) => {
          statusCode = response.statusCode;
          mimeType = (response.headers['content-type'] as string) || 'application/octet-stream';
          if (response.url) {
            finalUrl = response.url;
          }

          // Boyut kontrolü
          const contentLength = parseInt(response.headers['content-length'] || '0', 10);
          if (maxSizeBytes && contentLength > maxSizeBytes) {
            downloadStream.destroy(new Error(`Dosya boyutu (${contentLength} bytes) maksimum sınırı (${maxSizeBytes} bytes) aşıyor.`));
          }
        });

        let downloadedBytes = 0;
        downloadStream.on('data', (chunk: Buffer) => {
          downloadedBytes += chunk.length;
          if (maxSizeBytes && downloadedBytes > maxSizeBytes) {
            downloadStream.destroy(new Error(`Dosya boyutu kümülatif sınırı (${maxSizeBytes} bytes) aşıyor.`));
          }
        });

        let fileStream: fs.WriteStream | null = null;
        try {
          fileStream = fs.createWriteStream(destinationPath);
          await pipeline(downloadStream, fileStream);

          if (statusCode === 429 || (statusCode >= 500 && statusCode <= 504)) {
            // Geçici CDN/Sunucu hatası, backoff ile tekrar dene
            if (fileStream && !fileStream.destroyed) fileStream.destroy();
            if (fs.existsSync(destinationPath)) await fs.promises.unlink(destinationPath);
            if (attempt < 3) {
              await new Promise((r) => setTimeout(r, 600 * attempt));
              continue;
            }
          }

          if (statusCode >= 400) {
            try {
              if (fileStream && !fileStream.destroyed) fileStream.destroy();
              if (fs.existsSync(destinationPath)) {
                await fs.promises.unlink(destinationPath);
              }
            } catch {}
          } else {
            const stats = await fs.promises.stat(destinationPath);
            sizeBytes = stats.size;
          }

          return {
            url,
            finalUrl,
            statusCode,
            mimeType,
            sizeBytes,
            localPath: statusCode < 400 ? destinationPath : '',
          };
        } catch (err) {
          try {
            if (fileStream && !fileStream.destroyed) fileStream.destroy();
            if (fs.existsSync(destinationPath)) {
              await fs.promises.unlink(destinationPath);
            }
          } catch {}
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, 600 * attempt));
            continue;
          }
          throw err;
        }
      } catch (err) {
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 600 * attempt));
          continue;
        }
        throw err;
      }
    }

    return {
      url,
      finalUrl,
      statusCode: statusCode || 500,
      mimeType,
      sizeBytes: 0,
      localPath: '',
    };
  }

  /**
   * HTML veya CSS gibi hemen işlenmesi gereken içerikleri RAM'e (Buffer) çeker.
   */
  public async downloadToBuffer(url: string, maxSizeBytes?: number): Promise<DownloadResult> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await got(url, {
          headers: this.getBrowserHeaders(url),
          timeout: {
            request: this.timeoutMs,
          },
          https: {
            rejectUnauthorized: false,
          },
          retry: {
            limit: 2,
            methods: ['GET'],
            statusCodes: [408, 413, 429, 500, 502, 503, 504],
            errorCodes: [
              'ETIMEDOUT',
              'ECONNRESET',
              'EADDRINUSE',
              'ECONNREFUSED',
              'EPIPE',
              'ENOTFOUND',
              'ENETUNREACH',
              'EAI_AGAIN',
            ],
          },
          responseType: 'buffer',
          throwHttpErrors: false,
        });

        const mimeType = (response.headers['content-type'] as string) || 'application/octet-stream';
        const sizeBytes = response.rawBody.length;

        if (maxSizeBytes && sizeBytes > maxSizeBytes) {
          throw new Error(`İçerik boyutu (${sizeBytes} bytes) sınırı (${maxSizeBytes} bytes) aşıyor.`);
        }

        if (response.statusCode === 429 || (response.statusCode >= 500 && response.statusCode <= 504)) {
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, 600 * attempt));
            continue;
          }
        }

        return {
          url,
          finalUrl: response.url || url,
          statusCode: response.statusCode,
          mimeType,
          sizeBytes,
          localPath: '',
          buffer: response.rawBody,
        };
      } catch (err: any) {
        lastError = err;
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 600 * attempt));
          continue;
        }
      }
    }

    throw lastError || new Error(`İndirme başarısız: ${url}`);
  }
}
