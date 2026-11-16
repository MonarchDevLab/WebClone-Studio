import * as cheerio from 'cheerio';
import { URL } from 'url';
import { SiteMapNode } from '../../shared/types';
import { HttpClient } from '../browser/http-client';
import { buildDefaultUserAgent } from '../../shared/version';

export class SiteMapper {
  private async parseSitemapXml(
    sitemapUrl: string,
    originHostname: string,
    allowLocalhostTargets: boolean | undefined,
    visitedSitemaps: Set<string>,
    collectedUrls: Set<string>,
    depth: number
  ): Promise<void> {
    if (depth > 2 || visitedSitemaps.has(sitemapUrl) || collectedUrls.size >= 500) {
      return;
    }
    visitedSitemaps.add(sitemapUrl);

    const ua = buildDefaultUserAgent();
    try {
      const res = await HttpClient.fetchText({
        url: sitemapUrl,
        timeoutMs: 4000,
        maxRetries: 0,
        headers: { 'user-agent': ua },
        allowLocalhostTargets,
      });

      if (res.statusCode !== 200 || !res.text.includes('<loc>')) return;

      const $ = cheerio.load(res.text, { xmlMode: true });
      const childSitemaps: string[] = [];

      $('sitemap > loc').each((_, el) => {
        const loc = $(el).text().trim();
        if (loc) childSitemaps.push(loc);
      });

      $('url > loc, sitemapindex > sitemap > loc, loc').each((_, el) => {
        const foundUrl = $(el).text().trim();
        if (!foundUrl) return;
        try {
          const parsed = new URL(foundUrl);
          if (parsed.hostname !== originHostname) return;
          if (/\.xml(?:$|\?)/i.test(parsed.pathname)) {
            if (!childSitemaps.includes(foundUrl)) {
              childSitemaps.push(foundUrl);
            }
          } else if (collectedUrls.size < 500) {
            collectedUrls.add(foundUrl);
          }
        } catch {}
      });

      for (const childUrl of childSitemaps.slice(0, 8)) {
        try {
          if (new URL(childUrl).hostname === originHostname) {
            await this.parseSitemapXml(
              childUrl,
              originHostname,
              allowLocalhostTargets,
              visitedSitemaps,
              collectedUrls,
              depth + 1
            );
          }
        } catch {}
      }
    } catch {}
  }

  /**
   * XML sitemap (including nested <sitemapindex>) üzerinden sayfaları hızlıca çeker.
   */
  private async tryFetchXmlSitemap(
    origin: string,
    allowLocalhostTargets?: boolean
  ): Promise<string[] | null> {
    const originHostname = new URL(origin).hostname;
    const candidates = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];
    const visitedSitemaps = new Set<string>();
    const collectedUrls = new Set<string>();

    for (const sitemapUrl of candidates) {
      await this.parseSitemapXml(
        sitemapUrl,
        originHostname,
        allowLocalhostTargets,
        visitedSitemaps,
        collectedUrls,
        0
      );
      if (collectedUrls.size > 0) {
        return Array.from(collectedUrls);
      }
    }
    return null;
  }

  private buildHierarchicalTree(
    baseUrl: string,
    baseUrlObj: URL,
    urls: string[],
    maxDepth: number
  ): SiteMapNode {
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

    const nodeIndex = new Map<string, SiteMapNode>();
    nodeIndex.set('/', rootNode);

    for (const u of urls) {
      if (u === baseUrl || u === `${baseUrl}/`) continue;
      try {
        const parsed = new URL(u);
        const segments = parsed.pathname.split('/').filter(Boolean);
        if (segments.length === 0) continue;

        let parentNode = rootNode;
        let currentKey = '';
        const limitDepth = Math.min(segments.length, Math.max(1, maxDepth));

        for (let i = 0; i < limitDepth; i++) {
          const isLeaf = i === limitDepth - 1;
          currentKey += `/${segments[i]}`;
          let existing = nodeIndex.get(currentKey);
          if (!existing) {
            const nodeUrl = isLeaf ? u : `${baseUrlObj.origin}${currentKey}/`;
            existing = {
              url: nodeUrl,
              title: isLeaf ? parsed.pathname : `${currentKey}/`,
              depth: i + 1,
              statusCode: 200,
              mimeType: 'text/html',
              size: isLeaf ? 25000 : 0,
              assetCount: isLeaf ? 10 : 0,
              children: [],
            };
            nodeIndex.set(currentKey, existing);
            parentNode.children.push(existing);
          } else if (isLeaf) {
            existing.url = u;
            existing.title = parsed.pathname;
          }
          parentNode = existing;
        }
      } catch {}
    }

    return rootNode;
  }

  async map(
    baseUrl: string,
    maxDepth: number = 2,
    maxPages: number = 60,
    options?: { allowLocalhostTargets?: boolean }
  ): Promise<SiteMapNode> {
    const baseUrlObj = new URL(baseUrl);
    const origin = baseUrlObj.origin;
    const allowLocalhostTargets = Boolean(options?.allowLocalhostTargets);

    // 1. Öncelik: /sitemap.xml (ve <sitemapindex>) kontrolü
    const xmlUrls = await this.tryFetchXmlSitemap(origin, allowLocalhostTargets);
    if (xmlUrls && xmlUrls.length > 0) {
      return this.buildHierarchicalTree(baseUrl, baseUrlObj, xmlUrls.slice(0, maxPages), maxDepth);
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
        const res = await HttpClient.fetchText({
          url: urlToCrawl,
          timeoutMs: 5000,
          maxRetries: 0,
          headers: { 'user-agent': buildDefaultUserAgent() },
          allowLocalhostTargets,
        });

        const contentType = res.mimeType || 'text/html';
        const size = res.body.length || parseInt(res.headers['content-length'] || '0', 10) || 25000;
        const statusCode = res.statusCode;

        let title = '';
        const children: SiteMapNode[] = [];
        let assetCount = 0;

        if (contentType.includes('text/html') && statusCode < 400 && currentDepth < maxDepth) {
          const $ = cheerio.load(res.text);
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
