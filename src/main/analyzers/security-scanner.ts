import got from 'got';
import { URL } from 'url';
import { SecurityInfo } from '../../shared/types';

export class SecurityScanner {
  async scan(url: string): Promise<SecurityInfo> {
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

    try {
      const response = await got.head(url, { 
        timeout: { request: 5000 },
        throwHttpErrors: false,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) WebCloneStudio/1.0',
        }
      });

      for (const [key, value] of Object.entries(response.headers)) {
        if (value !== undefined) {
          formattedHeaders[key] = Array.isArray(value) ? value.join(', ') : String(value);
        }
      }

      // HSTS kontrolü
      if (formattedHeaders['strict-transport-security']) {
        hsts = true;
      }

      // CSP kontrolü
      if (formattedHeaders['content-security-policy']) {
        csp = true;
      }
    } catch (e) {
      console.warn(`[SecurityScanner] Ana bağlantı uyarısı [${url}]:`, e);
    }

    // robots.txt varlığı
    let robotsTxt = false;
    try {
      const robotsUrl = `${parsedUrl.protocol}//${parsedUrl.host}/robots.txt`;
      const res = await got.head(robotsUrl, { timeout: { request: 3000 }, throwHttpErrors: false });
      if (res.statusCode === 200) robotsTxt = true;
    } catch {}

    // sitemap.xml varlığı
    let sitemap = false;
    try {
      const sitemapUrl = `${parsedUrl.protocol}//${parsedUrl.host}/sitemap.xml`;
      const res = await got.head(sitemapUrl, { timeout: { request: 3000 }, throwHttpErrors: false });
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
