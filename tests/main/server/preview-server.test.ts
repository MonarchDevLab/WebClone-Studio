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
});
