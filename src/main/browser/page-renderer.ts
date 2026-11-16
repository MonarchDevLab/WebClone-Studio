import { BrowserWindow } from 'electron';
import { ColorToken, TypoToken, DesignTokens } from '../../shared/types';
import { CapturedApiEndpoint } from '../cloner/reverse-engineering/api-interceptor';
import { generateStealthScript } from './stealth-scripts';
import { SessionManager } from './session-manager';
import { WindowPool } from './window-pool';
import { assertSafeRemoteUrl, isBlockedIpAddress } from '../security/url-guard';
import { getRootDomain } from '../../shared/validators';

export const PERSISTENT_AUTH_PARTITION = 'persist:webclone_default';

export interface PageRenderCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
}

export interface PageRenderResult {
  html: string;
  globals: string[];
  screenshot: Buffer;
  designTokens: DesignTokens;
  responseHeaders: Record<string, string>;
  capturedEndpoints?: CapturedApiEndpoint[];
  cookies?: PageRenderCookie[];
  mhtmlSnapshot?: string;
}

export interface PageRenderOptions {
  timeoutMs?: number;
  viewport?: { width: number; height: number };
  captureApi?: boolean;
  captureMhtml?: boolean;
  skipDesignTokens?: boolean;
  skipScreenshot?: boolean;
  allowLocalhostTargets?: boolean;
  ignoreSslErrors?: boolean;
}

function normalizeHeaderRecord(rawHeaders: Record<string, unknown> | undefined): Record<string, string> {
  const normalized: Record<string, string> = {};
  if (!rawHeaders) return normalized;
  for (const [k, v] of Object.entries(rawHeaders)) {
    if (v !== undefined) {
      normalized[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v);
    }
  }
  return normalized;
}

/**
 * Renders target pages inside a warm pool of sandboxed offscreen Chromium BrowserWindows.
 * Extracts live DOM (including Declarative Shadow DOM via getHTML), CDP HTTP headers,
 * complete XHR/Fetch/GraphQL request+response payloads on loadingFinished, CSS variables, and PNG captures.
 */
export class PageRenderer {
  private static parseRgbOrHex(colorStr: string): string | null {
    if (!colorStr || colorStr === 'transparent' || colorStr === 'rgba(0, 0, 0, 0)') {
      return null;
    }
    if (colorStr.startsWith('#')) return colorStr.toLowerCase();

    const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
      const r = parseInt(match[1], 10);
      const g = parseInt(match[2], 10);
      const b = parseInt(match[3], 10);
      const a = match[4] !== undefined ? parseFloat(match[4]) : 1;
      if (a === 0) return null;
      const toHex = (n: number) => n.toString(16).padStart(2, '0');
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toLowerCase();
    }
    return null;
  }

  public async render(url: string, options: PageRenderOptions = {}): Promise<PageRenderResult> {
    const allowLocalhost = Boolean(options.allowLocalhostTargets);
    await assertSafeRemoteUrl(url, { allowLocalhostTargets: allowLocalhost });

    const timeoutMs = options.timeoutMs || 25_000;
    const viewport = options.viewport || { width: 1440, height: 900 };
    const partition = SessionManager.getPartitionForUrl(url);
    SessionManager.configurePartition(partition, { ignoreSslErrors: options.ignoreSslErrors });

    const pool = WindowPool.getInstance();
    const win = await pool.acquire(partition, viewport);
    const targetRootHost = getRootDomain(new URL(url).hostname);

    let timedOut = false;
    let shouldDiscardWindow = false;
    let debuggerListener: ((_e: unknown, method: string, params: any) => void) | null = null;
    const pendingRequests = new Map<
      string,
      { url: string; method: string; postData?: string }
    >();
    const pendingResponses = new Map<
      string,
      { url: string; status: number; mimeType: string; method: string; postData?: string }
    >();
    let mainFrameResponseHeaders: Record<string, string> = {};
    const capturedEndpoints: CapturedApiEndpoint[] = [];

    const redirectGuard = (event: Electron.Event, navUrl: string) => {
      try {
        const parsed = new URL(navUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          event.preventDefault();
          return;
        }
        const hostNoBracket = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
        if (
          !allowLocalhost &&
          (hostNoBracket === 'localhost' || hostNoBracket.endsWith('.localhost'))
        ) {
          event.preventDefault();
          return;
        }
        if (isBlockedIpAddress(hostNoBracket, allowLocalhost).blocked) {
          event.preventDefault();
          return;
        }
        if (getRootDomain(parsed.hostname) !== targetRootHost) {
          event.preventDefault();
        }
      } catch {
        event.preventDefault();
      }
    };

    win.webContents.on('will-navigate', redirectGuard);
    win.webContents.on('will-redirect', redirectGuard);

    let hardTimeoutId: NodeJS.Timeout | null = null;
    const hardTimeoutPromise = new Promise<never>((_, reject) => {
      hardTimeoutId = setTimeout(() => {
        timedOut = true;
        shouldDiscardWindow = true;
        reject(new Error(`PageRenderer zaman aşımına uğradı (${timeoutMs}ms): ${url}`));
      }, timeoutMs);
    });

    const executeRender = async (): Promise<PageRenderResult> => {
      try {
        if (!win.webContents.debugger.isAttached()) {
          win.webContents.debugger.attach('1.3');
        }
        await win.webContents.debugger.sendCommand('Page.enable').catch(() => {});
        await win.webContents.debugger
          .sendCommand('Page.addScriptToEvaluateOnNewDocument', {
            source: generateStealthScript(),
          })
          .catch(() => {});
        await win.webContents.debugger.sendCommand('Network.enable').catch(() => {});

        debuggerListener = async (_event, method, params) => {
          if (timedOut || win.isDestroyed()) return;

          if (method === 'Network.requestWillBeSent') {
            const req = params?.request;
            if (params?.requestId && req?.url) {
              pendingRequests.set(params.requestId, {
                url: req.url,
                method: req.method || 'GET',
                postData: req.postData,
              });
            }
            return;
          }

          if (method === 'Network.responseReceived') {
            const { response, requestId, type } = params || {};
            if (!response) return;

            if (type === 'Document' && Object.keys(mainFrameResponseHeaders).length === 0) {
              mainFrameResponseHeaders = normalizeHeaderRecord(response.headers);
            }

            if (
              options.captureApi &&
              (type === 'XHR' ||
                type === 'Fetch' ||
                (typeof response.mimeType === 'string' && response.mimeType.includes('json')))
            ) {
              const reqMeta = pendingRequests.get(requestId);
              pendingResponses.set(requestId, {
                url: response.url,
                status: response.status,
                mimeType: response.mimeType || 'application/json',
                method: reqMeta?.method || response.requestHeaders?.[':method'] || 'GET',
                postData: reqMeta?.postData,
              });
            }
            return;
          }

          if (method === 'Network.loadingFinished' && options.captureApi) {
            const { requestId } = params || {};
            const meta = pendingResponses.get(requestId);
            pendingResponses.delete(requestId);
            pendingRequests.delete(requestId);
            if (!meta) return;

            try {
              const bodyObj = (await win.webContents.debugger.sendCommand(
                'Network.getResponseBody',
                { requestId }
              )) as { body?: string; base64Encoded?: boolean };

              const rawText = bodyObj?.base64Encoded && bodyObj.body
                ? Buffer.from(bodyObj.body, 'base64').toString('utf-8')
                : bodyObj?.body;

              let responseData: any = rawText;
              if (meta.mimeType.includes('json') && typeof rawText === 'string') {
                try {
                  responseData = JSON.parse(rawText);
                } catch {}
              }

              let parsedRequestBody: any = meta.postData;
              if (typeof meta.postData === 'string') {
                try {
                  parsedRequestBody = JSON.parse(meta.postData);
                } catch {}
              }

              const endpointUrl = new URL(meta.url);
              capturedEndpoints.push({
                url: meta.url,
                pathname: endpointUrl.pathname,
                method: meta.method,
                status: meta.status,
                contentType: meta.mimeType,
                requestBody: parsedRequestBody,
                responseData,
                timestamp: Date.now(),
              });
            } catch {}
          }
        };

        win.webContents.debugger.on('message', debuggerListener);
      } catch (err) {
        console.warn('PageRenderer: CDP setup warning:', err);
      }

      // 1. Navigate & wait for main frame load
      await new Promise<void>((resolve, reject) => {
        const onDidFinishLoad = () => {
          win.webContents.removeListener('did-fail-load', onDidFailLoad);
          resolve();
        };
        const onDidFailLoad = (
          _ev: unknown,
          errorCode: number,
          errorDescription: string,
          _validatedUrl: string,
          isMainFrame: boolean
        ) => {
          // Ignore subframe/ad iframe failures
          if (!isMainFrame || errorCode === -3) return;
          win.webContents.removeListener('did-finish-load', onDidFinishLoad);
          reject(new Error(`Sayfa yüklenemedi [${errorCode}]: ${errorDescription}`));
        };

        win.webContents.once('did-finish-load', onDidFinishLoad);
        win.webContents.on('did-fail-load', onDidFailLoad);
        win.loadURL(url).catch((err) => {
          win.webContents.removeListener('did-finish-load', onDidFinishLoad);
          win.webContents.removeListener('did-fail-load', onDidFailLoad);
          reject(err);
        });
      });

      if (timedOut) throw new Error('Timed out');

      // 2. Bounded lazy-load auto-scroll + safe interactive state expansion
      await win.webContents
        .executeJavaScript(`
          new Promise((resolveStep) => {
            let totalHeight = 0;
            const distance = 600;
            let scrolls = 0;
            const maxScrolls = 12;
            const scrollTimer = setInterval(() => {
              const scrollHeight = document.documentElement ? document.documentElement.scrollHeight : 0;
              window.scrollBy(0, distance);
              totalHeight += distance;
              scrolls++;
              if (totalHeight >= scrollHeight || scrolls >= maxScrolls) {
                clearInterval(scrollTimer);
                window.scrollTo(0, 0);
                resolveStep();
              }
            }, 180);
          });
        `)
        .catch(() => {});

      await win.webContents
        .executeJavaScript(`
          new Promise((resolveExpand) => {
            try {
              const safeSelectors = [
                'details:not([open]) > summary',
                '[aria-expanded="false"]',
                '[role="tab"][aria-selected="false"]',
                '.accordion-header',
                '.faq-question',
                '.collapse-toggle',
                '[data-bs-toggle="collapse"]'
              ];
              const candidates = Array.from(document.querySelectorAll(safeSelectors.join(',')));
              if (candidates.length === 0) {
                resolveExpand();
                return;
              }
              let idx = 0;
              const maxExpands = 20;
              const interval = setInterval(() => {
                if (idx >= candidates.length || idx >= maxExpands) {
                  clearInterval(interval);
                  resolveExpand();
                  return;
                }
                const el = candidates[idx++];
                if (el && !el.closest('form') && el.tagName !== 'A' && el.getAttribute('type') !== 'submit') {
                  try { el.click(); } catch {}
                }
              }, 45);
            } catch {
              resolveExpand();
            }
          });
        `)
        .catch(() => {});

      await new Promise((r) => setTimeout(r, 900));
      if (timedOut) throw new Error('Timed out');

      // 3. Serialize DOM with Doctype + getHTML({ serializableShadowRoots: true }) and optional design tokens
      const skipDesignTokens = Boolean(options.skipDesignTokens);
      const rawData = await win.webContents.executeJavaScript(`
        (() => {
          function serializeDocument() {
            const root = document.documentElement;
            if (!root) return '';
            let doctypeStr = '<!DOCTYPE html>';
            if (document.doctype) {
              const dt = document.doctype;
              doctypeStr = '<!DOCTYPE ' + dt.name
                + (dt.publicId ? ' PUBLIC "' + dt.publicId + '"' : '')
                + (!dt.publicId && dt.systemId ? ' SYSTEM' : '')
                + (dt.systemId ? ' "' + dt.systemId + '"' : '')
                + '>';
            }
            const attrs = Array.from(root.attributes)
              .map(a => ' ' + a.name + '="' + String(a.value).replace(/"/g, '&quot;') + '"')
              .join('');
            try {
              if (typeof root.getHTML === 'function') {
                return doctypeStr + '\\n<html' + attrs + '>' + root.getHTML({ serializableShadowRoots: true }) + '</html>';
              }
            } catch (e) {}
            return doctypeStr + '\\n' + root.outerHTML;
          }

          const html = serializeDocument();
          const globals = Object.keys(window).slice(0, 500);
          if (${skipDesignTokens ? 'true' : 'false'}) {
            return { html, globals, skipTokens: true };
          }

          try {
            const cssVariables = {};
            try {
              for (const sheet of document.styleSheets) {
                try {
                  for (const rule of sheet.cssRules || []) {
                    if (rule.selectorText === ':root' || rule.selectorText === 'html' || rule.selectorText === 'body') {
                      for (let i = 0; i < rule.style.length; i++) {
                        const prop = rule.style[i];
                        if (prop.startsWith('--')) {
                          const val = rule.style.getPropertyValue(prop).trim();
                          if (val && !cssVariables[prop]) cssVariables[prop] = val;
                        }
                      }
                    }
                  }
                } catch {}
              }
            } catch {}

            const colorMap = {};
            const fontFamilies = new Set();
            const typoList = [];
            const spacingSet = new Set();
            const shadowMap = {};
            const radiusSet = new Set();
            const gradientSet = new Set();
            const blurSet = new Set();
            const containerSet = new Set();

            const elements = document.querySelectorAll('*');
            const limit = Math.min(elements.length, 1500);
            for (let i = 0; i < limit; i++) {
              const el = elements[i];
              const style = window.getComputedStyle(el);

              [style.backgroundColor, style.color, style.borderColor].forEach(c => {
                if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') {
                  colorMap[c] = (colorMap[c] || 0) + 1;
                }
              });

              if (style.fontFamily) fontFamilies.add(style.fontFamily);

              const tag = el.tagName.toUpperCase();
              if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'BODY', 'BUTTON', 'A', 'CODE', 'PRE'].includes(tag) && typoList.length < 30) {
                typoList.push({
                  tag,
                  fontFamily: style.fontFamily,
                  fontSize: style.fontSize,
                  fontWeight: style.fontWeight,
                  lineHeight: style.lineHeight,
                  letterSpacing: style.letterSpacing
                });
              }

              [style.marginTop, style.marginBottom, style.paddingTop, style.paddingBottom, style.gap].forEach(val => {
                if (val && val.endsWith('px')) {
                  const num = parseFloat(val);
                  if (num > 0 && num <= 128) spacingSet.add(num);
                }
              });

              if (style.boxShadow && style.boxShadow !== 'none') {
                shadowMap[style.boxShadow] = (shadowMap[style.boxShadow] || 0) + 1;
              }
              if (style.borderRadius && style.borderRadius !== '0px') radiusSet.add(style.borderRadius);
              if (style.backgroundImage && style.backgroundImage.includes('gradient')) gradientSet.add(style.backgroundImage);
              if (style.backdropFilter && style.backdropFilter !== 'none') blurSet.add(style.backdropFilter);
              if (style.maxWidth && style.maxWidth.endsWith('px')) {
                const w = parseFloat(style.maxWidth);
                if (w >= 640 && w <= 2560) containerSet.add(style.maxWidth);
              }
            }

            const components = [];
            const navEl = document.querySelector('header, nav, [role="banner"], [class*="nav"], [class*="header"]');
            if (navEl) {
              const s = window.getComputedStyle(navEl);
              const links = Array.from(navEl.querySelectorAll('a'))
                .map(a => ({ text: (a.innerText || '').trim(), href: a.getAttribute('href') || '' }))
                .filter(l => l.text.length > 0 && l.text.length < 30)
                .slice(0, 8);
              const ctas = Array.from(navEl.querySelectorAll('button, a[class*="btn"], a[class*="button"]'))
                .map(b => (b.innerText || '').trim())
                .filter(t => t.length > 0 && t.length < 25)
                .slice(0, 3);
              components.push({
                name: 'Navbar / Header',
                tag: navEl.tagName.toLowerCase(),
                classes: Array.from(navEl.classList).slice(0, 8),
                layout: 'display: ' + s.display + '; flex-direction: ' + s.flexDirection + '; justify-content: ' + s.justifyContent + '; align-items: ' + s.alignItems,
                height: s.height,
                background: s.backgroundColor,
                border: s.borderBottom,
                backdropFilter: s.backdropFilter !== 'none' ? s.backdropFilter : undefined,
                links,
                ctas
              });
            }

            const heroEl = document.querySelector('main > section:first-of-type, [class*="hero"], [id*="hero"], header + section, header + div > section');
            if (heroEl) {
              const s = window.getComputedStyle(heroEl);
              const h1 = heroEl.querySelector('h1')?.innerText?.trim() || document.querySelector('h1')?.innerText?.trim() || '';
              const subhead = heroEl.querySelector('p')?.innerText?.trim() || '';
              const ctas = Array.from(heroEl.querySelectorAll('button, a[class*="btn"], a[class*="button"]'))
                .map(b => (b.innerText || '').trim())
                .filter(t => t.length > 0 && t.length < 35)
                .slice(0, 4);
              components.push({
                name: 'Hero Section',
                tag: heroEl.tagName.toLowerCase(),
                classes: Array.from(heroEl.classList).slice(0, 8),
                layout: 'display: ' + s.display + '; flex-direction: ' + s.flexDirection + '; align-items: ' + s.alignItems,
                minHeight: s.minHeight,
                background: s.backgroundColor,
                h1,
                subhead: subhead.slice(0, 200),
                ctas
              });
            }

            const footerEl = document.querySelector('footer, [role="contentinfo"], [class*="footer"]');
            if (footerEl) {
              const s = window.getComputedStyle(footerEl);
              const links = Array.from(footerEl.querySelectorAll('a'))
                .map(a => ({ text: (a.innerText || '').trim(), href: a.getAttribute('href') || '' }))
                .filter(l => l.text.length > 0 && l.text.length < 30)
                .slice(0, 12);
              components.push({
                name: 'Footer',
                tag: footerEl.tagName.toLowerCase(),
                classes: Array.from(footerEl.classList).slice(0, 8),
                background: s.backgroundColor,
                color: s.color,
                links
              });
            }

            let logoUrl = '';
            const logoImg = document.querySelector('header img, nav img, [class*="logo"] img');
            if (logoImg) logoUrl = logoImg.getAttribute('src') || '';

            const fontLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"], link[rel="preload"][as="font"]'))
              .map(l => l.getAttribute('href') || '')
              .filter(h => h && (h.includes('fonts.') || h.includes('.woff') || h.includes('.ttf')))
              .slice(0, 5);

            return {
              html,
              globals,
              colors: colorMap,
              fontFamilies: Array.from(fontFamilies),
              typos: typoList.slice(0, 25),
              spacings: Array.from(spacingSet),
              cssVariables,
              shadows: Object.entries(shadowMap).sort((a,b) => b[1] - a[1]).slice(0, 6).map(([s]) => s),
              radii: Array.from(radiusSet).slice(0, 8),
              gradients: Array.from(gradientSet).slice(0, 5),
              backdropBlurs: Array.from(blurSet).slice(0, 3),
              containerWidths: Array.from(containerSet).slice(0, 4),
              components,
              assets: {
                logo: logoUrl,
                svgCount: document.querySelectorAll('svg').length,
                externalFonts: fontLinks
              }
            };
          } catch (e) {
            return { html, globals, skipTokens: true };
          }
        })()
      `);

      let screenshot: Buffer = Buffer.alloc(0);
      if (!options.skipScreenshot) {
        const nativeImage = await win.webContents.capturePage();
        screenshot = nativeImage.toPNG();
      }

      let designTokens: DesignTokens = {
        colors: [],
        typography: [],
        spacing: [],
      };

      if (!rawData?.skipTokens) {
        const colorCounts = new Map<string, number>();
        for (const [rawColor, count] of Object.entries(rawData.colors || {})) {
          const hex = PageRenderer.parseRgbOrHex(rawColor);
          if (hex) {
            colorCounts.set(hex, (colorCounts.get(hex) || 0) + (count as number));
          }
        }

        const topColors = Array.from(colorCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 15);

        const colorTokens: ColorToken[] = topColors.map(([hex, freq], idx) => {
          let role: ColorToken['role'] = 'accent';
          if (idx === 0) role = 'background';
          else if (idx === 1) role = 'foreground';
          else if (idx === 2) role = 'border';
          else if (idx > 8) role = 'muted';
          return { hex, role, frequency: freq };
        });

        const typoMap = new Map<string, TypoToken>();
        for (const t of rawData.typos || []) {
          let role: TypoToken['role'] = 'body';
          if (/^H[1-3]$/.test(t.tag)) role = 'heading';
          else if (/^H[4-6]$/.test(t.tag)) role = 'caption';
          else if (['CODE', 'PRE'].includes(t.tag)) role = 'mono';

          if (!typoMap.has(role)) {
            typoMap.set(role, {
              fontFamily: t.fontFamily || 'Inter, sans-serif',
              fontSize: t.fontSize || '14px',
              fontWeight: t.fontWeight || '400',
              lineHeight: t.lineHeight || 'normal',
              letterSpacing: t.letterSpacing,
              role,
            });
          }
        }

        const typographyTokens: TypoToken[] = Array.from(typoMap.values());
        if (typographyTokens.length === 0) {
          typographyTokens.push({
            fontFamily: rawData.fontFamilies?.[0] || 'Inter, sans-serif',
            fontSize: '16px',
            fontWeight: '400',
            lineHeight: '1.5',
            role: 'body',
          });
        }

        const spacingTokens: number[] = (rawData.spacings || [])
          .map((n: number) => Math.round(n / 4) * 4)
          .filter((n: number, i: number, arr: number[]) => n > 0 && arr.indexOf(n) === i)
          .sort((a: number, b: number) => a - b)
          .slice(0, 10);

        designTokens = {
          colors: colorTokens,
          typography: typographyTokens,
          spacing: spacingTokens,
          cssVariables: rawData.cssVariables || {},
          shadows: (rawData.shadows || []).map((s: string, idx: number) => ({
            name: idx === 0 ? 'sm' : idx === 1 ? 'md' : idx === 2 ? 'lg' : `elevation-${idx + 1}`,
            value: s,
          })),
          radii: (rawData.radii || []).map((r: string, idx: number) => ({
            name: idx === 0 ? 'sm' : idx === 1 ? 'md' : idx === 2 ? 'lg' : `radius-${idx + 1}`,
            value: r,
          })),
          gradients: rawData.gradients || [],
          backdropBlurs: rawData.backdropBlurs || [],
          containerWidths: rawData.containerWidths || [],
          components: rawData.components || [],
          assets: rawData.assets || {},
        };
      }

      const cookies = await SessionManager.getCookiesForUrl(url, partition);

      let mhtmlSnapshot: string | undefined;
      if (options.captureMhtml && win.webContents.debugger.isAttached()) {
        try {
          const snap = (await win.webContents.debugger.sendCommand('Page.captureSnapshot', {
            format: 'mhtml',
          })) as { data?: string };
          if (snap && typeof snap.data === 'string') {
            mhtmlSnapshot = snap.data;
          }
        } catch {}
      }

      return {
        html: rawData?.html || '',
        globals: rawData?.globals || [],
        screenshot,
        designTokens,
        responseHeaders: mainFrameResponseHeaders,
        capturedEndpoints,
        cookies,
        mhtmlSnapshot,
      };
    };

    try {
      return await Promise.race([executeRender(), hardTimeoutPromise]);
    } finally {
      if (hardTimeoutId) clearTimeout(hardTimeoutId);
      try {
        win.webContents.removeListener('will-navigate', redirectGuard);
        win.webContents.removeListener('will-redirect', redirectGuard);
        if (debuggerListener) {
          win.webContents.debugger.removeListener('message', debuggerListener);
        }
      } catch {}

      if (shouldDiscardWindow) {
        pool.discard(win);
      } else {
        await pool.release(win);
      }
    }
  }

  public static async getSessionCookies(url: string): Promise<PageRenderCookie[]> {
    return await SessionManager.getCookiesForUrl(url);
  }

  /**
   * Opens a visible, user-controlled browser window isolated per target domain so the human user
   * can sign in or complete interactive verification manually without third-party automation.
   */
  public static async openAuthSession(
    url: string,
    parentWindow?: BrowserWindow,
    options?: { allowLocalhostTargets?: boolean; ignoreSslErrors?: boolean }
  ): Promise<{ cookieCount: number; cookies: PageRenderCookie[] }> {
    const parsed = await assertSafeRemoteUrl(url, {
      allowLocalhostTargets: options?.allowLocalhostTargets,
    });
    const partition = SessionManager.getPartitionForUrl(parsed.href);
    SessionManager.configurePartition(partition, { ignoreSslErrors: options?.ignoreSslErrors });

    const authWin = new BrowserWindow({
      width: 1120,
      height: 760,
      parent: parentWindow,
      title: `WebClone Studio - Oturum Aç (${parsed.hostname}) - Giriş yaptıktan sonra bu pencereyi kapatın`,
      autoHideMenuBar: true,
      webPreferences: {
        partition,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
      },
    });

    authWin.webContents.on('will-navigate', (event, targetNav) => {
      try {
        const navParsed = new URL(targetNav);
        if (!['http:', 'https:'].includes(navParsed.protocol)) {
          event.preventDefault();
          return;
        }
        const host = navParsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
        if (isBlockedIpAddress(host, Boolean(options?.allowLocalhostTargets)).blocked) {
          event.preventDefault();
        }
      } catch {
        event.preventDefault();
      }
    });

    authWin.webContents.setWindowOpenHandler(({ url: popupUrl }) => {
      try {
        const p = new URL(popupUrl);
        if (['http:', 'https:'].includes(p.protocol)) {
          void authWin.loadURL(popupUrl);
        }
      } catch {}
      return { action: 'deny' };
    });

    await authWin.loadURL(parsed.href).catch(() => {});

    await new Promise<void>((resolve) => {
      authWin.once('closed', () => resolve());
    });

    const cookies = await SessionManager.getCookiesForUrl(parsed.href, partition);
    return {
      cookieCount: cookies.length,
      cookies,
    };
  }
}
