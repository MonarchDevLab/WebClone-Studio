import { describe, it, expect } from 'vitest';
import { UrlRewriter } from '../../../src/main/cloner/url-rewriter';

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
    expect(rewritten).not.toContain('</script><script>alert(1)');
    expect(rewritten).toContain('<\\/script>');
  });
});
