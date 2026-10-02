import * as cheerio from 'cheerio';

export interface ExtractedItem {
  title?: string;
  link?: string;
  image?: string;
  description?: string;
  [key: string]: any;
}

export interface ExtractedCollection {
  type: string;
  selector: string;
  count: number;
  items: ExtractedItem[];
}

export class StructuredDataExtractor {
  /**
   * HTML ieriindeki tekrarlayan yaplar (List/Grid) tespit edip,
   * balk, link, grsel ve aklama verilerini kartr.
   * @param html Kaynak HTML metni
   * @returns Bulunan yaplandrlm veri koleksiyonlar
   */
  public extract(html: string): ExtractedCollection[] {
    const $ = cheerio.load(html);
    const collections: ExtractedCollection[] = [];
    const candidates = new Set<any>();

    // 1. Aama: Tekrarlayan elemanlara sahip kapsayclar bul (ul, ol, div, section, vs.)
    $('ul, ol, div, section, main, article').each((_, el) => {
      const children = $(el).children();
      if (children.length >= 3) { // En az 3 eleman olmal (grid/list varsaym)
        const tagCounts = new Map<string, number>();
        children.each((__, child) => {
          const tag = child.tagName.toLowerCase();
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });

        // ocuklarn dominant bir etiket tipi varsa (en az %50 ve >= 3)
        for (const [tag, count] of tagCounts.entries()) {
          if (count >= 3 && count >= children.length * 0.5) {
            candidates.add(el);
            break;
          }
        }
      }
    });

    // 2. Aama: Aday kapsayclarn iindeki eleri (items) aykla
    candidates.forEach((container) => {
      const children = $(container).children();
      const items: ExtractedItem[] = [];

      children.each((_, child) => {
        const item: ExtractedItem = {};
        const $child = $(child);

        // Balk (h1-h6 veya belirgin bir 'a' veya gl bir span)
        const titleEl = $child.find('h1, h2, h3, h4, h5, h6').first();
        if (titleEl.length) {
          item.title = titleEl.text().trim().replace(/\s+/g, ' ');
        } else {
          const linkEl = $child.find('a').first();
          if (linkEl.length && linkEl.text().trim().length > 0) {
            item.title = linkEl.text().trim().replace(/\s+/g, ' ');
          }
        }

        // Link (ilk 'a' href'i)
        const link = $child.find('a').first().attr('href');
        if (link) {
          item.link = link.trim();
        }

        // Grsel (ilk 'img' src'i veya srcset/data-src)
        const imgEl = $child.find('img').first();
        if (imgEl.length) {
          const src = imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('srcset');
          if (src) {
            item.image = src.split(' ')[0].trim(); // srcset durumunda ilkini al
          }
        }

        // Aklama (ilk 'p' veya '.description' trevi bir eleman)
        const descEl = $child.find('p, span').filter((__, el) => {
            const text = $(el).text().trim();
            // Makul uzunlukta bir aklama metni aryoruz, balk deilse
            return text.length > 30 && text !== item.title;
        }).first();
        
        if (descEl.length) {
          item.description = descEl.text().trim().replace(/\s+/g, ' ');
        }

        // Sadece bo olmayan ve anlaml verisi olan item'lar ekle
        if (Object.keys(item).length > 0 && (item.title || item.image || item.description)) {
          items.push(item);
        }
      });

      // Eer yeterince geerli item karabildiysek, koleksiyona ekle
      if (items.length >= 3) {
        let selector = container.tagName.toLowerCase();
        const id = $(container).attr('id');
        if (id) {
            selector += '#' + id;
        }
        const className = $(container).attr('class');
        if (className) {
            selector += '.' + className.split(/\s+/).filter(Boolean).join('.');
        }

        collections.push({
          type: (container.tagName.toLowerCase() === 'ul' || container.tagName.toLowerCase() === 'ol') ? 'list' : 'grid',
          selector,
          count: items.length,
          items
        });
      }
    });

    // 3. Aama: ok genel/bo sonular filtrele ve en kapsaml olanlar srala
    return collections.sort((a, b) => {
        // ok eitli veri ieren (title, img, desc hepsini bulan) listeler ne ksn
        const aScore = a.items.reduce((acc, curr) => acc + Object.keys(curr).length, 0);
        const bScore = b.items.reduce((acc, curr) => acc + Object.keys(curr).length, 0);
        return bScore - aScore;
    });
  }
}
