import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { HttpClient, decodeTextBuffer } from '../../../src/main/browser/http-client';

describe('HttpClient BoringSSL Transport, SSRF Redirects & Charset Decoding', () => {
  let server: http.Server;
  let baseUrl: string;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'wc-httpclient-'));
    let attempts = 0;

    server = http.createServer((req, res) => {
      if (req.url === '/ok-utf8') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<html><body>Merhaba ŞĞÜİÖÇ</body></html>');
        return;
      }
      if (req.url === '/redirect-ssrf') {
        res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data/' });
        res.end();
        return;
      }
      if (req.url === '/retry-once') {
        attempts++;
        if (attempts === 1) {
          res.writeHead(503, { 'Retry-After': '0' });
          res.end('busy');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('recovered');
        return;
      }
      if (req.url === '/large-stream') {
        res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
        res.end(Buffer.alloc(1024 * 64, 0x41));
        return;
      }
      res.writeHead(404);
      res.end('not found');
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it('blocks HTTP 302 redirect targeting 169.254.169.254 cloud metadata even with allowLocalhostTargets', async () => {
    await expect(
      HttpClient.fetchText({
        url: `${baseUrl}/redirect-ssrf`,
        allowLocalhostTargets: true,
      })
    ).rejects.toThrow(/ERR_SSRF_BLOCKED/);
  });

  it('retries 503 once and enforces cumulative streaming maxBytes on disk download', async () => {
    const recovered = await HttpClient.fetchText({
      url: `${baseUrl}/retry-once`,
      allowLocalhostTargets: true,
    });
    expect(recovered.statusCode).toBe(200);
    expect(recovered.text).toBe('recovered');

    const dest = path.join(tempDir, 'oversize.bin');
    await expect(
      HttpClient.downloadToFile(
        { url: `${baseUrl}/large-stream`, allowLocalhostTargets: true, maxBytes: 4096 },
        dest
      )
    ).rejects.toThrow(/exceeds limit/);
    expect(fs.existsSync(dest)).toBe(false);
  });

  it('decodes Turkish windows-1254 HTML buffers without mojibake', () => {
    // Byte values in windows-1254: Ş=0xDE, ğ=0xF0, İ=0xDD, ü=0xFC
    const win1254Html = Buffer.concat([
      Buffer.from('<meta charset="windows-1254"><p>', 'ascii'),
      Buffer.from([0xde, 0xf0, 0xdd, 0xfc]),
      Buffer.from('</p>', 'ascii'),
    ]);
    const decoded = decodeTextBuffer(win1254Html, 'text/html');
    expect(decoded.encoding).toBe('windows-1254');
    expect(decoded.text).toContain('Şğİü');
  });
});
