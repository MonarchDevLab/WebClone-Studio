import { describe, it, expect } from 'vitest';
import { AssetDownloader } from '../../../src/main/cloner/asset-downloader';
import { isWafChallenge } from '../../../src/main/cloner/crawler-engine';

describe('ClearanceBridge & WAF Escalation', () => {
  describe('AssetDownloader Cookie Storage', () => {
    it('should store and inject cookies into outgoing request headers for matching domains', () => {
      const downloader = new AssetDownloader();

      downloader.setCookies([
        { name: 'cf_clearance', value: 'secret_token_123', domain: 'example.com' },
        { name: '__cf_bm', value: 'bot_management_token', domain: '.example.com' },
        { name: 'other_cookie', value: 'val', domain: 'otherdomain.org' }
      ]);

      const headers = (downloader as any).getBrowserHeaders('https://example.com/styles/main.css');

      expect(headers['cookie']).toBeDefined();
      expect(headers['cookie']).toContain('cf_clearance=secret_token_123');
      expect(headers['cookie']).toContain('__cf_bm=bot_management_token');
      // otherdomain.org çerezi example.com isteklerine gitmemeli (güvenlik)
      expect(headers['cookie']).not.toContain('other_cookie=val');
    });

    it('should clear cookies on demand', () => {
      const downloader = new AssetDownloader();
      downloader.setCookies([
        { name: 'session_id', value: 'abc', domain: 'example.com' }
      ]);

      downloader.clearCookies();
      const headers = (downloader as any).getBrowserHeaders('https://example.com/logo.png');
      expect(headers['cookie']).toBeUndefined();
    });
  });

  describe('isWafChallenge detector', () => {
    it('should identify Cloudflare 403/503 Turnstile and challenge pages', () => {
      expect(isWafChallenge(403, '<html><body>Just a moment... Enable JavaScript and cookies to continue.</body></html>')).toBe(true);
      expect(isWafChallenge(503, '<html><head><title>Attention Required! | Cloudflare</title></head><body>cf-turnstile-wrapper</body></html>')).toBe(true);
      expect(isWafChallenge(403, 'Ray ID: 78912345678abcdef', { 'cf-mitigated': 'challenge' })).toBe(true);
    });

    it('should not flag standard 404, 200 or generic errors as WAF challenge', () => {
      expect(isWafChallenge(200, '<html><body>Normal content</body></html>')).toBe(false);
      expect(isWafChallenge(404, '<html><body>Page not found</body></html>')).toBe(false);
      expect(isWafChallenge(500, '<html><body>Internal Server Error</body></html>')).toBe(false);
    });
  });
});
