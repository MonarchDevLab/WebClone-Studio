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
        const isInternalDomain = parsed.origin === baseOrigin;

        // Harici varlık ayar kontrolü
        if (!isInternalDomain && !settings.downloadExternalAssets) {
          return;
        }

        const ext = parsed.pathname.split('.').pop()?.toLowerCase() || '';
        let type: DiscoveredAsset['type'] = 'other';

        if (['woff', 'woff2', 'ttf', 'otf', 'eot'].includes(ext)) {
          if (!settings.downloadFonts) return;
          type = 'font';
        } else if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'avif', 'ico'].includes(ext)) {
          if (!settings.downloadImages) return;
          type = 'image';
        } else if (['mp4', 'webm', 'ogg', 'mp3', 'wav'].includes(ext)) {
          if (!settings.downloadMedia) return;
          type = 'media';
        } else if (ext === 'css') {
          type = 'css';
        }

        assets.push({
          url: cleanUrl,
          type,
          isPage: false,
        });
      } catch {}
    };

    // 1. url(...) kalıpları
    const urlPattern = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
    let match;
    while ((match = urlPattern.exec(cssContent)) !== null) {
      addCssAsset(match[2]);
    }

    // 2. @import kalıpları (@import "style.css"; veya @import url("style.css");)
    const importPattern = /@import\s+(?:url\(['"]?([^'")]+)['"]?\)|['"]([^'"]+)['"])/gi;
    let importMatch;
    while ((importMatch = importPattern.exec(cssContent)) !== null) {
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

    const addAsset = (rawUrl: string | undefined, type: DiscoveredAsset['type'], isPage: boolean = false) => {
      if (!rawUrl || rawUrl.startsWith('#') || rawUrl.startsWith('javascript:') || rawUrl.startsWith('data:') || rawUrl.startsWith('mailto:') || rawUrl.startsWith('tel:')) {
        return;
      }

      try {
        const absoluteUrl = new URL(rawUrl, pageUrl).href;
        const cleanUrl = absoluteUrl.split('#')[0];
        
        if (!cleanUrl || seenUrls.has(cleanUrl)) return;
        seenUrls.add(cleanUrl);

        const parsed = new URL(cleanUrl);
        const isInternalDomain = parsed.origin === baseOrigin;

        const ext = parsed.pathname.split('.').pop()?.toLowerCase() || '';
        const nonPageExtensions = new Set([
          'pdf', 'zip', 'rar', '7z', 'tar', 'gz', 'dmg', 'exe', 'apk',
          'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'ico', 'avif',
          'mp4', 'webm', 'ogg', 'mp3', 'wav', 'mov', 'm4v',
          'docx', 'xlsx', 'pptx', 'csv', 'xml', 'json'
        ]);

        if (isPage && nonPageExtensions.has(ext)) {
          isPage = false;
          if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'ico', 'avif'].includes(ext)) {
            type = 'image';
          } else if (['mp4', 'webm', 'ogg', 'mp3', 'wav', 'mov', 'm4v'].includes(ext)) {
            type = 'media';
          } else {
            type = 'other';
          }
        }

        // Harici domain varlıkları filtre kontrolü
        if (!isInternalDomain && !settings.downloadExternalAssets && !isPage) {
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
        if (isPage && isInternalDomain) {
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

    // 4. Resimler (src, srcset, data-src, data-srcset, lazy-loading)
    $('img').each((_, el) => {
      const src = $(el).attr('src');
      const dataSrc = $(el).attr('data-src') || $(el).attr('data-original') || $(el).attr('data-lazy-src');
      const srcset = $(el).attr('srcset');
      const dataSrcset = $(el).attr('data-srcset');

      if (src) addAsset(src, 'image');
      if (dataSrc) addAsset(dataSrc, 'image');
      parseSrcset(srcset);
      parseSrcset(dataSrcset);
    });

    // Picture element source[srcset] ve source[src]
    $('picture source').each((_, el) => {
      const srcset = $(el).attr('srcset');
      const src = $(el).attr('src');
      if (srcset) parseSrcset(srcset);
      if (src) addAsset(src, 'image');
    });

    // 5. Favicon, Apple Touch Icon ve Manifest
    $('link[rel*="icon"][href], link[rel="apple-touch-icon"][href], link[rel="apple-touch-startup-image"][href]').each((_, el) => {
      addAsset($(el).attr('href'), 'image');
    });
    $('link[rel="manifest"][href]').each((_, el) => {
      addAsset($(el).attr('href'), 'other');
    });

    // 6. Font Dosyaları (link[as="font"][href])
    $('link[as="font"][href]').each((_, el) => {
      addAsset($(el).attr('href'), 'font');
    });

    // 7. Video, Ses ve Medya (poster dahil)
    $('video').each((_, el) => {
      const src = $(el).attr('src');
      const poster = $(el).attr('poster');
      if (src) addAsset(src, 'media');
      if (poster) addAsset(poster, 'image');
    });
    $('video source[src], audio source[src], track[src]').each((_, el) => {
      addAsset($(el).attr('src'), 'media');
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
