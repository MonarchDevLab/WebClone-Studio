import * as cheerio from 'cheerio';

export interface AdaptiveEntity {
  title: string;
  link?: string;
  image?: string;
  description?: string;
  badgeOrPrice?: string;
  confidence: number;
}

export interface AdaptivePaginationTrigger {
  url: string;
  label: string;
  type: 'link' | 'button';
}

export interface AdaptiveMainContent {
  heading: string;
  textSnippet: string;
  textLength: number;
  tagName: string;
}

export interface AdaptiveExtractionResult {
  url: string;
  mainContent: AdaptiveMainContent;
  entities: AdaptiveEntity[];
  paginationTrigger?: AdaptivePaginationTrigger;
}

/**
 * Self-Healing / Adaptif Semantik İçerik Çıkarıcı
 * Scrapling benzeri adaptif heuristikler kullanarak; CSS sınıf isimlerinden (hash/obfuscated)
 * bağımsız olarak ana içerik bloğunu, tekrarlayan veri kartlarını (ürün, makale, özellik)
 * ve sayfalama/yükleme tetikleyicilerini çıkarır.
 */
export class AdaptiveExtractor {
  private static resolveUrl(relativeOrAbsolute: string, baseUrl: string): string {
    try {
      return new URL(relativeOrAbsolute, baseUrl).href;
    } catch {
      return relativeOrAbsolute;
    }
  }

  public static extract(html: string, pageUrl: string): AdaptiveExtractionResult {
    const $ = cheerio.load(html);

    // 1. Ana İçerik Bloğu (Main Content) Tespiti
    let heading = $('main h1, article h1, h1').first().text().trim();
    if (!heading) {
      heading = $('main h2, article h2, h2').first().text().trim() || $('title').text().trim();
    }

    const mainContainer = $('main, article, #root-content, #content, [role="main"]').first();
    const containerTarget = mainContainer.length > 0 ? mainContainer : $('body');
    const containerText = containerTarget.clone()
      .find('script, style, nav, footer, header')
      .remove()
      .end()
      .text()
      .replace(/\s+/g, ' ')
      .trim();

    const mainContent: AdaptiveMainContent = {
      heading,
      textSnippet: containerText.slice(0, 300),
      textLength: containerText.length,
      tagName: containerTarget.prop('tagName')?.toLowerCase() || 'body',
    };

    // 2. Tekrarlayan Varlıklar (Cards / Entities) Tespiti
    const entities: AdaptiveEntity[] = [];
    const parentCandidates = new Map<any, any[]>();

    // Potansiyel kart konteynerlarını grupla
    $('div, li, article, section').each((_i, el) => {
      const parent = $(el).parent().get(0);
      if (!parent) return;

      if (!parentCandidates.has(parent)) {
        parentCandidates.set(parent, []);
      }
      parentCandidates.get(parent)!.push(el);
    });

    // En az 2 benzer kardeşi olan ebeveynleri filtrele
    let bestCluster: any[] = [];
    let highestScore = 0;

    for (const [_parent, children] of parentCandidates.entries()) {
      if (children.length < 2 || children.length > 100) continue;

      // Her çocuğun başlık ve link barındırma durumunu sına
      let validChildCount = 0;
      for (const child of children) {
        const $child = $(child);
        const hasTitle = $child.find('h2, h3, h4, h5, [class*="title"], strong').length > 0;
        const hasLink = $child.find('a[href]').length > 0 || $child.is('a[href]');
        if (hasTitle && hasLink) {
          validChildCount++;
        }
      }

      if (validChildCount >= 2 && validChildCount > highestScore) {
        highestScore = validChildCount;
        bestCluster = children.filter((c) => {
          const $c = $(c);
          return ($c.find('h2, h3, h4, h5, [class*="title"], strong').length > 0) &&
                 ($c.find('a[href]').length > 0 || $c.is('a[href]'));
        });
      }
    }

    const priceRegex = /(\d+[\.,\d]*\s*(?:TL|TRY|USD|EUR|€|\$|£|₺)|(?:€|\$|£|₺)\s*\d+[\.,\d]*)/i;

    for (const cardEl of bestCluster) {
      const $card = $(cardEl);

      // Başlık
      let title = $card.find('h2, h3, h4, h5, [class*="title"]').first().text().trim();
      if (!title) {
        title = $card.find('a[href]').first().text().trim();
      }

      // Link
      let linkRaw = $card.find('a[href]').first().attr('href');
      if (!linkRaw && $card.is('a[href]')) {
        linkRaw = $card.attr('href');
      }
      const link = linkRaw ? this.resolveUrl(linkRaw, pageUrl) : undefined;

      // Görsel
      const imgRaw = $card.find('img[src], img[data-src]').first().attr('src') ||
                     $card.find('img[data-src]').first().attr('data-src');
      const image = imgRaw ? this.resolveUrl(imgRaw, pageUrl) : undefined;

      // Fiyat / Rozet
      let badgeOrPrice: string | undefined;
      const cardText = $card.text();
      const priceMatch = cardText.match(priceRegex);
      if (priceMatch) {
        badgeOrPrice = priceMatch[0].trim();
      } else {
        const badgeEl = $card.find('[class*="badge"], [class*="price"], [class*="tag"]').first();
        if (badgeEl.length > 0) {
          badgeOrPrice = badgeEl.text().trim();
        }
      }

      // Açıklama
      const desc = $card.find('p, [class*="desc"]').first().text().trim();

      if (title) {
        entities.push({
          title,
          link,
          image,
          description: desc || undefined,
          badgeOrPrice,
          confidence: Math.min(1.0, 0.5 + (image ? 0.2 : 0) + (badgeOrPrice ? 0.2 : 0) + (link ? 0.1 : 0)),
        });
      }
    }

    // 3. Sayfalama / Yükleme Tetikleyicisi (Pagination Trigger)
    let paginationTrigger: AdaptivePaginationTrigger | undefined;

    // rel="next" önceliği
    const relNext = $('a[rel="next"], link[rel="next"]').first();
    if (relNext.length > 0 && relNext.attr('href')) {
      paginationTrigger = {
        url: this.resolveUrl(relNext.attr('href')!, pageUrl),
        label: relNext.text().trim() || 'Next Page',
        type: 'link',
      };
    } else {
      // Metin ve aria-label heuristiği
      const paginationRegex = /(?:daha fazla|load more|show more|sonraki|next)/i;
      $('a[href], button').each((_i, el) => {
        if (paginationTrigger) return;
        const $el = $(el);
        const text = $el.text().trim();
        const ariaLabel = $el.attr('aria-label') || '';
        const href = $el.attr('href');

        if ((paginationRegex.test(text) || paginationRegex.test(ariaLabel)) && href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          paginationTrigger = {
            url: AdaptiveExtractor.resolveUrl(href, pageUrl),
            label: text || ariaLabel,
            type: el.tagName.toLowerCase() === 'button' ? 'button' : 'link',
          };
        }
      });
    }

    return {
      url: pageUrl,
      mainContent,
      entities,
      paginationTrigger,
    };
  }
}
