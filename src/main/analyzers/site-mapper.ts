import got from 'got';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import { SiteMapNode } from '../../shared/types';

export class SiteMapper {
  /**
   * XML sitemap veya robots.txt üzerinden sayfaları hızlıca çeker.
   */
  private async tryFetchXmlSitemap(origin: string): Promise<string[] | null> {
    const candidates = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];
    for (const sitemapUrl of candidates) {
      try {
        const res = await got.get(sitemapUrl, {
          timeout: { request: 4000 },
          throwHttpErrors: false,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) WebCloneStudio/1.0' },
        });

        if (res.statusCode === 200 && res.body.includes('<loc>')) {
          const urls: string[] = [];
          const $ = cheerio.load(res.body, { xmlMode: true });
          $('loc').each((_, el) => {
            const foundUrl = $(el).text().trim();
            if (foundUrl && !foundUrl.endsWith('.xml')) {
              try {
                if (new URL(foundUrl).hostname === new URL(origin).hostname) {
                  urls.push(foundUrl);
                }
              } catch {}
            }
          });
          if (urls.length > 0) {
            return Array.from(new Set(urls));
          }
        }
      } catch {}
    }
    return null;
  }

  async map(baseUrl: string, maxDepth: number = 2, maxPages: number = 60): Promise<SiteMapNode> {
    const baseUrlObj = new URL(baseUrl);
    const origin = baseUrlObj.origin;

    // 1. Öncelik: /sitemap.xml kontrolü (Varsa tam ve eksiksiz harita)
    const xmlUrls = await this.tryFetchXmlSitemap(origin);
    if (xmlUrls && xmlUrls.length > 0) {
      const selectedUrls = xmlUrls.slice(0, maxPages);
      const rootNode: SiteMapNode = {
        url: baseUrl,
        title: baseUrlObj.hostname,
        depth: 0,
        statusCode: 200,
        mimeType: 'text/html',
        size: 35000,
        assetCount: 15,
        children: [],
      };

      // URL'leri derinliğe göre gruplayıp çocuk düğüm olarak ekle
      for (const u of selectedUrls) {
        if (u === baseUrl || u === `${baseUrl}/`) continue;
        try {
          const parsed = new URL(u);
          const depth = parsed.pathname.split('/').filter(Boolean).length || 1;
          rootNode.children.push({
            url: u,
            title: parsed.pathname,
            depth: Math.min(depth, maxDepth),
            statusCode: 200,
            mimeType: 'text/html',
            size: 25000,
            assetCount: 10,
            children: [],
          });
        } catch {}
      }

      return rootNode;
    }

    // 2. Fallback: GET tabanlı kontrollü gezinti
    const visited = new Set<string>();
    let pageCount = 0;

    const crawl = async (urlToCrawl: string, currentDepth: number): Promise<SiteMapNode | null> => {
      if (currentDepth > maxDepth || pageCount >= maxPages || visited.has(urlToCrawl)) {
        return null;
      }

      visited.add(urlToCrawl);
      pageCount++;

      try {
        const res = await got.get(urlToCrawl, { 
          timeout: { request: 5000 },
          throwHttpErrors: false,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) WebCloneStudio/1.0',
          }
        });

        const contentType = (res.headers['content-type'] as string) || 'text/html';
        const size = res.rawBody?.length || parseInt(res.headers['content-length'] || '0', 10) || 25000;
        const statusCode = res.statusCode;

        let title = '';
        const children: SiteMapNode[] = [];
        let assetCount = 0;

        if (contentType.includes('text/html') && statusCode < 400 && currentDepth < maxDepth) {
          const $ = cheerio.load(res.body);
          title = $('title').text().trim() || urlToCrawl;

          const assets = new Set<string>();
          $('img[src], script[src], source[src], video[src], audio[src], iframe[src]').each((_, el) => {
            const src = $(el).attr('src');
            if (src) assets.add(src);
          });
          $('link[href]').each((_, el) => {
            const href = $(el).attr('href');
            const rel = $(el).attr('rel');
            if (href && rel !== 'canonical' && rel !== 'alternate') assets.add(href);
          });
          assetCount = assets.size;

          const links = new Set<string>();
          $('a[href]').each((_, el) => {
            const href = $(el).attr('href');
            if (href) links.add(href);
          });

          // Kontrollü eşzamanlı tarama (Sunucudan 429 yemeden hızlı haritalama)
          const validNextUrls: string[] = [];
          for (const link of Array.from(links)) {
            if (pageCount + validNextUrls.length >= maxPages) break;
            try {
              const nextUrlObj = new URL(link, urlToCrawl);
              nextUrlObj.hash = '';
              const nextUrl = nextUrlObj.href;

              if (nextUrlObj.hostname === baseUrlObj.hostname && !visited.has(nextUrl)) {
                validNextUrls.push(nextUrl);
              }
            } catch {}
          }

          const concurrency = 2;
          for (let i = 0; i < validNextUrls.length; i += concurrency) {
            if (pageCount >= maxPages) break;
            const batch = validNextUrls.slice(i, i + concurrency);
            const results = await Promise.all(
              batch.map(u => (!visited.has(u) ? crawl(u, currentDepth + 1) : Promise.resolve(null)))
            );
            for (const childNode of results) {
              if (childNode) children.push(childNode);
            }
          }
        }

        return {
          url: urlToCrawl,
          title: title || urlToCrawl,
          depth: currentDepth,
          statusCode,
          mimeType: contentType,
          size,
          assetCount,
          children,
        };
      } catch (error) {
        return {
          url: urlToCrawl,
          title: 'Bağlantı Hatası',
          depth: currentDepth,
          statusCode: 0,
          mimeType: 'unknown',
          size: 0,
          assetCount: 0,
          children: [],
        };
      }
    };

    const rootNode = await crawl(baseUrl, 0);

    return rootNode || {
      url: baseUrl,
      title: baseUrl,
      depth: 0,
      statusCode: 200,
      mimeType: 'text/html',
      size: 0,
      assetCount: 0,
      children: [],
    };
  }
}
