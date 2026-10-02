import { BrowserWindow } from 'electron';
import { ColorToken, TypoToken, DesignTokens } from '../../shared/types';
import { CapturedApiEndpoint } from '../cloner/reverse-engineering/api-interceptor';

export interface PageRenderResult {
  html: string;
  globals: string[];
  screenshot: Buffer;
  designTokens: DesignTokens;
  capturedEndpoints?: CapturedApiEndpoint[];
}

export interface PageRenderOptions {
  timeoutMs?: number;
  viewport?: { width: number; height: number };
  captureApi?: boolean;
}

/**
 * Electron'un yerleşik Chromium motorunu kullanarak uzak sayfaları güvenli ve izole
 * bir offscreen BrowserWindow içinde çalıştırıp DOM, JS değişkenleri, stiller ve ekran görüntüsü toplar.
 */
export class PageRenderer {
  private static parseRgbOrHex(colorStr: string): string | null {
    if (!colorStr || colorStr === 'transparent' || colorStr === 'rgba(0, 0, 0, 0)') {
      return null;
    }
    // Zaten hex ise
    if (colorStr.startsWith('#')) return colorStr.toLowerCase();

    // rgb(r, g, b) veya rgba(r, g, b, a)
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

  /**
   * Bir URL'yi offscreen pencerede açar, render eder ve tüm analitik verileri toplar.
   */
  public async render(url: string, options: PageRenderOptions = {}): Promise<PageRenderResult> {
    const timeoutMs = options.timeoutMs || 20000;
    const viewport = options.viewport || { width: 1440, height: 900 };

    const win = new BrowserWindow({
      show: false,
      width: viewport.width,
      height: viewport.height,
      webPreferences: {
        offscreen: true,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
      },
    });

    // Güvenlik: Dış pencere açılmalarını kilitler; aynı kök domain yönlendirmelerine (http->https, www) izin verir
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (event, navigationUrl) => {
      try {
        const navParsed = new URL(navigationUrl);
        const initialParsed = new URL(url);
        if (!['http:', 'https:'].includes(navParsed.protocol)) {
          event.preventDefault();
          return;
        }
        const navHost = navParsed.hostname.toLowerCase().replace(/^www\./, '');
        const initialHost = initialParsed.hostname.toLowerCase().replace(/^www\./, '');
        if (navHost !== initialHost) {
          event.preventDefault();
        }
      } catch {
        event.preventDefault();
      }
    });

    let isDestroyed = false;
    let debuggerAttached = false;
    const cleanup = () => {
      if (!isDestroyed) {
        isDestroyed = true;
        try {
          if (debuggerAttached && win.webContents.debugger.isAttached()) {
            win.webContents.debugger.detach();
          }
        } catch {}
        try {
          if (!win.isDestroyed()) {
            win.destroy();
          }
        } catch {}
      }
    };

    try {
      const capturedEndpoints: CapturedApiEndpoint[] = [];
      try {
        if (!debuggerAttached) {
          win.webContents.debugger.attach('1.3');
          debuggerAttached = true;
        }

        // Anti-Bot Stealth Injection via CDP (Her renderda aktif)
        await win.webContents.debugger.sendCommand('Page.enable').catch(() => {});
        await win.webContents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
          source: `
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'languages', { get: () => ['tr-TR', 'tr', 'en-US', 'en'] });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(parameter) {
              if (parameter === 37445) return 'Intel Inc.';
              if (parameter === 37446) return 'Intel Iris OpenGL Engine';
              return getParameter.call(this, parameter);
            };
          `
        }).catch(() => {});

        if (options.captureApi) {
          await win.webContents.debugger.sendCommand('Network.enable').catch(() => {});
          win.webContents.debugger.on('message', async (_event, method, params) => {
            if (method === 'Network.responseReceived') {
              const { response, requestId, type } = params as any;
              if (
                type === 'XHR' || 
                type === 'Fetch' || 
                (response?.mimeType && response.mimeType.includes('json'))
              ) {
                try {
                  const bodyObj = await win.webContents.debugger.sendCommand('Network.getResponseBody', { requestId }) as any;
                  let responseData: any = bodyObj?.body;
                  if (response?.mimeType?.includes('json') && typeof bodyObj?.body === 'string') {
                    try {
                      responseData = JSON.parse(bodyObj.body);
                    } catch {}
                  }
                  const endpointUrl = new URL(response.url);
                  capturedEndpoints.push({
                    url: response.url,
                    pathname: endpointUrl.pathname,
                    method: response.requestHeaders?.[':method'] || 'GET',
                    status: response.status,
                    contentType: response.mimeType || 'application/json',
                    responseData,
                    timestamp: Date.now(),
                  });
                } catch {}
              }
            }
          });
        }
      } catch (err) {
        console.warn('PageRenderer: CDP entegrasyonu başarısız oldu.', err);
      }

      // Yükleme promise'i
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`PageRenderer zaman aşımına uğradı (${timeoutMs}ms): ${url}`));
        }, timeoutMs);

        win.webContents.once('did-finish-load', async () => {
          clearTimeout(timer);
          try {
            // OTO-KAYDIRMA
            await win.webContents.executeJavaScript(`
              new Promise((resolveStep) => {
                let totalHeight = 0;
                let distance = 600;
                let scrolls = 0;
                const maxScrolls = 15;
                const scrollTimer = setInterval(() => {
                  const scrollHeight = document.documentElement.scrollHeight;
                  window.scrollBy(0, distance);
                  totalHeight += distance;
                  scrolls++;
                  if (totalHeight >= scrollHeight || scrolls >= maxScrolls) {
                    clearInterval(scrollTimer);
                    window.scrollTo(0, 0);
                    resolveStep();
                  }
                }, 250);
              });
            `);
          } catch (e) {
            console.warn('Oto-kaydirma basarisiz:', e);
          }

          // OTONOM DURUM GEZGİNİ (Safe Interactive DOM Expansion)
          try {
            await win.webContents.executeJavaScript(`
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
                  let idx = 0;
                  const maxExpands = 25;
                  
                  if (candidates.length === 0) {
                    resolveExpand();
                    return;
                  }

                  const interval = setInterval(() => {
                    if (idx >= candidates.length || idx >= maxExpands) {
                      clearInterval(interval);
                      resolveExpand();
                      return;
                    }
                    const el = candidates[idx++];
                    if (el && !el.closest('form') && el.tagName !== 'A' && el.getAttribute('type') !== 'submit') {
                      try {
                        el.click();
                      } catch {}
                    }
                  }, 60);
                } catch {
                  resolveExpand();
                }
              });
            `).catch(() => {});
          } catch (e) {
            console.warn('Otonom durum gezgini basarisiz:', e);
          }

          // Network Idle
          setTimeout(resolve, 1500);
        });

        win.webContents.once('did-fail-load', (_, errorCode, errorDescription) => {
          clearTimeout(timer);
          reject(new Error(`Sayfa yüklenemedi [${errorCode}]: ${errorDescription}`));
        });

        win.loadURL(url).catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
      });

      // 1. JS Değişkenleri, DOM HTML, CSS Değişkenleri, Bileşenler ve Computed Stilleri topla
      const rawData = await win.webContents.executeJavaScript(`
        (() => {
          try {
            // (a) JS Globals
            const globals = Object.keys(window).slice(0, 500);

            // (b) CSS Variables (:root ve stylesheets)
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
                } catch (sheetErr) {}
              }
            } catch (styleErr) {}

            // (c) Computed Style Taraması
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
            elements.forEach(el => {
              const style = window.getComputedStyle(el);

              // Renkler
              [style.backgroundColor, style.color, style.borderColor].forEach(c => {
                if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') {
                  colorMap[c] = (colorMap[c] || 0) + 1;
                }
              });

              // Font
              if (style.fontFamily) {
                fontFamilies.add(style.fontFamily);
              }

              // Typo role tespiti
              const tag = el.tagName.toUpperCase();
              if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'BODY', 'BUTTON', 'A', 'CODE', 'PRE'].includes(tag)) {
                typoList.push({
                  tag,
                  fontFamily: style.fontFamily,
                  fontSize: style.fontSize,
                  fontWeight: style.fontWeight,
                  lineHeight: style.lineHeight,
                  letterSpacing: style.letterSpacing
                });
              }

              // Spacing (margin/padding/gap)
              [style.marginTop, style.marginBottom, style.paddingTop, style.paddingBottom, style.gap].forEach(val => {
                if (val && val.endsWith('px')) {
                  const num = parseFloat(val);
                  if (num > 0 && num <= 128) spacingSet.add(num);
                }
              });

              // Gölgeler (Box Shadow)
              if (style.boxShadow && style.boxShadow !== 'none') {
                shadowMap[style.boxShadow] = (shadowMap[style.boxShadow] || 0) + 1;
              }

              // Border Radius
              if (style.borderRadius && style.borderRadius !== '0px') {
                radiusSet.add(style.borderRadius);
              }

              // Gradients
              if (style.backgroundImage && style.backgroundImage.includes('gradient')) {
                gradientSet.add(style.backgroundImage);
              }

              // Backdrop Filter (Glassmorphism)
              if (style.backdropFilter && style.backdropFilter !== 'none') {
                blurSet.add(style.backdropFilter);
              }

              // Container Max-Width
              if (style.maxWidth && style.maxWidth.endsWith('px')) {
                const w = parseFloat(style.maxWidth);
                if (w >= 640 && w <= 2560) containerSet.add(style.maxWidth);
              }
            });

            // (d) Sayfa Bileşen Mimarisi Tespiti (Navbar, Hero, Footer)
            const components = [];

            // 1. Navbar / Header
            const navEl = document.querySelector('header, nav, [role="banner"], [class*="nav"], [class*="header"]');
            if (navEl) {
              const s = window.getComputedStyle(navEl);
              const links = Array.from(navEl.querySelectorAll('a'))
                .map(a => ({ text: a.innerText.trim(), href: a.getAttribute('href') || '' }))
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
                layout: \`display: \${s.display}; flex-direction: \${s.flexDirection}; justify-content: \${s.justifyContent}; align-items: \${s.alignItems}\`,
                height: s.height,
                background: s.backgroundColor,
                border: s.borderBottom,
                backdropFilter: s.backdropFilter !== 'none' ? s.backdropFilter : undefined,
                links,
                ctas
              });
            }

            // 2. Hero Section
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
                layout: \`display: \${s.display}; flex-direction: \${s.flexDirection}; align-items: \${s.alignItems}\`,
                minHeight: s.minHeight,
                background: s.backgroundColor,
                h1,
                subhead: subhead.slice(0, 200),
                ctas
              });
            }

            // 3. Footer
            const footerEl = document.querySelector('footer, [role="contentinfo"], [class*="footer"]');
            if (footerEl) {
              const s = window.getComputedStyle(footerEl);
              const links = Array.from(footerEl.querySelectorAll('a'))
                .map(a => ({ text: a.innerText.trim(), href: a.getAttribute('href') || '' }))
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

            // (e) Varlıklar (Logo, SVG adedi, Harici Font Linkleri)
            let logoUrl = '';
            const logoImg = document.querySelector('header img, nav img, [class*="logo"] img');
            if (logoImg) logoUrl = logoImg.getAttribute('src') || '';

            const fontLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"], link[rel="preload"][as="font"]'))
              .map(l => l.getAttribute('href') || '')
              .filter(h => h && (h.includes('fonts.') || h.includes('.woff') || h.includes('.ttf')))
              .slice(0, 5);

            const svgCount = document.querySelectorAll('svg').length;

            return {
              html: document.documentElement ? (() => { try { return '<html' + Array.from(document.documentElement.attributes).map(a => ' ' + a.name + '="' + a.value + '"').join('') + '>' + document.documentElement.getInnerHTML({ includeShadowRoots: true }) + '</html>'; } catch(e) { return document.documentElement.outerHTML; } })() : '',
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
                svgCount,
                externalFonts: fontLinks
              }
            };
          } catch (e) {
            return {
              html: document.documentElement ? (() => { try { return '<html' + Array.from(document.documentElement.attributes).map(a => ' ' + a.name + '="' + a.value + '"').join('') + '>' + document.documentElement.getInnerHTML({ includeShadowRoots: true }) + '</html>'; } catch(e) { return document.documentElement.outerHTML; } })() : '',
              globals: Object.keys(window).slice(0, 100),
              colors: {},
              fontFamilies: [],
              typos: [],
              spacings: [],
              cssVariables: {},
              shadows: [],
              radii: [],
              gradients: [],
              backdropBlurs: [],
              containerWidths: [],
              components: [],
              assets: {}
            };
          }
        })()
      `);

      // 2. Ekran Görüntüsü Al (PNG Buffer)
      const nativeImage = await win.webContents.capturePage();
      const screenshot = nativeImage.toPNG();

      // 3. Renk Token'larını Formatla
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

        return {
          hex,
          role,
          frequency: freq,
        };
      });

      // 4. Tipografi Token'larını Formatla
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

      const shadowTokens = (rawData.shadows || []).map((s: string, idx: number) => ({
        name: idx === 0 ? 'sm' : idx === 1 ? 'md' : idx === 2 ? 'lg' : `elevation-${idx + 1}`,
        value: s,
      }));

      const radiusTokens = (rawData.radii || []).map((r: string, idx: number) => ({
        name: idx === 0 ? 'sm' : idx === 1 ? 'md' : idx === 2 ? 'lg' : `radius-${idx + 1}`,
        value: r,
      }));

      const designTokens: DesignTokens = {
        colors: colorTokens,
        typography: typographyTokens,
        spacing: spacingTokens,
        cssVariables: rawData.cssVariables || {},
        shadows: shadowTokens,
        radii: radiusTokens,
        gradients: rawData.gradients || [],
        backdropBlurs: rawData.backdropBlurs || [],
        containerWidths: rawData.containerWidths || [],
        components: rawData.components || [],
        assets: rawData.assets || {},
      };

      return {
        html: rawData.html || '',
        globals: rawData.globals || [],
        screenshot,
        designTokens,
        capturedEndpoints,
      };
    } finally {
      cleanup();
    }
  }
}
