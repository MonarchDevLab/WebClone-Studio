import fs from 'node:fs';
import path from 'node:path';
import { HttpClient, decodeTextBuffer } from '../browser/http-client';
import { SessionManager } from '../browser/session-manager';
import { buildDefaultUserAgent, getRuntimeChromeMajor } from '../../shared/version';

export interface DownloadResult {
  url: string;
  finalUrl?: string;
  statusCode: number;
  mimeType: string;
  sizeBytes: number;
  localPath: string;
  buffer?: Buffer;
  textEncoding?: string;
  etag?: string;
  lastModified?: string;
  contentDispositionFilename?: string;
}

export interface StoredCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
}

export interface DownloaderPolicyOptions {
  ignoreSslErrors?: boolean;
  allowLocalhostTargets?: boolean;
}

const MIME_EXTENSION_MAP: Record<string, string> = {
  'application/zip': '.zip',
  'application/x-zip-compressed': '.zip',
  'application/x-rar-compressed': '.rar',
  'application/x-7z-compressed': '.7z',
  'application/x-tar': '.tar',
  'application/gzip': '.gz',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'text/csv': '.csv',
  'application/json': '.json',
  'application/xml': '.xml',
  'text/xml': '.xml',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'font/woff2': '.woff2',
  'font/woff': '.woff',
  'application/wasm': '.wasm',
  'text/vtt': '.vtt',
};

/**
 * Unified BoringSSL asset downloader sharing Chromium's session.fetch, JA4 TLS fingerprint,
 * HTTP/2 connection pool, and isolated per-domain cookie jar with PageRenderer.
 */
export class AssetDownloader {
  private userAgent: string;
  private timeoutMs: number;
  private cookies: StoredCookie[] = [];
  private policy: DownloaderPolicyOptions;

  constructor(
    userAgent?: string,
    timeoutMs: number = 30_000,
    policy: DownloaderPolicyOptions = {}
  ) {
    this.userAgent =
      userAgent && !userAgent.includes('WebCloneStudio') ? userAgent : buildDefaultUserAgent();
    this.timeoutMs = timeoutMs;
    this.policy = policy;
  }

  public setPolicy(policy: DownloaderPolicyOptions): void {
    this.policy = { ...this.policy, ...policy };
  }

  public setCookies(cookies: StoredCookie[]): void {
    if (!Array.isArray(cookies)) return;
    for (const cookie of cookies) {
      if (!cookie.name || cookie.value === undefined) continue;
      const normalizedDomain = (cookie.domain || '').toLowerCase().replace(/^\./, '');
      const existingIdx = this.cookies.findIndex(
        (c) =>
          c.name === cookie.name &&
          (c.domain || '').toLowerCase().replace(/^\./, '') === normalizedDomain
      );
      if (existingIdx >= 0) {
        this.cookies[existingIdx] = cookie;
      } else {
        this.cookies.push(cookie);
      }
    }
  }

  public clearCookies(): void {
    this.cookies = [];
  }

  private getBrowserHeaders(
    targetUrl: string,
    conditional?: { ifNoneMatch?: string; ifModifiedSince?: string }
  ): Record<string, string> {
    let originReferer = '';
    try {
      originReferer = new URL(targetUrl).origin + '/';
    } catch {}

    const chromeMajor = getRuntimeChromeMajor();
    const headers: Record<string, string> = {
      'user-agent': this.userAgent,
      accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,font/woff2,*/*;q=0.8',
      'accept-language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      'cache-control': 'no-cache',
      pragma: 'no-cache',
      'sec-ch-ua': `"Google Chrome";v="${chromeMajor}", "Chromium";v="${chromeMajor}", "Not_A Brand";v="24"`,
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'upgrade-insecure-requests': '1',
    };

    if (originReferer) {
      headers['referer'] = originReferer;
    }

    if (conditional?.ifNoneMatch) {
      headers['if-none-match'] = conditional.ifNoneMatch;
    }
    if (conditional?.ifModifiedSince) {
      headers['if-modified-since'] = conditional.ifModifiedSince;
    }

    try {
      const reqHostname = new URL(targetUrl).hostname.toLowerCase();
      const matchedCookies = this.cookies.filter((c) => {
        if (!c.domain) return true;
        const cookieDomain = c.domain.toLowerCase().replace(/^\./, '');
        return reqHostname === cookieDomain || reqHostname.endsWith('.' + cookieDomain);
      });

      if (matchedCookies.length > 0) {
        headers['cookie'] = matchedCookies.map((c) => `${c.name}=${c.value}`).join('; ');
      }
    } catch {}

    return headers;
  }

  /**
   * Streams an asset directly to disk with cumulative byte limit enforcement and clean error cleanup.
   */
  public async downloadToFile(
    url: string,
    destinationPath: string,
    maxSizeBytes?: number,
    signal?: AbortSignal
  ): Promise<DownloadResult> {
    const partition = SessionManager.getPartitionForUrl(url);
    const res = await HttpClient.downloadToFile(
      {
        url,
        method: 'GET',
        headers: this.getBrowserHeaders(url),
        timeoutMs: this.timeoutMs,
        maxBytes: maxSizeBytes,
        maxRetries: 2,
        signal,
        partition,
        ignoreSslErrors: this.policy.ignoreSslErrors,
        allowLocalhostTargets: this.policy.allowLocalhostTargets,
      },
      destinationPath
    );

    let finalLocalPath = destinationPath;
    if (res.statusCode < 400 && fs.existsSync(destinationPath)) {
      const currentExt = path.extname(destinationPath).toLowerCase();
      const cleanMime = res.mimeType.split(';')[0].trim().toLowerCase();

      if (!currentExt || currentExt === '.other') {
        let suggestedExt = '';
        if (res.contentDispositionFilename) {
          const cdExt = path.extname(res.contentDispositionFilename).toLowerCase();
          if (cdExt) suggestedExt = cdExt;
        }
        if (!suggestedExt && MIME_EXTENSION_MAP[cleanMime]) {
          suggestedExt = MIME_EXTENSION_MAP[cleanMime];
        }
        if (suggestedExt && !destinationPath.endsWith(suggestedExt)) {
          const newPath = `${destinationPath}${suggestedExt}`;
          try {
            await fs.promises.rename(destinationPath, newPath);
            finalLocalPath = newPath;
          } catch {}
        }
      }
    }

    return {
      url,
      finalUrl: res.finalUrl,
      statusCode: res.statusCode,
      mimeType: res.mimeType,
      sizeBytes: res.sizeBytes,
      localPath: res.statusCode < 400 ? finalLocalPath : '',
      etag: res.headers['etag'],
      lastModified: res.headers['last-modified'],
      contentDispositionFilename: res.contentDispositionFilename,
    };
  }

  /**
   * Downloads HTML, CSS, or script content into memory with charset detection and conditional header support.
   */
  public async downloadToBuffer(
    url: string,
    maxSizeBytes?: number,
    signal?: AbortSignal,
    conditional?: { ifNoneMatch?: string; ifModifiedSince?: string }
  ): Promise<DownloadResult> {
    const partition = SessionManager.getPartitionForUrl(url);
    const res = await HttpClient.fetchBuffer({
      url,
      method: 'GET',
      headers: this.getBrowserHeaders(url, conditional),
      timeoutMs: this.timeoutMs,
      maxBytes: maxSizeBytes,
      maxRetries: 2,
      signal,
      partition,
      ignoreSslErrors: this.policy.ignoreSslErrors,
      allowLocalhostTargets: this.policy.allowLocalhostTargets,
    });

    const decoded = decodeTextBuffer(res.body, res.mimeType);

    return {
      url,
      finalUrl: res.finalUrl,
      statusCode: res.statusCode,
      mimeType: res.mimeType,
      sizeBytes: res.body.length,
      localPath: '',
      buffer: res.body,
      textEncoding: decoded.encoding,
      etag: res.headers['etag'],
      lastModified: res.headers['last-modified'],
    };
  }
}
