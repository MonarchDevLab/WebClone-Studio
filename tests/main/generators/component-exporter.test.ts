import { describe, it, expect } from 'vitest';
import { ComponentExporter } from '../../../src/main/generators/component-exporter';

describe('ComponentExporter TSX Upgrade', () => {
  it('renders multiple semantic body landmarks inside a React Fragment instead of dropping siblings', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <body>
          <header class="site-hdr"><nav><a href="/">Home</a></nav></header>
          <main><section class="hero"><h1>Welcome</h1></section></main>
          <footer><p>Copyright 2026</p></footer>
        </body>
      </html>
    `;

    const tsx = ComponentExporter.generateReactComponent(html, 'landing-page');
    expect(tsx).toContain('export const LandingPage: React.FC');
    expect(tsx).toContain('<>');
    expect(tsx).toContain('<header className="site-hdr">');
    expect(tsx).toContain('<main>');
    expect(tsx).toContain('<footer>');
    expect(tsx).toContain('</>');

    const landmarks = ComponentExporter.exportLandmarks(html, 'Marketing');
    expect(landmarks.map((l) => l.name)).toContain('MarketingHeader');
    expect(landmarks.map((l) => l.name)).toContain('MarketingMain');
    expect(landmarks.map((l) => l.name)).toContain('MarketingFooter');
  });

  it('preserves semicolons and colons inside url(data:image/svg+xml;base64,...) inline styles', () => {
    const html = `
      <html><body>
        <div style="background-image: url('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='); color: #06b6d4; padding: 12px">Icon Box</div>
      </body></html>
    `;

    const tsx = ComponentExporter.generateReactComponent(html, 'IconCard');
    expect(tsx).toContain("backgroundImage: 'url(\\'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=\\')'");
    expect(tsx).toContain("color: '#06b6d4'");
    expect(tsx).toContain("padding: '12px'");
  });
});
