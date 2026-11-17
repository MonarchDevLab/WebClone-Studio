import { DesignTokens, ColorToken } from '../../shared/types';
import { PageRenderer } from '../browser/page-renderer';
import { HttpClient } from '../browser/http-client';
import { buildDefaultUserAgent } from '../../shared/version';
import * as cheerio from 'cheerio';

interface ColorMetrics {
  luminance: number;
  chroma: number;
}

function estimateColorMetrics(raw: string): ColorMetrics {
  const c = raw.trim().toLowerCase();
  if (c.startsWith('#') && c.length >= 7) {
    const r = parseInt(c.slice(1, 3), 16) / 255;
    const g = parseInt(c.slice(3, 5), 16) / 255;
    const b = parseInt(c.slice(5, 7), 16) / 255;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    return { luminance, chroma };
  }

  const oklchMatch = c.match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)/);
  if (oklchMatch) {
    const rawL = parseFloat(oklchMatch[1]);
    const luminance = oklchMatch[2] === '%' ? rawL / 100 : rawL > 1 ? rawL / 100 : rawL;
    const chroma = parseFloat(oklchMatch[3]);
    return { luminance, chroma };
  }

  const oklabMatch = c.match(/^oklab\(\s*([\d.]+)(%?)\s+([-\d.]+)\s+([-\d.]+)/);
  if (oklabMatch) {
    const rawL = parseFloat(oklabMatch[1]);
    const luminance = oklabMatch[2] === '%' ? rawL / 100 : rawL > 1 ? rawL / 100 : rawL;
    const a = parseFloat(oklabMatch[3]);
    const b = parseFloat(oklabMatch[4]);
    return { luminance, chroma: Math.hypot(a, b) };
  }

  const p3Match = c.match(/^color\(\s*display-p3\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (p3Match) {
    const r = parseFloat(p3Match[1]);
    const g = parseFloat(p3Match[2]);
    const b = parseFloat(p3Match[3]);
    return {
      luminance: 0.2126 * r + 0.7152 * g + 0.0722 * b,
      chroma: Math.max(r, g, b) - Math.min(r, g, b),
    };
  }

  return { luminance: 0.5, chroma: 0.1 };
}

function classifyPaletteRoles(topEntries: Array<[string, number]>): ColorToken[] {
  if (topEntries.length === 0) return [];

  const withMetrics = topEntries.map(([hex, freq]) => ({
    hex,
    freq,
    metrics: estimateColorMetrics(hex),
  }));

  const lightNeutrals = withMetrics
    .filter((item) => item.metrics.luminance >= 0.72 && item.metrics.chroma < 0.15)
    .sort((a, b) => b.freq - a.freq);
  const darkNeutrals = withMetrics
    .filter((item) => item.metrics.luminance <= 0.28 && item.metrics.chroma < 0.15)
    .sort((a, b) => b.freq - a.freq);
  const chromatic = withMetrics
    .filter((item) => item.metrics.chroma >= 0.12)
    .sort((a, b) => b.freq - a.freq);

  let bgHex: string | undefined;
  let fgHex: string | undefined;

  if (lightNeutrals.length > 0 && darkNeutrals.length > 0) {
    if (lightNeutrals[0].freq >= darkNeutrals[0].freq) {
      bgHex = lightNeutrals[0].hex;
      fgHex = darkNeutrals[0].hex;
    } else {
      bgHex = darkNeutrals[0].hex;
      fgHex = lightNeutrals[0].hex;
    }
  } else if (lightNeutrals.length > 0) {
    bgHex = lightNeutrals[0].hex;
  } else if (darkNeutrals.length > 0) {
    bgHex = darkNeutrals[0].hex;
  }

  const accentHex = chromatic[0]?.hex;

  return withMetrics.map((item) => {
    let role: ColorToken['role'] = 'border';
    if (item.hex === bgHex) role = 'background';
    else if (item.hex === fgHex) role = 'foreground';
    else if (item.hex === accentHex || item.metrics.chroma >= 0.12) role = 'accent';

    return {
      hex: item.hex,
      role,
      frequency: item.freq,
    };
  });
}

export class DesignAnalyzer {
  private renderer: PageRenderer;

  constructor(renderer?: PageRenderer) {
    this.renderer = renderer || new PageRenderer();
  }

  /**
   * Sayfa tasarım token'larını analiz eder (Renkler, Tipografi, Spacing).
   */
  async analyze(
    url: string,
    precomputedTokens?: DesignTokens,
    options?: { allowLocalhostTargets?: boolean; fallbackHtml?: string }
  ): Promise<DesignTokens> {
    if (precomputedTokens && precomputedTokens.colors?.length > 0) {
      return precomputedTokens;
    }

    if (options?.fallbackHtml !== undefined) {
      return this.analyzeHtmlStatic(options.fallbackHtml);
    }

    try {
      const renderResult = await this.renderer.render(url, {
        timeoutMs: 15000,
        allowLocalhostTargets: options?.allowLocalhostTargets,
      });
      return renderResult.designTokens;
    } catch (error) {
      console.warn(
        `[DesignAnalyzer] Offscreen render uyarısı [${url}], statik ayrıştırma deneniyor:`,
        error
      );
      return this.analyzeStatic(url, options?.allowLocalhostTargets);
    }
  }

  /**
   * Statik HTML/CSS içeriğinden CSS Color 4 ve luminans tabanlı tasarım token'ları çıkarır.
   */
  public analyzeHtmlStatic(bodyText: string): DesignTokens {
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

    const $ = cheerio.load(bodyText || '');
    const colorMap = new Map<string, number>();

    const hexRegex = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;
    let match: RegExpExecArray | null;
    while ((match = hexRegex.exec(bodyText)) !== null) {
      let hex = match[0].toLowerCase();
      if (hex.length === 4) {
        hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
      }
      colorMap.set(hex, (colorMap.get(hex) || 0) + 1);
    }

    const css4Regex = /\b(?:oklch|oklab|color)\([^)]+\)/gi;
    let css4Match: RegExpExecArray | null;
    while ((css4Match = css4Regex.exec(bodyText)) !== null) {
      const normalized = css4Match[0].replace(/\s+/g, ' ').trim();
      if (!normalized.includes('var(')) {
        colorMap.set(normalized, (colorMap.get(normalized) || 0) + 2);
      }
    }

    const topColors = Array.from(colorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);

    const colors: ColorToken[] =
      topColors.length > 0 ? classifyPaletteRoles(topColors) : defaultTokens.colors;

    const logo = $('header img, nav img, [class*="logo"] img').attr('src') || '';
    const favicon = $('link[rel*="icon"]').attr('href') || '';
    const svgCount = $('svg').length;
    const h1Text = $('h1').first().text().trim();
    const pText = $('p').first().text().trim();

    const navLinks: Array<{ text: string; href: string }> = [];
    $('header a, nav a')
      .slice(0, 16)
      .each((_, el) => {
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
  }

  /**
   * Offscreen render başarısız olursa statik HTML üzerinden temel renk ve fontları çıkarır.
   */
  private async analyzeStatic(
    url: string,
    allowLocalhostTargets?: boolean
  ): Promise<DesignTokens> {
    try {
      const res = await HttpClient.fetchText({
        url,
        timeoutMs: 6000,
        maxRetries: 0,
        headers: { 'user-agent': buildDefaultUserAgent() },
        allowLocalhostTargets,
      });
      return this.analyzeHtmlStatic(res.text);
    } catch {
      return this.analyzeHtmlStatic('');
    }
  }
}
