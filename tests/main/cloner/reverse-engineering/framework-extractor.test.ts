import { describe, expect, it, test } from 'vitest';
import { extractFrameworkState } from '../../../../src/main/cloner/reverse-engineering/framework-extractor';

describe('extractFrameworkState', () => {
  test('extracts NEXT_DATA from html', () => {
    const html = `<html><body><script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"title":"Test"}}}</script></body></html>`;
    const result = extractFrameworkState(html);
    expect(result.nextData.props.pageProps.title).toBe('Test');
  });

  it('extracts NUXT_DATA from html', () => {
    const html = `<html><body><script id="__NUXT_DATA__" type="application/json">[{"state":"ok"},1]</script></body></html>`;
    const result = extractFrameworkState(html);
    expect(result.nuxtData).toEqual([{ state: 'ok' }, 1]);
  });

  it('extracts legacy __NUXT__ script when __NUXT_DATA__ is absent', () => {
    const html = `<html><body><script id="__NUXT__" type="application/json">{"serverRendered":true}</script></body></html>`;
    const result = extractFrameworkState(html);
    expect(result.nuxtData).toEqual({ serverRendered: true });
  });

  it('returns empty object when no framework state scripts are present', () => {
    const html = `<html><body><div><h1>Pure Static Page</h1></div></body></html>`;
    const result = extractFrameworkState(html);
    expect(result).toEqual({});
  });

  it('handles invalid JSON gracefully without throwing', () => {
    const html = `<html><body><script id="__NEXT_DATA__" type="application/json">{invalid json}</script></body></html>`;
    expect(() => extractFrameworkState(html)).not.toThrow();
    const result = extractFrameworkState(html);
    expect(result.nextData).toBeUndefined();
  });
});
