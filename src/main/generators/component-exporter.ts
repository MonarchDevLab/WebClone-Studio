import * as cheerio from 'cheerio';

const ATTR_REACT_MAP: Record<string, string> = {
  class: 'className',
  for: 'htmlFor',
  tabindex: 'tabIndex',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  readonly: 'readOnly',
  maxlength: 'maxLength',
  autocomplete: 'autoComplete',
  autofocus: 'autoFocus',
  srcset: 'srcSet',
  crossorigin: 'crossOrigin',
  viewbox: 'viewBox',
  preserveaspectratio: 'preserveAspectRatio',
  datetime: 'dateTime',
  enctype: 'encType',
  novalidate: 'noValidate',
};

const SELF_CLOSING_TAGS = new Set([
  'img',
  'input',
  'br',
  'hr',
  'source',
  'path',
  'circle',
  'rect',
  'line',
  'polygon',
  'polyline',
]);

function sanitizeComponentName(raw: string): string {
  const cleaned = (raw || 'ExtractedComponent')
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, ch: string) => ch.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '');
  if (!cleaned) return 'ExtractedComponent';
  const pascal = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return /^[A-Za-z]/.test(pascal) ? pascal : `Section${pascal}`;
}

/**
 * Quote- and parenthesis-aware CSS declaration splitter so data URLs such as
 * `background-image: url(data:image/svg+xml;base64,AAA); color: #fff` do not split on `;` inside `url(...)`.
 */
function splitCssDeclarations(styleAttr: string): Array<{ prop: string; value: string }> {
  const declarations: string[] = [];
  let current = '';
  let parenDepth = 0;
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (let i = 0; i < styleAttr.length; i++) {
    const ch = styleAttr[i];
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      current += ch;
      escaped = true;
      continue;
    }
    if (quote) {
      if (ch === quote) quote = null;
      current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '(') parenDepth++;
    else if (ch === ')' && parenDepth > 0) parenDepth--;

    if (ch === ';' && parenDepth === 0) {
      if (current.trim()) declarations.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) declarations.push(current.trim());

  const parsed: Array<{ prop: string; value: string }> = [];
  for (const decl of declarations) {
    let colonIdx = -1;
    parenDepth = 0;
    quote = null;
    for (let i = 0; i < decl.length; i++) {
      const ch = decl[i];
      if (ch === '"' || ch === "'") {
        quote = quote === ch ? null : quote || ch;
      } else if (!quote) {
        if (ch === '(') parenDepth++;
        else if (ch === ')' && parenDepth > 0) parenDepth--;
        else if (ch === ':' && parenDepth === 0) {
          colonIdx = i;
          break;
        }
      }
    }
    if (colonIdx > 0) {
      const prop = decl.slice(0, colonIdx).trim();
      const val = decl.slice(colonIdx + 1).trim();
      if (prop && val) parsed.push({ prop, value: val });
    }
  }
  return parsed;
}

function serializeNodeToJsx(node: any, indentLevel: number = 4): string {
  const indent = ' '.repeat(indentLevel);

  if (node.type === 'text') {
    let text = String(node.data || '').replace(/\s+/g, ' ');
    if (text.trim() === '') return '';
    text = text.replace(/{/g, '&#123;').replace(/}/g, '&#125;');
    return `${indent}${text}\n`;
  }

  if (node.type !== 'tag' || !node.tagName) return '';

  const tagName = String(node.tagName).toLowerCase();
  let attrsStr = '';

  if (Array.isArray(node.attributes)) {
    for (const attr of node.attributes) {
      const rawName = String(attr.name || '').toLowerCase();
      const value = String(attr.value ?? '');

      if (rawName === 'style') {
        const decls = splitCssDeclarations(value);
        const styleObj: string[] = [];
        for (const { prop, value: cssVal } of decls) {
          const camelKey = prop.startsWith('--')
            ? JSON.stringify(prop)
            : prop.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());
          styleObj.push(`${camelKey}: '${cssVal.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`);
        }
        if (styleObj.length > 0) {
          attrsStr += ` style={{ ${styleObj.join(', ')} }}`;
        }
        continue;
      }

      let reactName = ATTR_REACT_MAP[rawName] || rawName;
      if (
        !ATTR_REACT_MAP[rawName] &&
        reactName.includes('-') &&
        !reactName.startsWith('data-') &&
        !reactName.startsWith('aria-')
      ) {
        reactName = reactName.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());
      }

      if (value === '') {
        attrsStr += ` ${reactName}`;
      } else {
        const escapedValue = value.replace(/"/g, '&quot;');
        attrsStr += ` ${reactName}="${escapedValue}"`;
      }
    }
  }

  if (SELF_CLOSING_TAGS.has(tagName)) {
    return `${indent}<${tagName}${attrsStr} />\n`;
  }

  let innerHtml = '';
  if (Array.isArray(node.childNodes) && node.childNodes.length > 0) {
    for (const child of node.childNodes) {
      innerHtml += serializeNodeToJsx(child, indentLevel + 2);
    }
  }

  if (innerHtml.trim() === '') {
    return `${indent}<${tagName}${attrsStr}></${tagName}>\n`;
  }

  return `${indent}<${tagName}${attrsStr}>\n${innerHtml}${indent}</${tagName}>\n`;
}

export class ComponentExporter {
  /**
   * HTML dizgesindeki anlamlı tüm kök bölümleri (header/main/footer veya çoklu section)
   * geçerli React (TSX) bileşen koduna dönüştürür.
   */
  public static generateReactComponent(
    html: string,
    componentName: string = 'ExtractedComponent'
  ): string {
    const safeName = sanitizeComponentName(componentName);
    const $ = cheerio.load(html, { xmlMode: false });

    $('script, style, noscript, iframe, link, meta, title').remove();

    const bodyChildren = $('body')
      .children()
      .toArray()
      .filter((el: any) => el.type === 'tag');
    const rootNodes =
      bodyChildren.length > 0
        ? bodyChildren
        : $.root()
            .children()
            .toArray()
            .filter((el: any) => el.type === 'tag');

    if (rootNodes.length === 0) {
      return `import React from 'react';\n\nexport const ${safeName}: React.FC = () => (\n  <div>Boş Bileşen</div>\n);\n`;
    }

    const renderedParts = rootNodes.map((n) => serializeNodeToJsx(n, rootNodes.length > 1 ? 6 : 4)).filter(Boolean);
    const jsxBody =
      rootNodes.length === 1
        ? renderedParts[0].trimEnd()
        : `    <>\n${renderedParts.join('')}    </>`;

    return `import React from 'react';

export const ${safeName}: React.FC = () => {
  return (
${jsxBody}
  );
};
`;
  }

  /**
   * Sayfa içindeki anlamsal landmark bölgelerini (`header`, `nav`, `main`, `section`, `footer`)
   * ayrı TSX bileşenleri halinde üretir.
   */
  public static exportLandmarks(
    html: string,
    basePrefix: string = 'Page'
  ): Array<{ name: string; tsx: string }> {
    const safePrefix = sanitizeComponentName(basePrefix);
    const $ = cheerio.load(html, { xmlMode: false });
    $('script, style, noscript, iframe, link, meta, title').remove();

    const results: Array<{ name: string; tsx: string }> = [];
    const seenTags = new Map<string, number>();

    $('header, nav, main, section, footer').each((_, elem) => {
      const tag = String((elem as any).tagName || 'section').toLowerCase();
      const idx = (seenTags.get(tag) || 0) + 1;
      seenTags.set(tag, idx);
      const label = tag.charAt(0).toUpperCase() + tag.slice(1);
      const compName = idx === 1 ? `${safePrefix}${label}` : `${safePrefix}${label}${idx}`;
      const body = serializeNodeToJsx(elem, 4).trimEnd();
      if (!body) return;

      results.push({
        name: compName,
        tsx: `import React from 'react';\n\nexport const ${compName}: React.FC = () => {\n  return (\n${body}\n  );\n};\n`,
      });
    });

    return results;
  }
}
