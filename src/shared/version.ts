declare const __APP_VERSION__: string | undefined;

export const APP_NAME = 'WebClone Studio';
export const APP_TITLE = 'WebClone Studio - Web Architecture Reconstruction & Offline Mirroring';
export const APP_TAGLINE_EN =
  'Autonomous Web Architecture Reconstruction, BoringSSL Offline Mirroring & WACZ 1.1.1 Workstation';
export const APP_TAGLINE_TR =
  'Otonom Web Mimarisi Çıkarımı, BoringSSL Çevrimdışı Yansılama ve WACZ 1.1.1 İş İstasyonu';
export const APP_GENERATOR_SIGNATURE = 'WebClone Studio';
export const APP_ORG_SIGNATURE = 'Monolith Works / MonarchDevLab';

export const APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__
    ? __APP_VERSION__
    : '2.0.0';

/**
 * Resolves the active Chromium version in Main or Renderer runtime without hardcoding stale Chrome UAs.
 */
export function getRuntimeChromeVersion(): string {
  if (typeof process !== 'undefined' && process.versions?.chrome) {
    return process.versions.chrome;
  }
  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    const match = navigator.userAgent.match(/Chrome\/([\d.]+)/);
    if (match?.[1]) {
      return match[1];
    }
  }
  return '156.0.0.0';
}

export function getRuntimeChromeMajor(): string {
  return getRuntimeChromeVersion().split('.')[0] || '156';
}

/**
 * Builds an authentic Chromium desktop User-Agent string aligned with the active Electron runtime.
 */
export function buildDefaultUserAgent(chromeVersion: string = getRuntimeChromeVersion()): string {
  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
}
