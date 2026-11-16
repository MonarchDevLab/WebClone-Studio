import { session as electronSession } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { assertSafeRemoteUrl, DnsLookupFn } from '../security/url-guard';
import { SessionManager } from './session-manager';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface HttpRequestOptions {
  url: string;
  method?: 'GET' | 'HEAD';
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  maxRetries?: number;
  signal?: AbortSignal;
  partition?: string;
  ignoreSslErrors?: boolean;
  allowLocalhostTargets?: boolean;
  dnsLookup?: DnsLookupFn;
  fetchImpl?: FetchLike;
}

export interface HttpBufferResponse {
  url: string;
  finalUrl: string;
  statusCode: number;
  headers: Record<string, string>;
  mimeType: string;
  body: Buffer;
}

export interface HttpFileResponse {
  url: string;
  finalUrl: string;
  statusCode: number;
  headers: Record<string, string>;
  mimeType: string;
  sizeBytes: number;
  contentDispositionFilename?: string;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

function extractDispositionFilename(cd: string | undefined): string | undefined {
  if (!cd) return undefined;
  const match = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
  if (!match?.[1]) return undefined;
  try {
    return decodeURIComponent(match[1].trim());
  } catch {
    return match[1].trim();
  }
}

function normalizeHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

function computeRetryDelayMs(attempt: number, retryAfterHeader?: string): number {
  if (retryAfterHeader) {
    const secs = Number(retryAfterHeader);
    if (Number.isFinite(secs) && secs >= 0) {
      return Math.min(secs * 1000, 10_000);
    }
  }
  return Math.min(600 * attempt, 5_000);
}

async function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  if (signal?.aborted) {
    throw new Error('Request aborted.');
  }
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('Request aborted.'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Decodes HTML/CSS response bytes respecting Content-Type charset or <meta charset> declarations
 * (e.g., windows-1254 / iso-8859-9 / utf-8).
 */
export function decodeTextBuffer(buffer: Buffer, contentType?: string): { text: string; encoding: string } {
  let detected = '';
  if (contentType) {
    const headerMatch = contentType.match(/charset\s*=\s*["']?([^"';\s]+)/i);
    if (headerMatch?.[1]) {
      detected = headerMatch[1].trim().toLowerCase();
    }
  }

  if (!detected && buffer.length > 0) {
    const headAscii = buffer.subarray(0, Math.min(buffer.length, 2048)).toString('latin1');
    const metaCharset = headAscii.match(/<meta[^>]+charset\s*=\s*["']?([^"';\s>/]+)/i);
    if (metaCharset?.[1]) {
      detected = metaCharset[1].trim().toLowerCase();
    }
  }

  const normalized = detected || 'utf-8';
  try {
    const decoder = new TextDecoder(normalized, { fatal: false });
    return { text: decoder.decode(buffer), encoding: normalized };
  } catch {
    return { text: buffer.toString('utf-8'), encoding: 'utf-8' };
  }
}

async function closeStreamQuietly(stream: fs.WriteStream | null): Promise<void> {
  if (!stream) return;
  if (stream.closed) return;
  await new Promise<void>((resolve) => {
    const finish = () => resolve();
    stream.once('close', finish);
    stream.once('error', finish);
    try {
      stream.destroy();
    } catch {
      resolve();
    }
  });
}

/**
 * Unified HTTP transport backed by Electron Chromium's BoringSSL `session.fetch`
 * (sharing TLS JA4 fingerprint, HTTP/2 connection pool, and cookies with PageRenderer),
 * with manual SSRF-validated redirects, streaming byte caps, single-layer backoff, and charset decoding.
 */
export class HttpClient {
  private static resolveFetcher(options: HttpRequestOptions): FetchLike {
    if (options.fetchImpl) {
      return options.fetchImpl;
    }

    const partition = options.partition || SessionManager.getPartitionForUrl(options.url);
    const ses = SessionManager.configurePartition(partition, {
      ignoreSslErrors: options.ignoreSslErrors,
    });

    if (ses && typeof ses.fetch === 'function') {
      return (input: string, init?: RequestInit) => ses.fetch(input, init);
    }

    if (electronSession && typeof electronSession.fromPartition === 'function') {
      const fallbackSes = electronSession.fromPartition(partition);
      if (typeof fallbackSes?.fetch === 'function') {
        return (input: string, init?: RequestInit) => fallbackSes.fetch(input, init);
      }
    }

    return (input: string, init?: RequestInit) => globalThis.fetch(input, init);
  }

  private static async executeWithRedirects(
    options: HttpRequestOptions
  ): Promise<{ response: Response; finalUrl: string }> {
    const maxRedirects = options.maxRedirects ?? 8;
    const maxRetries = options.maxRetries ?? 2;
    const timeoutMs = options.timeoutMs ?? 25_000;
    const fetcher = this.resolveFetcher(options);

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      const attemptController = new AbortController();
      const timeoutHandle = setTimeout(() => {
        attemptController.abort(new Error(`HTTP timeout (${timeoutMs}ms): ${options.url}`));
      }, timeoutMs);

      const onOuterAbort = () => attemptController.abort(options.signal?.reason || new Error('Aborted'));
      options.signal?.addEventListener('abort', onOuterAbort, { once: true });

      try {
        let currentUrl = options.url;

        for (let hop = 0; hop <= maxRedirects; hop++) {
          await assertSafeRemoteUrl(currentUrl, {
            allowLocalhostTargets: options.allowLocalhostTargets,
            dnsLookup: options.dnsLookup,
          });

          const response = await fetcher(currentUrl, {
            method: options.method || 'GET',
            headers: options.headers,
            redirect: 'manual',
            signal: attemptController.signal,
          });

          if (REDIRECT_STATUSES.has(response.status)) {
            const location = response.headers.get('location');
            // Drain/cancel redirect body before moving to next hop
            try {
              await response.body?.cancel();
            } catch {}

            if (!location || hop >= maxRedirects) {
              return { response, finalUrl: currentUrl };
            }
            currentUrl = new URL(location, currentUrl).href;
            continue;
          }

          if (RETRYABLE_STATUSES.has(response.status) && attempt <= maxRetries) {
            const retryAfter = response.headers.get('retry-after') || undefined;
            try {
              await response.body?.cancel();
            } catch {}
            clearTimeout(timeoutHandle);
            options.signal?.removeEventListener('abort', onOuterAbort);
            await sleepWithAbort(computeRetryDelayMs(attempt, retryAfter), options.signal);
            break;
          }

          return { response, finalUrl: currentUrl };
        }
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const msg = lastError.message || '';
        // Never retry SSRF/validation errors or outer caller aborts
        if (
          msg.startsWith('ERR_SSRF_BLOCKED') ||
          msg.startsWith('ERR_INVALID_URL') ||
          msg.includes('Unsupported URL protocol') ||
          options.signal?.aborted
        ) {
          throw lastError;
        }
        if (attempt > maxRetries) {
          throw lastError;
        }
        await sleepWithAbort(computeRetryDelayMs(attempt), options.signal);
      } finally {
        clearTimeout(timeoutHandle);
        options.signal?.removeEventListener('abort', onOuterAbort);
      }
    }

    throw lastError || new Error(`HTTP request failed: ${options.url}`);
  }

  public static async fetchBuffer(options: HttpRequestOptions): Promise<HttpBufferResponse> {
    const { response, finalUrl } = await this.executeWithRedirects(options);
    const headers = normalizeHeaders(response.headers);
    const mimeType = headers['content-type'] || 'application/octet-stream';

    const contentLength = parseInt(headers['content-length'] || '0', 10);
    if (options.maxBytes && Number.isFinite(contentLength) && contentLength > options.maxBytes) {
      try {
        await response.body?.cancel();
      } catch {}
      throw new Error(`Response size (${contentLength} bytes) exceeds maxBytes (${options.maxBytes}).`);
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    if (response.body) {
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            totalBytes += value.byteLength;
            if (options.maxBytes && totalBytes > options.maxBytes) {
              await reader.cancel();
              throw new Error(`Streamed body exceeds maxBytes (${options.maxBytes}).`);
            }
            chunks.push(value);
          }
        }
      } finally {
        reader.releaseLock();
      }
    }

    return {
      url: options.url,
      finalUrl,
      statusCode: response.status,
      headers,
      mimeType,
      body: Buffer.concat(chunks),
    };
  }

  public static async fetchText(options: HttpRequestOptions): Promise<HttpBufferResponse & { text: string; encoding: string }> {
    const res = await this.fetchBuffer(options);
    const decoded = decodeTextBuffer(res.body, res.mimeType);
    return {
      ...res,
      text: decoded.text,
      encoding: decoded.encoding,
    };
  }

  public static async downloadToFile(
    options: HttpRequestOptions,
    destinationPath: string
  ): Promise<HttpFileResponse> {
    const { response, finalUrl } = await this.executeWithRedirects(options);
    const headers = normalizeHeaders(response.headers);
    const mimeType = headers['content-type'] || 'application/octet-stream';
    const dispositionFilename = extractDispositionFilename(headers['content-disposition']);

    const contentLength = parseInt(headers['content-length'] || '0', 10);
    if (options.maxBytes && Number.isFinite(contentLength) && contentLength > options.maxBytes) {
      try {
        await response.body?.cancel();
      } catch {}
      throw new Error(`Content-Length (${contentLength}) exceeds limit (${options.maxBytes}).`);
    }

    if (response.status >= 400) {
      try {
        await response.body?.cancel();
      } catch {}
      return {
        url: options.url,
        finalUrl,
        statusCode: response.status,
        headers,
        mimeType,
        sizeBytes: 0,
        contentDispositionFilename: dispositionFilename,
      };
    }

    await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });
    let fileStream: fs.WriteStream | null = null;
    let sizeBytes = 0;

    try {
      fileStream = fs.createWriteStream(destinationPath);
      if (response.body) {
        const reader = response.body.getReader();
        try {
          while (true) {
            if (options.signal?.aborted) {
              await reader.cancel();
              throw new Error('Download aborted.');
            }
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              sizeBytes += value.byteLength;
              if (options.maxBytes && sizeBytes > options.maxBytes) {
                await reader.cancel();
                throw new Error(`Download size exceeds limit (${options.maxBytes} bytes).`);
              }
              if (!fileStream.write(value)) {
                await new Promise<void>((resolve, reject) => {
                  fileStream?.once('drain', resolve);
                  fileStream?.once('error', reject);
                });
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      }

      await new Promise<void>((resolve, reject) => {
        fileStream?.end((err?: Error | null) => (err ? reject(err) : resolve()));
      });
      await closeStreamQuietly(fileStream);

      return {
        url: options.url,
        finalUrl,
        statusCode: response.status,
        headers,
        mimeType,
        sizeBytes,
        contentDispositionFilename: dispositionFilename,
      };
    } catch (err) {
      await closeStreamQuietly(fileStream);
      try {
        if (fs.existsSync(destinationPath)) {
          await fs.promises.unlink(destinationPath);
        }
      } catch {}
      throw err;
    }
  }
}
