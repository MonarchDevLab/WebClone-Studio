import { describe, expect, it } from 'vitest';
import { extractDesignTokensFromCss } from '../../../../src/main/cloner/reverse-engineering/token-extractor';

describe('extractDesignTokensFromCss', () => {
  it('extracts css variables and classifies them', () => {
    const sampleCss = `
      :root {
        --primary-color: #3b82f6;
        --background-color: #0f172a;
        --font-sans: 'Inter', sans-serif;
        --border-radius-lg: 12px;
      }
      body {
        color: var(--primary-color);
        background: #0f172a;
        font-family: var(--font-sans);
      }
    `;

    const result = extractDesignTokensFromCss([sampleCss]);

    expect(result.tokens).toBeDefined();
    expect(result.tokens.variables['--primary-color']).toBe('#3b82f6');
    expect(result.tokens.variables['--background-color']).toBe('#0f172a');
    expect(result.tokens.variables['--font-sans']).toBe("'Inter', sans-serif");
    expect(result.tokens.variables['--border-radius-lg']).toBe('12px');
    expect(result.tokens.colors).toContain('#3b82f6');
    expect(result.tokens.colors).toContain('#0f172a');
  });

  it('generates a valid tailwind.config.js template string', () => {
    const sampleCss = `
      :root {
        --brand-blue: #0066cc;
        --brand-font: 'Roboto', sans-serif;
      }
    `;

    const result = extractDesignTokensFromCss([sampleCss]);
    expect(result.tailwindConfig).toContain('module.exports = {');
    expect(result.tailwindConfig).toContain('colors:');
    expect(result.tailwindConfig).toContain('#0066cc');
    expect(result.tailwindConfig).toContain('brand-blue');
  });

  it('handles empty or malformed css without throwing', () => {
    expect(() => extractDesignTokensFromCss([])).not.toThrow();
    const emptyResult = extractDesignTokensFromCss([]);
    expect(emptyResult.tokens.variables).toEqual({});
    expect(emptyResult.tailwindConfig).toContain('module.exports = {');
  });
});
