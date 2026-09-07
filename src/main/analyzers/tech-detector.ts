import got from 'got';
import * as cheerio from 'cheerio';
import { TechSignature } from '../../shared/types';
import { TECH_SIGNATURES, TechSignatureRule } from './tech-signatures';

export interface TechDetectorInput {
  html?: string;
  headers?: Record<string, any>;
  globals?: string[];
}

export class TechDetector {
  /**
   * Bir web sitesini veya sağlanan render verilerini analiz ederek tespit edilen teknolojileri listeler.
   */
  async analyze(url: string, pageData?: TechDetectorInput): Promise<TechSignature[]> {
    const scores = new Map<string, { tech: TechSignatureRule; score: number; signals: Set<string>; version?: string }>();

    const addScore = (techName: string, tech: TechSignatureRule, points: number, signal: string, version?: string) => {
      const current = scores.get(techName) || { tech, score: 0, signals: new Set<string>() };
      current.score += points;
      current.signals.add(signal);
      if (version && !current.version) {
        current.version = version;
      }
      scores.set(techName, current);
    };

    let htmlBody = pageData?.html || '';
    let headers: Record<string, any> = pageData?.headers || {};
    const globals = pageData?.globals || [];

    // Eğer statik veri gelmediyse HTTP GET ile headers ve body'yi çek
    if (!htmlBody || Object.keys(headers).length === 0) {
      try {
        const response = await got(url, {
          timeout: { request: 10000 },
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          throwHttpErrors: false,
        });
        htmlBody = response.body;
        headers = response.headers;
      } catch (e) {
        console.warn(`[TechDetector] Statik HTTP isteği uyarısı [${url}]:`, e);
      }
    }

    const rawCookies = headers['set-cookie'];
    const cookiesHeader: string[] = Array.isArray(rawCookies) ? rawCookies : (typeof rawCookies === 'string' ? [rawCookies] : []);
    const $ = cheerio.load(htmlBody || '');

    // Meta etiketlerini topla
    const metaTags: Record<string, string> = {};
    $('meta').each((_, el) => {
      const name = $(el).attr('name') || $(el).attr('property');
      const content = $(el).attr('content');
      if (name && content) {
        metaTags[name.toLowerCase()] = content;
      }
    });

    // Script src'lerini topla
    const scriptUrls: string[] = [];
    $('script').each((_, el) => {
      const src = $(el).attr('src');
      if (src) scriptUrls.push(src);
    });

    const globalSet = new Set(globals);

    // Sürüm kalıbı yardımcı regex'i
    const versionRegex = /\b(\d+(?:\.\d+)+)\b/;

    // İmza eşleştirmeleri
    for (const tech of TECH_SIGNATURES) {
      // 1. Headers eşleştirmesi (Ağırlık: 30)
      if (tech.headers) {
        for (const [key, regex] of Object.entries(tech.headers)) {
          const val = headers[key.toLowerCase()];
          if (val && regex.test(String(val))) {
            const verMatch = String(val).match(versionRegex);
            const ver = verMatch ? verMatch[1] : undefined;
            addScore(tech.name, tech, 30, `header: ${key}=${val}`, ver);
          }
        }
      }

      // 2. Cookies eşleştirmesi (Ağırlık: 10)
      if (tech.cookies) {
        for (const [cookieName, regex] of Object.entries(tech.cookies)) {
          const match = cookiesHeader.some((c: string) => c.includes(`${cookieName}=`) && regex.test(c));
          if (match) {
            addScore(tech.name, tech, 10, `cookie: ${cookieName}`);
          }
        }
      }

      // 3. Meta tag eşleştirmesi (Ağırlık: 25)
      if (tech.meta) {
        for (const [key, regex] of Object.entries(tech.meta)) {
          const val = metaTags[key.toLowerCase()];
          if (val && regex.test(val)) {
            const verMatch = val.match(versionRegex);
            const ver = verMatch ? verMatch[1] : undefined;
            addScore(tech.name, tech, 25, `meta: ${key}=${val}`, ver);
          }
        }
      }

      // 4. HTML pattern eşleştirmesi (Ağırlık: 20)
      if (tech.html && htmlBody) {
        for (const regex of tech.html) {
          if (regex.test(htmlBody)) {
            addScore(tech.name, tech, 20, `html: ${regex.source}`);
          }
        }
      }

      // 5. Script URL eşleştirmesi (Ağırlık: 15)
      if (tech.scripts) {
        for (const regex of tech.scripts) {
          const matchedSrc = scriptUrls.find(src => regex.test(src));
          if (matchedSrc) {
            const verMatch = matchedSrc.match(versionRegex);
            const ver = verMatch ? verMatch[1] : undefined;
            addScore(tech.name, tech, 15, `script: ${matchedSrc.split('/').pop() || matchedSrc}`, ver);
          }
        }
      }

      // 6. JS runtime değişken kontrolü (Ağırlık: 30)
      if (tech.jsVars && globals.length > 0) {
        for (const v of tech.jsVars) {
          if (globalSet.has(v)) {
            addScore(tech.name, tech, 30, `js: window.${v}`);
          }
        }
      }
    }

    // Güven skoru hesaplama ve sıralama
    const results: TechSignature[] = [];
    for (const [_, data] of scores.entries()) {
      const confidence = Math.min(Math.round((data.score / 100) * 100), 100);
      if (confidence >= 20) {
        results.push({
          name: data.tech.name,
          category: data.tech.category,
          confidence,
          version: data.version,
          signals: Array.from(data.signals),
        });
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }
}
