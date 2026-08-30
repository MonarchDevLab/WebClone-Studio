import { DesignTokens, ColorToken, TypoToken } from '../../shared/types';
import { PageRenderer } from '../browser/page-renderer';
import * as cheerio from 'cheerio';
import got from 'got';

export class DesignAnalyzer {
  private renderer = new PageRenderer();

  /**
   * Sayfa tasarım token'larını analiz eder (Renkler, Tipografi, Spacing).
   */
  async analyze(url: string, precomputedTokens?: DesignTokens): Promise<DesignTokens> {
    if (precomputedTokens && precomputedTokens.colors?.length > 0) {
      return precomputedTokens;
    }

    try {
      const renderResult = await this.renderer.render(url, { timeoutMs: 15000 });
      return renderResult.designTokens;
    } catch (error) {
      console.warn(`[DesignAnalyzer] Offscreen render uyarısı [${url}], statik ayrıştırma deneniyor:`, error);
      return this.analyzeStatic(url);
    }
  }

  /**
   * Offscreen render başarısız olursa statik HTML üzerinden temel renk ve fontları çıkarır.
   */
  private async analyzeStatic(url: string): Promise<DesignTokens> {
    const defaultTokens: DesignTokens = {
      colors: [
        { hex: '#08090a', role: 'background', frequency: 1 },
        { hex: '#f4f4f5', role: 'foreground', frequency: 1 },
        { hex: '#6366f1', role: 'accent', frequency: 1 },
      ],
      typography: [
        { fontFamily: 'Inter, sans-serif', fontSize: '16px', fontWeight: '400', lineHeight: '1.5', role: 'body' },
        { fontFamily: 'Inter, sans-serif', fontSize: '24px', fontWeight: '700', lineHeight: '1.2', role: 'heading' },
      ],
      spacing: [4, 8, 12, 16, 24, 32, 48, 64],
    };

    try {
      const res = await got(url, { timeout: { request: 6000 }, throwHttpErrors: false });
      const $ = cheerio.load(res.body);

      const colorMap = new Map<string, number>();
      const hexRegex = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;
      let match;

      while ((match = hexRegex.exec(res.body)) !== null) {
        let hex = match[0].toLowerCase();
        if (hex.length === 4) {
          hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
        }
        colorMap.set(hex, (colorMap.get(hex) || 0) + 1);
      }

      const topColors = Array.from(colorMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      const colors: ColorToken[] = topColors.length > 0
        ? topColors.map(([hex, freq], i) => ({
            hex,
            role: i === 0 ? 'background' : i === 1 ? 'foreground' : i === 2 ? 'border' : 'accent',
            frequency: freq,
          }))
        : defaultTokens.colors;

      const logo = $('header img, nav img, [class*="logo"] img').attr('src') || '';
      const favicon = $('link[rel*="icon"]').attr('href') || '';
      const svgCount = $('svg').length;
      const h1Text = $('h1').first().text().trim();
      const pText = $('p').first().text().trim();

      const navLinks: Array<{ text: string; href: string }> = [];
      $('header a, nav a').slice(0, 6).each((_, el) => {
        const text = $(el).text().trim();
        const href = $(el).attr('href') || '';
        if (text) navLinks.push({ text, href });
      });

      const components = [];
      if (navLinks.length > 0) {
        components.push({
          name: 'Navbar / Header',
          tag: 'header',
          links: navLinks,
        });
      }
      if (h1Text) {
        components.push({
          name: 'Hero Section',
          tag: 'section',
          h1: h1Text,
          subhead: pText.slice(0, 150),
        });
      }

      return {
        colors,
        typography: defaultTokens.typography,
        spacing: defaultTokens.spacing,
        shadows: [
          { name: 'sm', value: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' },
          { name: 'md', value: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' },
          { name: 'lg', value: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' },
        ],
        radii: [
          { name: 'sm', value: '4px' },
          { name: 'md', value: '8px' },
          { name: 'lg', value: '16px' },
        ],
        components,
        assets: {
          logo,
          favicon,
          svgCount,
        },
      };
    } catch {
      return defaultTokens;
    }
  }
}
