import { URL } from 'url';
import { SecurityInfo } from '../../shared/types';
import { HttpClient } from '../browser/http-client';
import { buildDefaultUserAgent } from '../../shared/version';

export class SecurityScanner {
  async scan(
    url: string,
    options?: { existingHeaders?: Record<string, string>; allowLocalhostTargets?: boolean }
  ): Promise<SecurityInfo> {
    let https = false;
    let hsts = false;
    let csp = false;
    const formattedHeaders: Record<string, string> = {};

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return { https, hsts, csp, robotsTxt: false, sitemap: false, headers: formattedHeaders };
    }

    https = parsedUrl.protocol === 'https:';
    const ua = buildDefaultUserAgent();
    const allowLocalhostTargets = Boolean(options?.allowLocalhostTargets);

    if (options?.existingHeaders && Object.keys(options.existingHeaders).length > 0) {
      for (const [k, v] of Object.entries(options.existingHeaders)) {
        if (v !== undefined) formattedHeaders[k.toLowerCase()] = String(v);
      }
    } else {
      try {
        const res = await HttpClient.fetchBuffer({
          url,
          method: 'HEAD',
          timeoutMs: 5000,
          maxRetries: 0,
          headers: { 'user-agent': ua },
          allowLocalhostTargets,
        });
        Object.assign(formattedHeaders, res.headers);
      } catch (e) {
        console.warn(`[SecurityScanner] Ana bağlantı uyarısı [${url}]:`, e);
      }
    }

    if (formattedHeaders['strict-transport-security']) {
      hsts = true;
    }
    if (formattedHeaders['content-security-policy']) {
      csp = true;
    }

    const [robotsOk, sitemapOk] = await Promise.all([
      HttpClient.fetchBuffer({
        url: `${parsedUrl.protocol}//${parsedUrl.host}/robots.txt`,
        method: 'HEAD',
        timeoutMs: 3000,
        maxRetries: 0,
        headers: { 'user-agent': ua },
        allowLocalhostTargets,
      })
        .then((res) => res.statusCode === 200)
        .catch(() => false),
      HttpClient.fetchBuffer({
        url: `${parsedUrl.protocol}//${parsedUrl.host}/sitemap.xml`,
        method: 'HEAD',
        timeoutMs: 3000,
        maxRetries: 0,
        headers: { 'user-agent': ua },
        allowLocalhostTargets,
      })
        .then((res) => res.statusCode === 200)
        .catch(() => false),
    ]);

    return {
      https,
      hsts,
      csp,
      robotsTxt: robotsOk,
      sitemap: sitemapOk,
      headers: formattedHeaders,
    };
  }
}
