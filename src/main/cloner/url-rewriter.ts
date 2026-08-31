import * as cheerio from 'cheerio';
import path from 'path';

export interface UrlRewriteContext {
  currentPageUrl: string;
  currentLocalFilePath: string;
  siteRootPath: string;
  urlMap: Map<string, string>; // assetUrl -> absoluteLocalFilePath
}

/**
 * İndirilen sayfaların HTML ve CSS içerisindeki tüm linkleri offline çalışabilir relative yollara dönüştürür.
 * Kayıpsız arama (fuzzy match), SVG use sprite'ları, srcset ve lazy-load desteği sunar.
 */
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

    // 3. Query Parametresi (?) Temizlenmiş Eşleşme
    const noQuery = noHash.split('?')[0];
    if (urlMap.has(noQuery)) return urlMap.get(noQuery);

    // 4. Trailing Slash (/) Toleransı
    const slashToggled = noQuery.endsWith('/') ? noQuery.slice(0, -1) : `${noQuery}/`;
    if (urlMap.has(slashToggled)) return urlMap.get(slashToggled);

    // 5. Origin ve Pathname Eşleşmesi (Farklı query parametrelerine sahip aynı varlıklar için)
    try {
      const targetParsed = new URL(targetUrl);
      for (const [key, localPath] of urlMap.entries()) {
        try {
          const keyParsed = new URL(key);
          if (keyParsed.origin === targetParsed.origin && keyParsed.pathname === targetParsed.pathname) {
            return localPath;
          }
        } catch {}
      }
    } catch {}

    return undefined;
  }

  /**
   * HTML içeriğindeki tüm link, görsel, script, font, video, svg ve stil referanslarını offline yollara çevirir.
   */
  public static rewriteHtml(html: string, context: UrlRewriteContext): string {
    const $ = cheerio.load(html);
    const currentDir = path.dirname(context.currentLocalFilePath);

    const resolveRelativePath = (targetLocalAbsPath: string): string => {
      let rel = path.relative(currentDir, targetLocalAbsPath);
      // Windows ters slash'leri web standardı düz slash'e çevir
      rel = rel.split(path.sep).join('/');
      return rel.startsWith('.') ? rel : `./${rel}`;
    };

    // 0. <base href="..."> Etiketini Etkisizleştir (Offline göreceli linkleri kırmaması için zorunlu)
    $('base[href]').each((_, elem) => {
      $(elem).remove();
    });

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
      { selector: 'audio[src]', attr: 'src' },
      { selector: 'track[src]', attr: 'track' },
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

      const newSrcset = srcset
        .split(',')
        .map(entry => {
          const parts = entry.trim().split(/\s+/);
          const rawUrl = parts[0];
          const descriptor = parts[1] || '';

          if (!rawUrl || rawUrl.startsWith('data:')) return entry.trim();

          try {
            const absoluteUrl = new URL(rawUrl, context.currentPageUrl).href;
            const mappedLocalPath = UrlRewriter.findMappedLocalPath(context.urlMap, absoluteUrl);
            if (mappedLocalPath) {
              const rel = resolveRelativePath(mappedLocalPath);
              return `${rel} ${descriptor}`.trim();
            }
          } catch {}
          return entry.trim();
        })
        .join(', ');

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

    // 6. Service Worker Etkisizleştirme (Offline gezinmede çökme veya sahte ağ yönlendirmelerini önler)
    const swBypassScript = `
<script>
  /* WebClone Studio Offline Service Worker Bypass */
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register = function() { return new Promise(function(){}); };
    navigator.serviceWorker.getRegistrations = function() { return Promise.resolve([]); };
  }
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

    const resolveRelativePath = (targetLocalAbsPath: string): string => {
      let rel = path.relative(currentDir, targetLocalAbsPath);
      rel = rel.split(path.sep).join('/');
      return rel.startsWith('.') ? rel : `./${rel}`;
    };

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
          return `url("${newRelative}${hashPart}")`;
        }
      } catch {}

      return match;
    });

    return rewrittenCss;
  }
}
