/**
 * CSS dosyalarından ve stillerden CSS Değişkenleri, Renkler, Fontlar ve Tailwind konfigürasyonu çıkarır.
 */
export interface ExtractedDesignTokens {
  variables: Record<string, string>;
  colors: string[];
  fontFamilies: string[];
}

export interface TokenExtractionResult {
  tokens: ExtractedDesignTokens;
  tailwindConfig: string;
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

  // 2. Renkleri Tara (Hex)
  const hexRegex = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
  let hexMatch: RegExpExecArray | null;
  while ((hexMatch = hexRegex.exec(combinedCss)) !== null) {
    let hex = hexMatch[0].toLowerCase();
    if (hex.length === 4) {
      hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }
    colorCountMap.set(hex, (colorCountMap.get(hex) || 0) + 1);
  }

  // Değişkenlerdeki renkleri de ekle
  for (const val of Object.values(variables)) {
    if (val.startsWith('#')) {
      const lower = val.toLowerCase();
      colorCountMap.set(lower, (colorCountMap.get(lower) || 0) + 5);
    }
  }

  // 3. Font Ailelerini Tara (font-family: ...)
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

  // 4. Tailwind Config Şablonu Üret
  const tailwindColorExtend: Record<string, string> = {};

  for (const [key, val] of Object.entries(variables)) {
    if (val.startsWith('#') || val.startsWith('rgb') || val.startsWith('hsl')) {
      const cleanKey = key.replace(/^--/, '').replace(/-(color|colour)/i, '');
      tailwindColorExtend[cleanKey] = val;
    }
  }

  sortedColors.slice(0, 10).forEach((color, idx) => {
    const colorKey = `custom-${idx + 1}`;
    if (!Object.values(tailwindColorExtend).includes(color)) {
      tailwindColorExtend[colorKey] = color;
    }
  });

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
        sans: [${fontSet.size > 0 ? Array.from(fontSet).slice(0, 3).map(f => JSON.stringify(f)).join(', ') : '"Inter", "sans-serif"'}],
      }
    }
  },
  plugins: []
};
`;

  return {
    tokens: {
      variables,
      colors: sortedColors,
      fontFamilies: Array.from(fontSet),
    },
    tailwindConfig,
  };
}
