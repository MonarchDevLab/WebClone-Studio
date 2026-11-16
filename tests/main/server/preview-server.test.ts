import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PreviewServer } from '../../../src/main/server/preview-server';

describe('PreviewServer Security, Caching & Serving', () => {
  let tempRoot: string;
  let siteDir: string;

  beforeEach(async () => {
    tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'wc-preview-'));
    siteDir = path.join(tempRoot, 'site');
    const metaDir = path.join(tempRoot, '_meta');
    await fs.promises.mkdir(siteDir, { recursive: true });
    await fs.promises.mkdir(metaDir, { recursive: true });

    await fs.promises.writeFile(path.join(siteDir, 'index.html'), '<h1>Home</h1>', 'utf-8');
    await fs.promises.mkdir(path.join(siteDir, 'assets', 'images'), { recursive: true });
    await fs.promises.writeFile(
      path.join(siteDir, 'assets', 'images', 'hero_1111.webp'),
      'WEBP_0123456789_PAYLOAD',
      'utf-8'
    );
    await fs.promises.writeFile(
      path.join(metaDir, 'url-map.json'),
      JSON.stringify({
        '/_next/image?url=%2Fhero.png&w=640': 'assets/images/hero_1111.webp',
      }),
      'utf-8'
    );
    await fs.promises.writeFile(
      path.join(metaDir, 'api-endpoints.json'),
      JSON.stringify({
        '/api/hello': {
          GET: {
            status: 200,
            contentType: 'application/json; charset=utf-8',
            data: { ok: true },
          },
        },
      })
    );
  });

  afterEach(async () => {
    await PreviewServer.getInstance().stop();
    await fs.promises.rm(tempRoot, { recursive: true, force: true });
  });

  it('serves static pages, cached API mocks, X-Content-Type-Options: nosniff, and escapes 404 XSS', async () => {
    const baseUrl = await PreviewServer.getInstance().start(siteDir);

    const homeRes = await fetch(baseUrl);
    expect(homeRes.status).toBe(200);
    expect(homeRes.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await homeRes.text()).toContain('<h1>Home</h1>');

    const apiRes = await fetch(`${baseUrl}api/hello`);
    expect(apiRes.status).toBe(200);
    expect(await apiRes.json()).toEqual({ ok: true });

    const xssPayload = '%3Cscript%3Ealert(1)%3C/script%3E.js';
    const xssRes = await fetch(`${baseUrl}${xssPayload}`);
    expect(xssRes.status).toBe(404);
    const xssHtml = await xssRes.text();
    expect(xssHtml).not.toContain('<script>alert(1)</script>');
    expect(xssHtml).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('serves /_sw-replay.js with Service-Worker-Allowed, resolves query variants, and supports HTTP 206 Range', async () => {
    const baseUrl = await PreviewServer.getInstance().start(siteDir);

    const swRes = await fetch(`${baseUrl}_sw-replay.js`);
    expect(swRes.status).toBe(200);
    expect(swRes.headers.get('service-worker-allowed')).toBe('/');
    expect(swRes.headers.get('content-type')).toContain('javascript');
    const swBody = await swRes.text();
    expect(swBody).toContain('/_meta/url-map.json');

    const imgQueryRes = await fetch(`${baseUrl}_next/image?w=640&url=%2Fhero.png`);
    expect(imgQueryRes.status).toBe(200);
    expect(await imgQueryRes.text()).toBe('WEBP_0123456789_PAYLOAD');

    const rangeRes = await fetch(`${baseUrl}assets/images/hero_1111.webp`, {
      headers: { Range: 'bytes=5-14' },
    });
    expect(rangeRes.status).toBe(206);
    expect(rangeRes.headers.get('accept-ranges')).toBe('bytes');
    expect(rangeRes.headers.get('content-range')).toBe('bytes 5-14/23');
    expect(await rangeRes.text()).toBe('0123456789');

    const badRangeRes = await fetch(`${baseUrl}assets/images/hero_1111.webp`, {
      headers: { Range: 'bytes=100-200' },
    });
    expect(badRangeRes.status).toBe(416);
  });
});
