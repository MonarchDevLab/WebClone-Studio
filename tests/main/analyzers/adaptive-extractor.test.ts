import { describe, it, expect } from 'vitest';
import { AdaptiveExtractor } from '../../../src/main/analyzers/adaptive-extractor';

describe('AdaptiveExtractor', () => {
  const sampleObfuscatedHtml = `
    <!DOCTYPE html>
    <html>
      <head><title>Obfuscated Tech Store</title></head>
      <body>
        <header class="css-1a2b3c">
          <nav>
            <a href="/">Home</a>
            <a href="/about">About</a>
          </nav>
        </header>

        <main id="root-content" class="x_99z">
          <h1 class="font-bold text-3xl">En Yeni Ürünler</h1>
          <p class="desc">Modern teknoloji ürünleri kataloğu.</p>

          <div class="grid-wrap-hash789">
            <div class="item-card-x1">
              <img src="/assets/phone1.jpg" alt="Pro Telefon X" />
              <h2 class="title-h">Pro Telefon X</h2>
              <span class="price-val">15.999 TL</span>
              <a href="/products/phone-x" class="btn-hash">İncele</a>
            </div>
            <div class="item-card-x1">
              <img src="/assets/laptop2.jpg" alt="Ultra Laptop Pro" />
              <h2 class="title-h">Ultra Laptop Pro</h2>
              <span class="price-val">34.500 TL</span>
              <a href="/products/laptop-pro" class="btn-hash">İncele</a>
            </div>
            <div class="item-card-x1">
              <img src="/assets/headphones.jpg" alt="Kablosuz Kulaklık" />
              <h2 class="title-h">Kablosuz Kulaklık</h2>
              <span class="price-val">3.200 TL</span>
              <a href="/products/headphones" class="btn-hash">İncele</a>
            </div>
          </div>

          <div class="pagination-container">
            <a href="/products?page=2" rel="next" aria-label="Sonraki Sayfa">Daha Fazla Yükle</a>
          </div>
        </main>

        <footer class="ft-99">
          <p>© 2026 Tech Store. All rights reserved.</p>
        </footer>
      </body>
    </html>
  `;

  it('should adaptively detect main content container and primary heading', () => {
    const result = AdaptiveExtractor.extract(sampleObfuscatedHtml, 'https://store.example.com/products');

    expect(result.mainContent).toBeDefined();
    expect(result.mainContent.heading).toBe('En Yeni Ürünler');
    expect(result.mainContent.textLength).toBeGreaterThan(50);
  });

  it('should locate repeating semantic card entities without hardcoded class names', () => {
    const result = AdaptiveExtractor.extract(sampleObfuscatedHtml, 'https://store.example.com/products');

    expect(result.entities).toBeDefined();
    expect(result.entities.length).toBe(3);

    const firstItem = result.entities[0];
    expect(firstItem.title).toBe('Pro Telefon X');
    expect(firstItem.link).toBe('https://store.example.com/products/phone-x');
    expect(firstItem.image).toBe('https://store.example.com/assets/phone1.jpg');
    expect(firstItem.badgeOrPrice).toContain('15.999 TL');
  });

  it('should locate next page / load more pagination triggers adaptively', () => {
    const result = AdaptiveExtractor.extract(sampleObfuscatedHtml, 'https://store.example.com/products');

    expect(result.paginationTrigger).toBeDefined();
    expect(result.paginationTrigger?.url).toBe('https://store.example.com/products?page=2');
    expect(result.paginationTrigger?.label).toContain('Daha Fazla Yükle');
  });
});
