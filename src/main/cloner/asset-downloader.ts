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

    try {
      const downloadStream = got.stream(url, {
        headers: this.getBrowserHeaders(url),
        timeout: {
          request: this.timeoutMs,
        },
        retry: {
          limit: 3,
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

      const fileStream = fs.createWriteStream(destinationPath);
      await pipeline(downloadStream, fileStream);

      if (statusCode >= 400) {
        try {
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
        if (fs.existsSync(destinationPath)) {
          await fs.promises.unlink(destinationPath);
        }
      } catch {}
      throw err;
    }
  }

  /**
   * HTML veya CSS gibi hemen işlenmesi gereken içerikleri RAM'e (Buffer) çeker.
   */
  public async downloadToBuffer(url: string, maxSizeBytes?: number): Promise<DownloadResult> {
    const response = await got(url, {
      headers: this.getBrowserHeaders(url),
      timeout: {
        request: this.timeoutMs,
      },
      retry: {
        limit: 3,
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

    return {
      url,
      finalUrl: response.url || url,
      statusCode: response.statusCode,
      mimeType,
      sizeBytes,
      localPath: '',
      buffer: response.rawBody,
    };
  }
}
