import { AppSettings, CloneSettings } from './types';
import { buildDefaultUserAgent } from './version';

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.round(value)));
}

function asStringArray(value: unknown, maxItems: number = 100): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .slice(0, maxItems)
    .map((item) => item.trim().slice(0, 256));
}

/**
 * Parses and validates basic HTTP/HTTPS URL syntax without credentials.
 */
export function validateHttpUrlShape(raw: unknown): URL {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('URL cannot be empty.');
  }
  const trimmed = raw.trim();
  if (trimmed.length > 2048) {
    throw new Error('URL exceeds maximum length.');
  }
  const parsed = new URL(trimmed);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
  }
  if (parsed.username || parsed.password) {
    throw new Error('URLs with embedded credentials are not permitted.');
  }
  return parsed;
}

/**
 * Normalizes and bounds-clamps incoming CloneSettings from IPC.
 */
export function clampCloneSettings(input: Partial<CloneSettings> | undefined | null): CloneSettings {
  const raw = input && typeof input === 'object' ? input : {};
  // Note: existing CloneSetupModal stores maxFileSize in bytes (default 100 * 1024 * 1024).
  const maxFileBytesFallback = 100 * 1024 * 1024;
  const maxFileSize =
    typeof raw.maxFileSize === 'number' && Number.isFinite(raw.maxFileSize)
      ? Math.max(1024 * 1024, Math.min(500 * 1024 * 1024, Math.round(raw.maxFileSize)))
      : maxFileBytesFallback;

  const rawUa = typeof raw.userAgent === 'string' ? raw.userAgent.trim() : '';

  return {
    mode: raw.mode === 'dynamic' ? 'dynamic' : 'static',
    maxDepth: clampInt(raw.maxDepth, 1, 10, 3),
    concurrentDownloads: clampInt(raw.concurrentDownloads, 1, 32, 6),
    rateLimit: clampInt(raw.rateLimit, 0, 5000, 120),
    respectRobotsTxt: Boolean(raw.respectRobotsTxt),
    downloadImages: raw.downloadImages !== false,
    downloadFonts: raw.downloadFonts !== false,
    downloadMedia: raw.downloadMedia !== false,
    downloadDocuments: raw.downloadDocuments !== false,
    downloadArchives: raw.downloadArchives !== false,
    downloadData: raw.downloadData !== false,
    downloadExternalAssets: raw.downloadExternalAssets !== false,
    crawlSubdomains: Boolean(raw.crawlSubdomains),
    includedPatterns: asStringArray(raw.includedPatterns),
    excludedPatterns: asStringArray(raw.excludedPatterns),
    maxFileSize,
    userAgent: rawUa.length > 0 && rawUa.length <= 512 ? rawUa : buildDefaultUserAgent(),
    reverseEngineering: raw.reverseEngineering !== false,
    ignoreSslErrors: Boolean(raw.ignoreSslErrors),
    exportWacz: Boolean(raw.exportWacz),
  };
}

/**
 * Sanitizes and bounds-clamps AppSettings patches before disk persistence.
 */
export function sanitizeSettingsPatch(input: unknown): Partial<AppSettings> {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid settings payload.');
  }
  const raw = input as Record<string, unknown>;
  const patch: Partial<AppSettings> = {};

  if (typeof raw.defaultOutputDir === 'string' && raw.defaultOutputDir.trim().length > 0) {
    patch.defaultOutputDir = raw.defaultOutputDir.trim().slice(0, 512);
  }
  if (typeof raw.userAgent === 'string' && raw.userAgent.trim().length > 0) {
    patch.userAgent = raw.userAgent.trim().slice(0, 512);
  }
  if (raw.defaultThreads !== undefined) {
    patch.defaultThreads = clampInt(raw.defaultThreads, 1, 20, 5);
  }
  if (raw.defaultRateLimit !== undefined) {
    patch.defaultRateLimit = clampInt(raw.defaultRateLimit, 0, 5000, 200);
  }

  const boolKeys = [
    'defaultDownloadImages',
    'defaultDownloadFonts',
    'defaultDownloadMedia',
    'defaultDownloadDocuments',
    'defaultDownloadArchives',
    'defaultDownloadData',
    'defaultCrawlSubdomains',
    'defaultDownloadExternalAssets',
    'defaultReverseEngineering',
    'allowLocalhostTargets',
    'defaultExportWacz',
  ] as const;

  for (const key of boolKeys) {
    if (typeof raw[key] === 'boolean') {
      (patch as Record<string, boolean>)[key] = raw[key] as boolean;
    }
  }

  return patch;
}
