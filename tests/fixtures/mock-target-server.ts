import http from 'node:http';

export interface MockTargetServerController {
  baseUrl: string;
  setPricingVersion: (ver: string) => void;
  getSsrfTargetHits: () => number;
  close: () => Promise<void>;
}

const TINY_WEBP = Buffer.from('RIFF\x1a\x00\x00\x00WEBPVP8 \x0e\x00\x00\x00HERO_IMAGE_DATA', 'utf-8');
const TINY_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x43, 0x41, 0x52, 0x44]);

export async function startMockTargetServer(): Promise<MockTargetServerController> {
  let pricingVersion = 'v1';
  let ssrfTargetHits = 0;

  const server = http.createServer((req, res) => {
    const parsed = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = parsed.pathname;

    if (pathname === '/') {
      const etag = `"home-v1"`;
      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304, { ETag: etag });
        res.end();
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        ETag: etag,
        'X-Powered-By': 'Next.js',
      });
      res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Mock Fixture App</title>
  <link rel="stylesheet" href="/styles/main.css" />
  <script src="/_next/static/chunks/app.js"></script>
</head>
<body>
  <header><nav><a href="/pricing">Pricing</a><a href="/redirect-ssrf">Metadata</a></nav></header>
  <main>
    <section class="hero" data-bg="url('/assets/pattern.svg')" style="background-image: url(data:image/svg+xml;base64,PHN2Zy8+); color: #f4f4f5">
      <h1>Mock Fixture Studio</h1>
      <img src="/_next/image?url=%2Fhero.png&w=640" alt="Hero" />
      <img src="/_next/image?url=%2Fcard.png&w=640" alt="Card" />
      <video src="/media/sample.mp4"></video>
    </section>
  </main>
  <footer><span>Monolith Test</span></footer>
  <script>self.__next_f.push([1,"0:{\"tier\":\"pro\"}\\n"]);</script>
</body>
</html>`);
      return;
    }

    if (pathname === '/pricing') {
      const etag = `"pricing-${pricingVersion}"`;
      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304, { ETag: etag });
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ETag: etag });
      res.end(`<!DOCTYPE html><html><head><title>Pricing ${pricingVersion}</title></head><body><h1>Pricing ${pricingVersion}</h1><a href="/">Home</a></body></html>`);
      return;
    }

    if (pathname === '/styles/main.css') {
      res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
      res.end(`
:root {
  --brand-accent: oklch(0.65 0.18 220);
  --surface-bg: #08090c;
}
.hero {
  background-color: var(--surface-bg);
  color: color(display-p3 0.1 0.8 0.9);
  background-image: url('/_next/image?url=%2Fhero.png&w=640');
}
`);
      return;
    }

    if (pathname === '/_next/static/chunks/app.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
      res.end(`window.bootMockApp = function(){ return fetch('/api/pricing'); };\n//# sourceMappingURL=app.js.map\n`);
      return;
    }

    if (pathname === '/_next/static/chunks/app.js.map') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          version: 3,
          sources: ['../src/components/PricingCard.tsx'],
          sourcesContent: ['export const PricingCard = () => <div>Pro</div>;'],
          mappings: '',
        })
      );
      return;
    }

    if (pathname === '/_next/image') {
      const targetImg = parsed.searchParams.get('url');
      if (targetImg === '/hero.png') {
        res.writeHead(200, { 'Content-Type': 'image/webp' });
        res.end(TINY_WEBP);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(TINY_PNG);
      return;
    }

    if (pathname === '/assets/pattern.svg') {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      res.end('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><circle cx="4" cy="4" r="2"/></svg>');
      return;
    }

    if (pathname === '/media/sample.mp4') {
      const mediaBuf = Buffer.from('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_MP4_PAYLOAD', 'utf-8');
      res.writeHead(200, { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes' });
      res.end(mediaBuf);
      return;
    }

    if (pathname === '/api/pricing') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ currency: 'USD', tier: 'pro', version: pricingVersion }));
      return;
    }

    if (pathname === '/sitemap.xml') {
      const hostHeader = req.headers.host || '127.0.0.1';
      res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
      res.end(
        `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>http://${hostHeader}/sitemap-pages.xml</loc></sitemap></sitemapindex>`
      );
      return;
    }

    if (pathname === '/sitemap-pages.xml') {
      const hostHeader = req.headers.host || '127.0.0.1';
      res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
      res.end(
        `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>http://${hostHeader}/</loc></url><url><loc>http://${hostHeader}/pricing</loc></url></urlset>`
      );
      return;
    }

    if (pathname === '/redirect-ssrf') {
      ssrfTargetHits++;
      res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data/' });
      res.end();
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    setPricingVersion: (ver: string) => {
      pricingVersion = ver;
    },
    getSsrfTargetHits: () => ssrfTargetHits,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
