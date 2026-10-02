import * as cheerio from 'cheerio';

export class ComponentExporter {
  /**
   * HTML dizgesini React (TSX) bileşen koduna dönüştürür.
   * Class -> className, self-closing tag düzeltmeleri ve style nesnesi dönüşümü yapar.
   */
  public static generateReactComponent(html: string, componentName: string = 'ExtractedComponent'): string {
    const $ = cheerio.load(html, { xmlMode: false });
    
    // Temizleme: script, style ve gereksiz etiketleri kaldır
    $('script, style, noscript, iframe, link, meta, title').remove();
    
    const root = $('body').children().first();
    if (!root.length) {
      return `import React from 'react';\n\nexport const ${componentName}: React.FC = () => (\n  <div>Boş Bileşen</div>\n);\n`;
    }

    const processNode = (node: any, indentLevel: number = 2): string => {
      const indent = ' '.repeat(indentLevel);
      
      if (node.type === 'text') {
        let text = (node as any).data.replace(/\s+/g, ' ');
        if (text.trim() === '') return '';
        // React'te jsx içinde süslü parantezleri escape etmemiz gerekir
        text = text.replace(/{/g, '&#123;').replace(/}/g, '&#125;');
        return `${indent}${text}\n`;
      }
      
      if (node.type !== 'tag') return '';

      const el = node as any;
      const tagName = el.tagName.toLowerCase();
      
      // Attributes dönüştürme
      let attrsStr = '';
      if (el.attributes) {
        for (const attr of el.attributes) {
          let name = attr.name;
          let value = attr.value;
          
          if (name === 'class') name = 'className';
          if (name === 'for') name = 'htmlFor';
          if (name === 'tabindex') name = 'tabIndex';
          if (name === 'colspan') name = 'colSpan';
          if (name === 'rowspan') name = 'rowSpan';
          if (name === 'readonly') name = 'readOnly';
          if (name === 'maxlength') name = 'maxLength';
          if (name === 'autocomplete') name = 'autoComplete';
          if (name === 'autofocus') name = 'autoFocus';
          if (name === 'srcset') name = 'srcSet';
          if (name === 'crossorigin') name = 'crossOrigin';
          
          // Style objesi dönüşümü (basit AST)
          if (name === 'style') {
            const rules = value.split(';').filter(Boolean);
            const styleObj: string[] = [];
            for (const rule of rules) {
              const parts = rule.split(':');
              if (parts.length >= 2) {
                const k = parts[0].trim().replace(/-([a-z])/g, (g: any) => g[1].toUpperCase());
                const v = parts.slice(1).join(':').trim();
                styleObj.push(`${k}: '${v.replace(/'/g, "\\'")}'`);
              }
            }
            if (styleObj.length > 0) {
              attrsStr += ` style={{ ${styleObj.join(', ')} }}`;
            }
            continue;
          }

          // SVG özellikleri düzeltmeleri (kebab-case to camelCase data-* aria-* hariç)
          if (name.includes('-') && !name.startsWith('data-') && !name.startsWith('aria-')) {
            name = name.replace(/-([a-z])/g, (g: any) => g[1].toUpperCase());
          }

          if (value === '') {
            attrsStr += ` ${name}`;
          } else {
            const escapedValue = value.replace(/"/g, '&quot;');
            attrsStr += ` ${name}="${escapedValue}"`;
          }
        }
      }

      const selfClosing = ['img', 'input', 'br', 'hr', 'source', 'path', 'circle', 'rect', 'line', 'polygon', 'polyline'].includes(tagName);
      
      if (selfClosing) {
        return `${indent}<${tagName}${attrsStr} />\n`;
      }

      let innerHtml = '';
      if (el.childNodes && el.childNodes.length > 0) {
        for (const child of el.childNodes) {
          innerHtml += processNode(child, indentLevel + 2);
        }
      }

      if (innerHtml.trim() === '') {
        return `${indent}<${tagName}${attrsStr}></${tagName}>\n`;
      }

      return `${indent}<${tagName}${attrsStr}>\n${innerHtml}${indent}</${tagName}>\n`;
    };

    const componentBody = processNode(root[0], 4).trimEnd();

    return `import React from 'react';

export const ${componentName}: React.FC = () => {
  return (
    ${componentBody.trimStart()}
  );
};
`;
  }
}
