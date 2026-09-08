import * as cheerio from 'cheerio';
import { CloneSettings } from '../../shared/types';

export interface DiscoveredAsset {
  url: string;
  type: 'html' | 'css' | 'js' | 'image' | 'font' | 'media' | 'other';
  isPage: boolean;
}

export interface ProcessedPageResult {
  html: string;
  pageTitle: string;
  discoveredAssets: DiscoveredAsset[];
  discoveredPages: string[];
}

export function getRootDomain(hostname: string): string {
  const cleanHost = hostname.toLowerCase().trim();
  const parts = cleanHost.split('.');
  if (parts.length <= 2) return cleanHost;
  const commonDoubleExts = ['com.tr', 'edu.tr', 'gov.tr', 'org.tr', 'net.tr', 'co.uk', 'org.uk', 'com.au', 'co.nz'];
  const lastTwo = parts.slice(-2).join('.');
  if (commonDoubleExts.includes(lastTwo) && parts.length > 2) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

export function isInternalDomain(targetUrl: string, baseOriginUrl: string): boolean {
  try {
    const target = new URL(targetUrl);
    const base = new URL(baseOriginUrl);
    if (target.origin === base.origin) return true;
    const targetHost = target.hostname.toLowerCase();
    const baseHost = base.hostname.toLowerCase();

    // www. vs non-www
    if (targetHost.replace(/^www\./, '') === baseHost.replace(/^www\./, '')) {
      return true;
    }
    // Kök domain eşleşmesi (örn: cdn.site.com, blog.site.com, site.com)
    return getRootDomain(targetHost) === getRootDomain(baseHost);
  } catch {
    return false;
  }
}

/**
 * Bir HTML sayfasını veya CSS içeriğini parse ederek içindeki tüm alt sayfaları,
 * görselleri, fontları, stilleri, scriptleri ve medya varlıklarını eksiksiz çıkarır.
 */
export class PageProcessor {
  /**
   * CSS metni içerisindeki url(...) ve @import varlık referanslarını ayrıştırır.
   */
  public static extractCssUrls(
    cssContent: string,
    cssFileUrl: string,
    settings: CloneSettings,
    baseOrigin: string
  ): DiscoveredAsset[] {
    const assets: DiscoveredAsset[] = [];
    const seenUrls = new Set<string>();

    const addCssAsset = (rawUrl: string | undefined) => {
      if (!rawUrl || rawUrl.startsWith('data:') || rawUrl.startsWith('#') || rawUrl.startsWith('javascript:')) {
        return;
      }

      try {
        const cleanRaw = rawUrl.replace(/^['"]|['"]$/g, '').trim();
        const absoluteUrl = new URL(cleanRaw, cssFileUrl).href;
        const cleanUrl = absoluteUrl.split('#')[0];

        if (!cleanUrl || seenUrls.has(cleanUrl)) return;
        seenUrls.add(cleanUrl);

        const parsed = new URL(cleanUrl);
        const isInternal = isInternalDomain(cleanUrl, baseOrigin);

        // Harici varlık ayar kontrolü
        if (!isInternal && !settings.downloadExternalAssets) {
          return;
        }

        const pathname = parsed.pathname.toLowerCase();
        const ext = pathname.split('.').pop() || '';
        let type: DiscoveredAsset['type'] = 'other';

        if (['woff', 'woff2', 'ttf', 'otf', 'eot'].includes(ext)) {
          if (!settings.downloadFonts) return;
          type = 'font';
        } else if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'avif', 'ico', 'bmp'].includes(ext)) {
          if (!settings.downloadImages) return;
          type = 'image';
        } else if (['mp4', 'webm', 'ogg', 'mp3', 'wav'].includes(ext)) {
          if (!settings.downloadMedia) return;
          type = 'media';
        } else if (ext === 'css' || parsed.hostname.includes('fonts.googleapis.com') || pathname.includes('css')) {
          type = 'css';
        }

        assets.push({
          url: cleanUrl,
          type,
          isPage: false,
        });
      } catch {}
    };

    // CSS yorumlarını (/* ... */) temizle
    const cleanCss = cssContent.replace(/\/\*[\s\S]*?\*\//g, '');

    // 1. url(...) kalıpları
    const urlPattern = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
    let match;
    while ((match = urlPattern.exec(cleanCss)) !== null) {
      addCssAsset(match[2]);
    }

    // 2. @import kalıpları (@import "style.css"; veya @import url("style.css");)
    const importPattern = /@import\s+(?:url\(['"]?([^'")]+)['"]?\)|['"]([^'"]+)['"])/gi;
    let importMatch;
    while ((importMatch = importPattern.exec(cleanCss)) !== null) {
      addCssAsset(importMatch[1] || importMatch[2]);
    }

    return assets;
  }

  /**
   * HTML metnini tarar ve tüm varlık/link referanslarını eksiksiz çıkarır.
   */
  public static process(html: string, pageUrl: string, settings: CloneSettings, baseOrigin: string): ProcessedPageResult {
    const $ = cheerio.load(html);
    const pageTitle = $('title').text().trim() || new URL(pageUrl).pathname;
    const discoveredAssets: DiscoveredAsset[] = [];
    const discoveredPages: string[] = [];
    const seenUrls = new Set<string>();

    const addAsset = (rawUrl: string | undefined, initialType: DiscoveredAsset['type'], initialIsPage: boolean = false) => {
      if (!rawUrl || rawUrl.startsWith('#') || rawUrl.startsWith('javascript:') || rawUrl.startsWith('data:') || rawUrl.startsWith('mailto:') || rawUrl.startsWith('tel:')) {
        return;
      }

      try {
        const absoluteUrl = new URL(rawUrl, pageUrl).href;
        const cleanUrl = absoluteUrl.split('#')[0];
        
        if (!cleanUrl || seenUrls.has(cleanUrl)) return;
        seenUrls.add(cleanUrl);

        const parsed = new URL(cleanUrl);
        const isInternal = isInternalDomain(cleanUrl, baseOrigin);

        const ext = parsed.pathname.split('.').pop()?.toLowerCase() || '';
        const nonPageExtensions = new Set([
          'pdf', 'zip', 'rar', '7z', 'tar', 'gz', 'dmg', 'exe', 'apk',
          'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'ico', 'avif', 'bmp',
          'mp4', 'webm', 'ogg', 'mp3', 'wav', 'mov', 'm4v',
          'docx', 'xlsx', 'pptx', 'csv', 'xml', 'json'
        ]);

        let type = initialType;
        let isPage = initialIsPage;

        if (isPage && nonPageExtensions.has(ext)) {
          isPage = false;
          if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'ico', 'avif', 'bmp'].includes(ext)) {
            type = 'image';
          } else if (['mp4', 'webm', 'ogg', 'mp3', 'wav', 'mov', 'm4v'].includes(ext)) {
            type = 'media';
          } else {
            type = 'other';
          }
        }

        // Sayfa linkleri için: Dış domain sayfaları (Twitter, Facebook vb.) ASLA klonlama kuyruğuna sayfa olarak eklenmez!
        if (isPage && !isInternal) {
          return;
        }

        // Harici domain varlıkları (CDN CSS, JS, Font, Resim) filtre kontrolü
        if (!isInternal && !settings.downloadExternalAssets && !isPage) {
          return;
        }

        // Varlık türü filtre kontrolü
        if (type === 'image' && !settings.downloadImages) return;
        if (type === 'font' && !settings.downloadFonts) return;
        if (type === 'media' && !settings.downloadMedia) return;

        discoveredAssets.push({
          url: cleanUrl,
          type,
          isPage,
        });

        // Sayfa ise ve aynı kök domaindeyse sayfa kuyruğuna da ekle
        if (isPage && isInternal) {
          discoveredPages.push(cleanUrl);
        }
      } catch {
        // Geçersiz URL
      }
    };

    const parseSrcset = (srcsetStr: string | undefined) => {
      if (!srcsetStr) return;
      const re = /\s*(data:[^,]+,[^\s,]+|\S+)(?:\s+[\d.]+[wx])?\s*(?:,|$)/gi;
      let match: RegExpExecArray | null;
      while ((match = re.exec(srcsetStr)) !== null) {
        if (match[1] && !match[1].startsWith('data:')) {
          addAsset(match[1], 'image');
        }
      }
    };

    // 1. Sayfa Linkleri (a[href], area[href])
    $('a[href], area[href]').each((_, el) => {
      addAsset($(el).attr('href'), 'html', true);
    });

    // 2. CSS Dosyaları (link[rel="stylesheet"], link[as="style"])
    $('link[rel="stylesheet"][href], link[rel="preload"][as="style"][href]').each((_, el) => {
      addAsset($(el).attr('href'), 'css');
    });

    // 3. JS Dosyaları (script[src], link[rel="modulepreload"][href], link[as="script"][href])
    $('script[src]').each((_, el) => {
      addAsset($(el).attr('src'), 'js');
    });
    $('link[rel="modulepreload"][href], link[rel="preload"][as="script"][href]').each((_, el) => {
      addAsset($(el).attr('href'), 'js');
    });

    // 4. Preload & Prefetch Resimler ve Fontlar
    $('link[rel="preload"][as="image"][href], link[rel="prefetch"][as="image"][href]').each((_, el) => {
      addAsset($(el).attr('href'), 'image');
    });
    $('link[rel="preload"][as="font"][href], link[rel="prefetch"][as="font"][href]').each((_, el) => {
      addAsset($(el).attr('href'), 'font');
    });

    // 5. Resimler (src, srcset, data-src, data-srcset, data-original, data-lazy-src, data-bg)
    $('img').each((_, el) => {
      const src = $(el).attr('src');
      const dataSrc = $(el).attr('data-src') || $(el).attr('data-original') || $(el).attr('data-lazy-src') || $(el).attr('data-url') || $(el).attr('data-hi-res-src');
      const srcset = $(el).attr('srcset');
      const dataSrcset = $(el).attr('data-srcset');

      if (src) addAsset(src, 'image');
      if (dataSrc) addAsset(dataSrc, 'image');
      parseSrcset(srcset);
      parseSrcset(dataSrcset);
    });

    // Slider ve Banner arka plan resimleri (data-bg, data-background)
    $('[data-bg], [data-background], [data-background-image]').each((_, el) => {
      const bg = $(el).attr('data-bg') || $(el).attr('data-background') || $(el).attr('data-background-image');
      if (bg && !bg.startsWith('data:')) {
        const urlMatch = bg.match(/url\(\s*(?:['"]?)(.*?)(?:['"]?)\s*\)/i);
        const cleanBg = urlMatch ? urlMatch[1] : bg;
        addAsset(cleanBg, 'image');
      }
    });

    // Picture element source[srcset] ve source[src]
    $('picture source').each((_, el) => {
      const srcset = $(el).attr('srcset');
      const src = $(el).attr('src');
      if (srcset) parseSrcset(srcset);
      if (src) addAsset(src, 'image');
    });

    // 6. Favicon, Apple Touch Icon ve Manifest
    $('link[rel*="icon"][href], link[rel="apple-touch-icon"][href], link[rel="apple-touch-startup-image"][href]').each((_, el) => {
      addAsset($(el).attr('href'), 'image');
    });
    $('link[rel="manifest"][href]').each((_, el) => {
      addAsset($(el).attr('href'), 'other');
    });

    // 7. Video, Ses ve Medya (poster ve data-poster dahil)
    $('video').each((_, el) => {
      const src = $(el).attr('src');
      const poster = $(el).attr('poster') || $(el).attr('data-poster');
      if (src) addAsset(src, 'media');
      if (poster) addAsset(poster, 'image');
    });
    $('video source, audio source, track[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (src) addAsset(src, 'media');
      const srcset = $(el).attr('srcset');
      if (srcset) parseSrcset(srcset);
    });
    $('audio[src]').each((_, el) => {
      addAsset($(el).attr('src'), 'media');
    });

    // 8. SVG Simgeleri ve Sprite'lar (<svg><use href="...#icon"></svg>)
    $('use').each((_, el) => {
      const href = $(el).attr('href') || $(el).attr('xlink:href');
      if (href && !href.startsWith('#')) {
        addAsset(href, 'image');
      }
    });

    // 9. Object ve Embed Varlıkları
    $('object[data]').each((_, el) => {
      addAsset($(el).attr('data'), 'other');
    });
    $('embed[src]').each((_, el) => {
      addAsset($(el).attr('src'), 'other');
    });

    // 10. OpenGraph ve Sosyal Medya Önizleme Resimleri
    $('meta[property="og:image"][content], meta[name="twitter:image"][content]').each((_, el) => {
      addAsset($(el).attr('content'), 'image');
    });

    // 11. Inline style="...url(...)..." Araması (Tüm HTML Elemanları)
    $('[style*="url("]').each((_, el) => {
      const styleAttr = $(el).attr('style');
      if (styleAttr) {
        const styleAssets = PageProcessor.extractCssUrls(styleAttr, pageUrl, settings, baseOrigin);
        for (const asset of styleAssets) {
          if (!seenUrls.has(asset.url)) {
            seenUrls.add(asset.url);
            discoveredAssets.push(asset);
          }
        }
      }
    });

    // 12. <style> Etiketleri İçindeki CSS url() ve @import Araması
    $('style').each((_, el) => {
      const inlineCss = $(el).html();
      if (inlineCss) {
        const inlineAssets = PageProcessor.extractCssUrls(inlineCss, pageUrl, settings, baseOrigin);
        for (const asset of inlineAssets) {
          if (!seenUrls.has(asset.url)) {
            seenUrls.add(asset.url);
            discoveredAssets.push(asset);
          }
        }
      }
    });

    return {
      html,
      pageTitle,
      discoveredAssets,
      discoveredPages,
    };
  }
}
