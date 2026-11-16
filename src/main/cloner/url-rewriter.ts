import * as cheerio from 'cheerio';
import path from 'path';

export interface UrlRewriteContext {
  currentPageUrl: string;
  currentLocalFilePath: string;
  siteRootPath: string;
  urlMap: Map<string, string>; // assetUrl -> absoluteLocalFilePath
  mockApiDb?: Record<string, Record<string, { status: number; contentType: string; data: any }>>;
}

/**
 * İndirilen sayfaların HTML ve CSS içerisindeki tüm linkleri offline çalışabilir relative yollara dönüştürür.
 * Kayıpsız arama (fuzzy match), SVG use sprite'ları, srcset ve lazy-load desteği sunar.
 */
function isQuerySensitiveAssetUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (!u.search || u.search.length <= 1) return false;
    return /\/(?:_next\/image|_ipx|cdn-cgi\/image)(?:\/|$)/i.test(u.pathname);
  } catch {
    return false;
  }
}

export class UrlRewriter {
  /**
   * urlMap içinde çok katmanlı akıllı arama yapar (Query param, hash, trailing slash toleransı).
   */
  public static findMappedLocalPath(urlMap: Map<string, string>, targetUrl: string): string | undefined {
    if (!targetUrl) return undefined;

    // 1. Birebir Tam Eşleşme
    if (urlMap.has(targetUrl)) return urlMap.get(targetUrl);

    // 2. Hash (#) Temizlenmiş Eşleşme
    const noHash = targetUrl.split('#')[0];
    if (urlMap.has(noHash)) return urlMap.get(noHash);

    // 2.1 Sıralı Query Parametresi Eşleşmesi (/_next/image?url=...&w=... sırasından bağımsız)
    try {
      const u = new URL(noHash);
      if (u.search) {
        const sorted = new URLSearchParams(Array.from(u.searchParams.entries()).sort()).toString();
        const canonical = `${u.origin}${u.pathname}?${sorted}`;
        if (urlMap.has(canonical)) return urlMap.get(canonical);
      }
    } catch {}

    // 3. Query Parametresi (?) Temizlenmiş Eşleşme (dinamik proxy uç noktalarında asla birleştirme)
    const noQuery = noHash.split('?')[0];
    if (!isQuerySensitiveAssetUrl(noHash) && urlMap.has(noQuery)) {
      return urlMap.get(noQuery);
    }

    // 4. Trailing Slash (/) Toleransı
    const slashToggled = noQuery.endsWith('/') ? noQuery.slice(0, -1) : `${noQuery}/`;
    if (!isQuerySensitiveAssetUrl(noHash) && urlMap.has(slashToggled)) {
      return urlMap.get(slashToggled);
    }

    return undefined;
  }

  /**
   * İki mutlak dosya yolu arasındaki web uyumlu göreceli yolu hesaplar.
   * Windows farklı sürücü ve kök farklılıklarını güvenle ele alır.
   */
  public static resolveRelativePath(fromDir: string, targetLocalAbsPath: string): string {
    const fromRoot = path.parse(fromDir).root.toLowerCase();
    const targetRoot = path.parse(targetLocalAbsPath).root.toLowerCase();
    if (fromRoot && targetRoot && fromRoot !== targetRoot) {
      return targetLocalAbsPath.split(path.sep).join('/');
    }
    let rel = path.relative(fromDir, targetLocalAbsPath);
    rel = rel.split(path.sep).join('/');
    return rel.startsWith('.') ? rel : `./${rel}`;
  }

  /**
   * HTML içeriğindeki tüm link, görsel, script, font, video, svg ve stil referanslarını offline yollara çevirir.
   */
  public static rewriteHtml(html: string, context: UrlRewriteContext): string {
    const $ = cheerio.load(html);
    const currentDir = path.dirname(context.currentLocalFilePath);
    const resolveRelativePath = (targetLocalAbsPath: string) => UrlRewriter.resolveRelativePath(currentDir, targetLocalAbsPath);

    // 0. Güvensiz veya Offline Engelleyici Meta Etiketlerini Temizle
    $('base[href]').remove();
    $('meta[http-equiv="Content-Security-Policy" i]').remove();
    $('meta[http-equiv="refresh" i]').remove();
    $('meta[http-equiv="origin-trial" i]').remove();

    // 1. Standart Nitelikler İçin URL Dönüşümü
    const attributesToRewrite: Array<{ selector: string; attr: string }> = [
      { selector: 'a[href]', attr: 'href' },
      { selector: 'area[href]', attr: 'href' },
      { selector: 'link[href]', attr: 'href' },
      { selector: 'script[src]', attr: 'src' },
      { selector: 'img[src]', attr: 'src' },
      { selector: 'img[data-src]', attr: 'data-src' },
      { selector: 'img[data-original]', attr: 'data-original' },
      { selector: 'img[data-lazy-src]', attr: 'data-lazy-src' },
      { selector: 'source[src]', attr: 'src' },
      { selector: 'video[src]', attr: 'src' },
      { selector: 'video[poster]', attr: 'poster' },
      { selector: 'video[data-poster]', attr: 'data-poster' },
      { selector: 'audio[src]', attr: 'src' },
      { selector: 'track[src]', attr: 'src' },
      { selector: '[data-bg]', attr: 'data-bg' },
      { selector: '[data-background]', attr: 'data-background' },
      { selector: '[data-background-image]', attr: 'data-background-image' },
      { selector: 'iframe[src]', attr: 'src' },
      { selector: 'embed[src]', attr: 'src' },
      { selector: 'object[data]', attr: 'data' },
      { selector: 'meta[property="og:image"]', attr: 'content' },
      { selector: 'meta[name="twitter:image"]', attr: 'content' },
    ];

    for (const { selector, attr } of attributesToRewrite) {
      $(selector).each((_, elem) => {
        const val = $(elem).attr(attr);
        if (!val || val.startsWith('#') || val.startsWith('javascript:') || val.startsWith('data:') || val.startsWith('mailto:') || val.startsWith('tel:')) {
          return;
        }

        if ((attr === 'data-bg' || attr.startsWith('data-background')) && /url\(/i.test(val)) {
          $(elem).attr(attr, UrlRewriter.rewriteCss(val, context));
          return;
        }

        try {
          const hashIndex = val.indexOf('#');
          const hashPart = hashIndex !== -1 ? val.slice(hashIndex) : '';
          const absoluteUrl = new URL(val, context.currentPageUrl).href;
          const mappedLocalPath = UrlRewriter.findMappedLocalPath(context.urlMap, absoluteUrl);

          if (mappedLocalPath) {
            const newRelativeUrl = resolveRelativePath(mappedLocalPath) + hashPart;
            $(elem).attr(attr, newRelativeUrl);

            // Lazy-loading resimler için: Eğer src boş veya 1x1 placeholder ise, data-src'yi doğrudan src'ye terfi ettir
            if (attr.startsWith('data-') && $(elem).is('img')) {
              const currentSrc = $(elem).attr('src');
              if (!currentSrc || currentSrc.startsWith('data:image') || currentSrc.includes('blank.gif')) {
                $(elem).attr('src', newRelativeUrl);
              }
            }
          }
        } catch {
          // Geçersiz URL ise dokunma
        }
      });
    }

    // 2. img[srcset], source[srcset], img[data-srcset] Dönüşümü
    $('img[srcset], source[srcset], img[data-srcset]').each((_, elem) => {
      const attrName = $(elem).attr('srcset') ? 'srcset' : 'data-srcset';
      const srcset = $(elem).attr(attrName);
      if (!srcset) return;

      const entries: string[] = [];
      const re = /\s*(data:[^,]+,[^\s,]+|\S+)(?:\s+([\d.]+[wx]))?\s*(?:,|$)/gi;
      let match: RegExpExecArray | null;
      while ((match = re.exec(srcset)) !== null) {
        const rawUrl = match[1];
        const descriptor = match[2] || '';
        if (!rawUrl || rawUrl.startsWith('data:')) {
          entries.push(descriptor ? `${rawUrl} ${descriptor}` : rawUrl);
          continue;
        }

        try {
          const absoluteUrl = new URL(rawUrl, context.currentPageUrl).href;
          const mappedLocalPath = UrlRewriter.findMappedLocalPath(context.urlMap, absoluteUrl);
          if (mappedLocalPath) {
            const rel = resolveRelativePath(mappedLocalPath);
            entries.push(descriptor ? `${rel} ${descriptor}` : rel);
            continue;
          }
        } catch {}
        entries.push(descriptor ? `${rawUrl} ${descriptor}` : rawUrl);
      }

      const newSrcset = entries.join(', ');
      $(elem).attr(attrName, newSrcset);
      if (attrName === 'data-srcset' && !$(elem).attr('srcset')) {
        $(elem).attr('srcset', newSrcset);
      }
    });

    // 3. SVG <use href="..."> ve <use xlink:href="..."> Dönüşümü (SVG Simgeleri)
    $('use').each((_, elem) => {
      const rawHref = $(elem).attr('href') || $(elem).attr('xlink:href');
      if (!rawHref || rawHref.startsWith('#')) return;

      try {
        const [filePart, hashPart] = rawHref.split('#');
        const absoluteUrl = new URL(filePart, context.currentPageUrl).href;
        const mappedLocalPath = UrlRewriter.findMappedLocalPath(context.urlMap, absoluteUrl);

        if (mappedLocalPath) {
          const rel = resolveRelativePath(mappedLocalPath);
          const finalHref = hashPart ? `${rel}#${hashPart}` : rel;
          if ($(elem).attr('href')) $(elem).attr('href', finalHref);
          if ($(elem).attr('xlink:href')) $(elem).attr('xlink:href', finalHref);
        }
      } catch {}
    });

    // 4. Inline style="background-image: url(...)" Dönüşümü
    $('[style*="url("]').each((_, elem) => {
      const style = $(elem).attr('style');
      if (!style) return;

      const rewrittenStyle = UrlRewriter.rewriteCss(style, context);
      $(elem).attr('style', rewrittenStyle);
    });

    // 5. <style> Etiketleri İçindeki CSS Dönüşümü
    $('style').each((_, elem) => {
      const cssContent = $(elem).html();
      if (!cssContent) return;

      const rewrittenCss = UrlRewriter.rewriteCss(cssContent, context);
      $(elem).html(rewrittenCss);
    });

    // 6. Service Worker Replay & Dual Fetch/XHR Offline Mock Shim
    const hasMocks = context.mockApiDb && Object.keys(context.mockApiDb).length > 0;
    const safeMockJson = hasMocks
      ? JSON.stringify(context.mockApiDb).replace(/<\//g, '<\\/')
      : '';
    const fetchShimCode = hasMocks
      ? `
  var __wcMocks = ${safeMockJson};
  function __wcLookupMock(reqUrl, method) {
    try {
      var parsed = new URL(reqUrl, window.location.href);
      var pathKey = (parsed.pathname || '/').replace(/\\/+$/, '') || '/';
      var upper = (method || 'GET').toUpperCase();
      return (__wcMocks[pathKey] && __wcMocks[pathKey][upper]) || (__wcMocks[pathKey + '/'] && __wcMocks[pathKey + '/'][upper]) || null;
    } catch (e) { return null; }
  }
  if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    var __origFetch = window.fetch.bind(window);
    window.fetch = function(input, init) {
      var reqUrl = typeof input === 'string' ? input : (input && input.url ? input.url : String(input));
      var method = ((init && init.method) || (input && input.method) || 'GET');
      var hit = __wcLookupMock(reqUrl, method);
      if (hit) {
        var bodyStr = typeof hit.data === 'string' ? hit.data : JSON.stringify(hit.data);
        return Promise.resolve(new Response(bodyStr, { status: hit.status || 200, headers: { 'Content-Type': hit.contentType || 'application/json' } }));
      }
      return __origFetch(input, init);
    };
  }
  if (typeof window !== 'undefined' && typeof window.XMLHttpRequest === 'function') {
    var __origOpen = XMLHttpRequest.prototype.open;
    var __origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url) {
      this.__wcMethod = method;
      this.__wcUrl = url;
      return __origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function() {
      var hit = this.__wcUrl ? __wcLookupMock(this.__wcUrl, this.__wcMethod || 'GET') : null;
      if (hit) {
        var self = this;
        var bodyStr = typeof hit.data === 'string' ? hit.data : JSON.stringify(hit.data);
        setTimeout(function() {
          try {
            Object.defineProperty(self, 'readyState', { configurable: true, value: 4 });
            Object.defineProperty(self, 'status', { configurable: true, value: hit.status || 200 });
            Object.defineProperty(self, 'responseText', { configurable: true, value: bodyStr });
            Object.defineProperty(self, 'response', { configurable: true, value: bodyStr });
            if (typeof self.onreadystatechange === 'function') self.onreadystatechange(new Event('readystatechange'));
            if (typeof self.onload === 'function') self.onload(new ProgressEvent('load'));
          } catch (e) {}
        }, 0);
        return;
      }
      return __origSend.apply(this, arguments);
    };
  }`
      : '';

    const swBypassScript = `
<script>
  /* WebClone Studio Offline Service Worker & Dual Fetch/XHR Mock Shim */
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    var __origSwReg = typeof navigator.serviceWorker.register === 'function' ? navigator.serviceWorker.register.bind(navigator.serviceWorker) : null;
    if (__origSwReg && typeof location !== 'undefined' && location.protocol && location.protocol.indexOf('http') === 0) {
      __origSwReg('/_sw-replay.js', { scope: '/' }).catch(function(){});
    }
    var __mockReg = { scope: '/', installing: null, waiting: null, active: { state: 'activated', scriptURL: '/_sw-replay.js' }, update: function() { return Promise.resolve(); }, unregister: function() { return Promise.resolve(true); }, addEventListener: function() {}, removeEventListener: function() {} };
    navigator.serviceWorker.register = function() { return Promise.resolve(__mockReg); };
    navigator.serviceWorker.getRegistrations = function() { return Promise.resolve([__mockReg]); };
  }${fetchShimCode}
</script>`;
    if ($('head').length > 0) {
      $('head').prepend(swBypassScript);
    }

    return $.html();
  }

  /**
   * CSS içeriğindeki url(...) ve @import ifadelerini offline relative yollara çevirir.
   */
  public static rewriteCss(css: string, context: UrlRewriteContext): string {
    const currentDir = path.dirname(context.currentLocalFilePath);
    const resolveRelativePath = (targetLocalAbsPath: string) => UrlRewriter.resolveRelativePath(currentDir, targetLocalAbsPath);

    // 1. @import "..." veya @import url("...") dönüşümü
    const importPattern = /@import\s+(?:url\(['"]?([^'")]+)['"]?\)|['"]([^'"]+)['"])([^;]*);/gi;
    let rewrittenCss = css.replace(importPattern, (match, url1, url2, rest) => {
      const rawUrl = (url1 || url2 || '').trim();
      if (!rawUrl || rawUrl.startsWith('data:')) return match;

      try {
        const absoluteUrl = new URL(rawUrl, context.currentPageUrl).href;
        const mappedLocalPath = UrlRewriter.findMappedLocalPath(context.urlMap, absoluteUrl);
        if (mappedLocalPath) {
          const rel = resolveRelativePath(mappedLocalPath);
          return `@import "${rel}"${rest || ''};`;
        }
      } catch {}
      return match;
    });

    // 2. url(...) dönüşümü (fontlar, arka plan resimleri vb.)
    const urlPattern = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
    rewrittenCss = rewrittenCss.replace(urlPattern, (match, quote, urlValue) => {
      const cleanUrl = urlValue.trim().replace(/^['"]|['"]$/g, '');
      if (cleanUrl.startsWith('data:') || cleanUrl.startsWith('#') || !cleanUrl) {
        return match;
      }

      try {
        const hashIndex = cleanUrl.indexOf('#');
        const hashPart = hashIndex !== -1 ? cleanUrl.slice(hashIndex) : '';
        const absoluteUrl = new URL(cleanUrl, context.currentPageUrl).href;
        const mappedLocalPath = UrlRewriter.findMappedLocalPath(context.urlMap, absoluteUrl);

        if (mappedLocalPath) {
          const newRelative = resolveRelativePath(mappedLocalPath);
          // Sadece geçerli fragment identifier (#id) tut, ?#iefix gibi bozuk disk parametrelerini temizle
          const cleanHash = /^#[a-zA-Z0-9_\-]+$/.test(hashPart) ? hashPart : '';
          return `url("${newRelative}${cleanHash}")`;
        }
      } catch {}

      return match;
    });

    return rewrittenCss;
  }
}
