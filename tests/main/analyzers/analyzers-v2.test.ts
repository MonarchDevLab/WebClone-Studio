import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { TechDetector } from '../../../src/main/analyzers/tech-detector';
import { SiteMapper } from '../../../src/main/analyzers/site-mapper';
import { DesignAnalyzer } from '../../../src/main/analyzers/design-analyzer';

describe('Phase 5 Analyzers Upgrade', () => {
  let server: http.Server | null = null;
  let baseUrl = '';
  let rootHitCount = 0;

  beforeEach(async () => {
    rootHitCount = 0;
    server = http.createServer((req, res) => {
      const reqUrl = req.url || '/';
      if (reqUrl === '/') {
        rootHitCount++;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<html><body><div class="flex">Plain Flex</div></body></html>');
        return;
      }

      if (reqUrl === '/sitemap.xml') {
        res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
        res.end(`<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${baseUrl}/sitemap-docs.xml</loc></sitemap>
</sitemapindex>`);
        return;
      }

      if (reqUrl === '/sitemap-docs.xml') {
        res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
        res.end(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${baseUrl}/docs/getting-started</loc></url>
  <url><loc>${baseUrl}/docs/api/authentication</loc></url>
</urlset>`);
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    await new Promise<void>((resolve) => {
      server!.listen(0, '127.0.0.1', () => {
        const addr = server!.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = null;
    }
  });

  it('TechDetector skips redundant HTTP fetch when caller passes html or skipNetworkFallback and avoids generic .flex Tailwind false positive', async () => {
    const detector = new TechDetector();
    const detected = await detector.analyze(`${baseUrl}/`, {
      html: '<html><body><div class="flex text-center">Plain CSS site</div><script>self.__next_f.push([1,"app"])</script></body></html>',
      headers: {},
      globals: [],
      allowLocalhostTargets: true,
      skipNetworkFallback: true,
    });

    expect(rootHitCount).toBe(0);
    expect(detected.some((t) => t.name === 'Tailwind CSS')).toBe(false);
    expect(detected.some((t) => t.name === 'Next.js')).toBe(true);
  });

  it('SiteMapper traverses <sitemapindex> child .xml files and builds hierarchical tree nodes', async () => {
    const mapper = new SiteMapper();
    const tree = await mapper.map(`${baseUrl}/`, 4, 50, { allowLocalhostTargets: true });

    const docsNode = tree.children.find((c) => c.url.includes('/docs'));
    expect(docsNode).toBeDefined();
    expect(docsNode!.depth).toBe(1);

    const gettingStarted = docsNode!.children.find((c) => c.url.endsWith('/docs/getting-started'));
    expect(gettingStarted).toBeDefined();
    expect(gettingStarted!.depth).toBe(2);

    const apiGroup = docsNode!.children.find((c) => c.url.includes('/docs/api'));
    expect(apiGroup).toBeDefined();
    const authLeaf = apiGroup!.children.find((c) => c.url.endsWith('/docs/api/authentication'));
    expect(authLeaf).toBeDefined();
    expect(authLeaf!.depth).toBe(3);
  });

  it('DesignAnalyzer extracts CSS Color 4 formats and assigns luminance-aware background/foreground roles', () => {
    const analyzer = new DesignAnalyzer();
    const html = `
      <html><head><style>
        body {
          background: #ffffff;
          color: #111827;
          border-color: #cbd5e1;
          accent-color: oklch(0.62 0.21 255);
          box-shadow: 0 0 0 1px color(display-p3 0.1 0.8 0.9);
        }
        p, span, li, a { color: #111827; }
        .surface { background: #ffffff; background-color: #ffffff; background-image: none; }
      </style></head><body><h1>Title</h1><p>Content</p></body></html>
    `;

    const tokens = analyzer.analyzeHtmlStatic(html);
    const bgToken = tokens.colors.find((c) => c.role === 'background');
    const fgToken = tokens.colors.find((c) => c.role === 'foreground');
    const accentToken = tokens.colors.find((c) => c.role === 'accent');

    expect(bgToken?.hex).toBe('#ffffff');
    expect(fgToken?.hex).toBe('#111827');
    expect(tokens.colors.some((c) => c.hex.startsWith('oklch('))).toBe(true);
    expect(tokens.colors.some((c) => c.hex.startsWith('color(display-p3'))).toBe(true);
    expect(accentToken).toBeDefined();
  });
});
