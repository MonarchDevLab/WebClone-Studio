/**
 * CSS dosyalarından ve stillerden CSS Değişkenleri, Renkler (CSS Color 4 dahil), Fontlar
 * ve Tailwind v3 JS / Tailwind v4 `@theme` CSS konfigürasyonu çıkarır.
 */
export interface ExtractedDesignTokens {
  variables: Record<string, string>;
  colors: string[];
  fontFamilies: string[];
}

export interface TokenExtractionResult {
  tokens: ExtractedDesignTokens;
  tailwindConfig: string;
  tailwindV4Theme: string;
}

const COLOR_FUNCTION_REGEX = /\b(?:oklch|oklab|color|rgba?|hsla?)\([^)]+\)/gi;

function isColorValue(val: string): boolean {
  const trimmed = val.trim().toLowerCase();
  return (
    trimmed.startsWith('#') ||
    trimmed.startsWith('rgb') ||
    trimmed.startsWith('hsl') ||
    trimmed.startsWith('oklch(') ||
    trimmed.startsWith('oklab(') ||
    trimmed.startsWith('color(')
  );
}

function normalizeTokenKey(rawKey: string): string {
  const stripped = rawKey
    .replace(/^--/, '')
    .replace(/-(color|colour)$/i, '')
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return stripped || 'token';
}

export function extractDesignTokensFromCss(cssContents: string[]): TokenExtractionResult {
  const variables: Record<string, string> = {};
  const colorCountMap = new Map<string, number>();
  const fontSet = new Set<string>();

  const combinedCss = cssContents.join('\n');

  // 1. CSS Değişkenleri (--var-name: value)
  const varRegex = /(--[a-zA-Z0-9-_]+)\s*:\s*([^;}\n]+)/g;
  let varMatch: RegExpExecArray | null;
  while ((varMatch = varRegex.exec(combinedCss)) !== null) {
    const name = varMatch[1].trim();
    const value = varMatch[2].trim();
    if (name && value) {
      variables[name] = value;
    }
  }

  // 2. Hex ve CSS Color 4 renklerini tara (oklch, oklab, color(display-p3 ...), rgb, hsl)
  const hexRegex = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
  let hexMatch: RegExpExecArray | null;
  while ((hexMatch = hexRegex.exec(combinedCss)) !== null) {
    let hex = hexMatch[0].toLowerCase();
    if (hex.length === 4) {
      hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }
    colorCountMap.set(hex, (colorCountMap.get(hex) || 0) + 1);
  }

  const funcRegex = new RegExp(COLOR_FUNCTION_REGEX.source, 'gi');
  let funcMatch: RegExpExecArray | null;
  while ((funcMatch = funcRegex.exec(combinedCss)) !== null) {
    const norm = funcMatch[0].replace(/\s+/g, ' ').trim();
    if (!norm.includes('var(')) {
      colorCountMap.set(norm, (colorCountMap.get(norm) || 0) + 1);
    }
  }

  // Değişkenlerdeki renklere ağırlık ver
  for (const val of Object.values(variables)) {
    if (isColorValue(val)) {
      const normalized = val.startsWith('#') ? val.toLowerCase() : val.replace(/\s+/g, ' ').trim();
      colorCountMap.set(normalized, (colorCountMap.get(normalized) || 0) + 5);
    }
  }

  // 3. Font Ailelerini Tara
  const fontRegex = /font-family\s*:\s*([^;}]+)/gi;
  let fontMatch: RegExpExecArray | null;
  while ((fontMatch = fontRegex.exec(combinedCss)) !== null) {
    const rawFont = fontMatch[1].trim();
    if (rawFont && !rawFont.startsWith('inherit') && !rawFont.startsWith('initial')) {
      fontSet.add(rawFont);
    }
  }

  const sortedColors = Array.from(colorCountMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([color]) => color);

  // 4. Tailwind v3 JS Config + Tailwind v4 @theme CSS Token Çıktısı
  const tailwindColorExtend: Record<string, string> = {};

  for (const [key, val] of Object.entries(variables)) {
    if (isColorValue(val)) {
      const cleanKey = normalizeTokenKey(key);
      tailwindColorExtend[cleanKey] = val;
    }
  }

  sortedColors.slice(0, 12).forEach((color, idx) => {
    const colorKey = `palette-${idx + 1}`;
    if (!Object.values(tailwindColorExtend).includes(color)) {
      tailwindColorExtend[colorKey] = color;
    }
  });

  const fontList = fontSet.size > 0 ? Array.from(fontSet).slice(0, 3) : ['"Inter", "sans-serif"'];

  const tailwindConfig = `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./site/**/*.{html,js,ts,jsx,tsx}",
    "./site/*.html"
  ],
  theme: {
    extend: {
      colors: ${JSON.stringify(tailwindColorExtend, null, 8).replace(/^}/m, '      }')},
      fontFamily: {
        sans: [${fontList.map((f) => JSON.stringify(f)).join(', ')}],
      }
    }
  },
  plugins: []
};
`;

  const themeLines: string[] = ['@import "tailwindcss";', '', '@theme {'];
  for (const [colorKey, colorVal] of Object.entries(tailwindColorExtend)) {
    const propName = colorKey.startsWith('color-') ? `--${colorKey}` : `--color-${colorKey}`;
    themeLines.push(`  ${propName}: ${colorVal};`);
  }
  themeLines.push(`  --font-sans: ${fontList[0]};`);
  themeLines.push('}', '');

  return {
    tokens: {
      variables,
      colors: sortedColors.slice(0, 50),
      fontFamilies: Array.from(fontSet),
    },
    tailwindConfig,
    tailwindV4Theme: themeLines.join('\n'),
  };
}
