import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { UrlRewriter } from '../../../src/main/cloner/url-rewriter';
import { FileOrganizer } from '../../../src/main/cloner/file-organizer';

describe('UrlRewriter - Ponytail Ultra O(1) Lookup & Offline Fetch Shim', () => {
  it('resolves exact, hash-stripped, query-stripped, and trailing-slash URLs in O(1)', () => {
    const urlMap = new Map<string, string>([
      ['https://example.com/assets/app.js', 'E:/clones/site/assets/js/app_12345678.js'],
      ['https://example.com/about/', 'E:/clones/site/about/index.html'],
    ]);

    expect(UrlRewriter.findMappedLocalPath(urlMap, 'https://example.com/assets/app.js')).toBe(
      'E:/clones/site/assets/js/app_12345678.js'
    );
    expect(UrlRewriter.findMappedLocalPath(urlMap, 'https://example.com/assets/app.js?v=99#init')).toBe(
      'E:/clones/site/assets/js/app_12345678.js'
    );
    expect(UrlRewriter.findMappedLocalPath(urlMap, 'https://example.com/about')).toBe(
      'E:/clones/site/about/index.html'
    );
    expect(UrlRewriter.findMappedLocalPath(urlMap, 'https://example.com/missing.js')).toBeUndefined();
  });

  it('injects offline fetch mock shim with XSS-safe script escaping when mockApiDb is provided', () => {
    const html = '<!DOCTYPE html><html><head><title>Test</title></head><body><a href="https://example.com/about">About</a></body></html>';
    const urlMap = new Map<string, string>([
      ['https://example.com/about', 'E:/clones/site/about.html'],
    ]);

    const rewritten = UrlRewriter.rewriteHtml(html, {
      currentPageUrl: 'https://example.com/index.html',
      currentLocalFilePath: 'E:/clones/site/index.html',
      siteRootPath: 'E:/clones/site',
      urlMap,
      mockApiDb: {
        '/api/items': {
          GET: {
            status: 200,
            contentType: 'application/json',
            data: { note: '</script><script>alert(1)</script>', count: 2 },
          },
        },
      },
    });

    expect(rewritten).toContain('href="./about.html"');
    expect(rewritten).toContain('var __wcMocks =');
    expect(rewritten).toContain('window.fetch = function');
    expect(rewritten).toContain('XMLHttpRequest.prototype.open');
    expect(rewritten).toContain("'/ _sw-replay.js'".replace(' ', ''));
    expect(rewritten).not.toContain('</script><script>alert(1)');
    expect(rewritten).toContain('<\\/script>');
  });

  it('distinguishes canonical query-variant /_next/image URLs and avoids collision', () => {
    const organizer = new FileOrganizer({
      baseOutputDir: 'E:/clones',
      projectName: 'demo',
      targetUrl: 'https://example.com',
    });

    const mapA1 = organizer.mapUrlToLocalPath(
      'https://example.com/_next/image?url=%2Fhero.png&w=640&q=75',
      'https://example.com',
      'image'
    );
    const mapA2 = organizer.mapUrlToLocalPath(
      'https://example.com/_next/image?w=640&q=75&url=%2Fhero.png',
      'https://example.com',
      'image'
    );
    const mapB = organizer.mapUrlToLocalPath(
      'https://example.com/_next/image?url=%2Ffooter.png&w=640&q=75',
      'https://example.com',
      'image'
    );

    expect(mapA1.relativePathFromSiteRoot).toBe(mapA2.relativePathFromSiteRoot);
    expect(mapA1.relativePathFromSiteRoot).not.toBe(mapB.relativePathFromSiteRoot);
    expect(path.extname(mapA1.relativePathFromSiteRoot)).toBe('');

    const urlMap = new Map<string, string>([
      [
        'https://example.com/_next/image?url=%2Fhero.png&w=640&q=75',
        mapA1.absolutePath + '.webp',
      ],
      [
        'https://example.com/_next/image?w=640&url=%2Fhero.png&q=75',
        mapA1.absolutePath + '.webp',
      ],
      [
        'https://example.com/_next/image?url=%2Ffooter.png&w=640&q=75',
        mapB.absolutePath + '.webp',
      ],
    ]);

    const resolvedA = UrlRewriter.findMappedLocalPath(
      urlMap,
      'https://example.com/_next/image?url=%2Fhero.png&w=640&q=75'
    );
    const resolvedB = UrlRewriter.findMappedLocalPath(
      urlMap,
      'https://example.com/_next/image?url=%2Ffooter.png&w=640&q=75'
    );
    expect(resolvedA).toBe(mapA1.absolutePath + '.webp');
    expect(resolvedB).toBe(mapB.absolutePath + '.webp');
    expect(resolvedA).not.toBe(resolvedB);
  });

  it('rewrites CSS url(...) inside [data-bg], [data-background], and injects /_sw-replay.js even without mocks', () => {
    const html =
      '<!DOCTYPE html><html><head><title>BG</title></head><body><div data-bg="url(\'https://example.com/img/bg.webp\')"></div><div data-background-image="url(/img/banner.jpg)"></div></body></html>';
    const urlMap = new Map<string, string>([
      ['https://example.com/img/bg.webp', 'E:/clones/site/assets/images/bg_11111111.webp'],
      ['https://example.com/img/banner.jpg', 'E:/clones/site/assets/images/banner_22222222.jpg'],
    ]);

    const out = UrlRewriter.rewriteHtml(html, {
      currentPageUrl: 'https://example.com/index.html',
      currentLocalFilePath: 'E:/clones/site/index.html',
      siteRootPath: 'E:/clones/site',
      urlMap,
    });

    expect(out).toContain('./assets/images/bg_11111111.webp');
    expect(out).toContain('./assets/images/banner_22222222.jpg');
    expect(out).toContain('/_sw-replay.js');
    expect(out).toContain('navigator.serviceWorker.register');
  });

  it('preserves relative directory hierarchy for same-origin JS modules without query params', () => {
    const organizer = new FileOrganizer({
      baseOutputDir: 'E:/clones',
      projectName: 'demo',
      targetUrl: 'https://example.com',
    });

    const chunkMap = organizer.mapUrlToLocalPath(
      'https://example.com/_next/static/chunks/app-123.js',
      'https://example.com',
      'js'
    );
    expect(chunkMap.relativePathFromSiteRoot).toBe('assets/js/_next/static/chunks/app-123.js');
  });
});
