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

    let robotsTxt = false;
    try {
      const robotsUrl = `${parsedUrl.protocol}//${parsedUrl.host}/robots.txt`;
      const res = await HttpClient.fetchBuffer({
        url: robotsUrl,
        method: 'HEAD',
        timeoutMs: 3000,
        maxRetries: 0,
        headers: { 'user-agent': ua },
        allowLocalhostTargets,
      });
      if (res.statusCode === 200) robotsTxt = true;
    } catch {}

    let sitemap = false;
    try {
      const sitemapUrl = `${parsedUrl.protocol}//${parsedUrl.host}/sitemap.xml`;
      const res = await HttpClient.fetchBuffer({
        url: sitemapUrl,
        method: 'HEAD',
        timeoutMs: 3000,
        maxRetries: 0,
        headers: { 'user-agent': ua },
        allowLocalhostTargets,
      });
      if (res.statusCode === 200) sitemap = true;
    } catch {}

    return {
      https,
      hsts,
      csp,
      robotsTxt,
      sitemap,
      headers: formattedHeaders,
    };
  }
}
