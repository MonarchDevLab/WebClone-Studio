import { AnalyzeResult, TechSignature, ColorToken, TypoToken } from '../../shared/types';

/**
 * _meta/tech-report.html için bağımsız, CSS ve JS gömülü, modern bir görsel rapor sayfası üretir.
 */
export class ReportGenerator {
  private static escapeHtml(str: string): string {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  public static generateHtmlReport(result: AnalyzeResult, domain: string): string {
    const safeDomain = this.escapeHtml(domain);
    const techCards = result.technologies.map((t: TechSignature) => `
      <div class="tech-card">
        <div class="tech-header">
          <span class="tech-name">${this.escapeHtml(t.name)}</span>
          <span class="tech-badge">%${t.confidence}</span>
        </div>
        <div class="tech-category">${this.escapeHtml(t.category)}</div>
        ${t.version ? `<div class="tech-version">Sürüm: ${this.escapeHtml(t.version)}</div>` : ''}
        <div class="signals-list">
          ${t.signals.map(s => `<span class="signal-tag">${this.escapeHtml(s)}</span>`).join('')}
        </div>
      </div>
    `).join('');

    const colorSwatches = (result.designTokens?.colors || []).map((c: ColorToken) => `
      <div class="color-card">
        <div class="color-preview" style="background-color: ${c.hex};"></div>
        <div class="color-info">
          <span class="color-hex">${c.hex}</span>
          <span class="color-role">${c.role} (${c.frequency}x)</span>
        </div>
      </div>
    `).join('');

    const typoItems = (result.designTokens?.typography || []).map((ty: TypoToken) => `
      <div class="typo-row">
        <div class="typo-role">${ty.role}</div>
        <div class="typo-family" style="font-family: ${ty.fontFamily};">${ty.fontFamily}</div>
        <div class="typo-meta">${ty.fontSize} / ${ty.fontWeight} / ${ty.lineHeight}</div>
      </div>
    `).join('');

    return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Teknoloji & Tasarım Raporu — ${safeDomain}</title>
  <style>
    :root {
      --bg: #08090A;
      --card: #16181D;
      --border: rgba(255, 255, 255, 0.08);
      --text: #F4F4F5;
      --muted: #A1A1AA;
      --accent: #6366F1;
      --success: #10B981;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 40px 20px;
      line-height: 1.5;
    }
    .container { max-width: 1100px; margin: 0 auto; }
    header { margin-bottom: 40px; border-bottom: 1px solid var(--border); padding-bottom: 20px; }
    h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
    .subtitle { color: var(--muted); font-size: 14px; }
    section { margin-bottom: 48px; }
    h2 { font-size: 18px; font-weight: 600; margin-bottom: 16px; color: var(--text); border-left: 3px solid var(--accent); padding-left: 10px; }
    
    .tech-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
    .tech-card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 16px; }
    .tech-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .tech-name { font-weight: 600; font-size: 16px; }
    .tech-badge { background: rgba(99, 102, 241, 0.2); color: var(--accent); font-size: 11px; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
    .tech-category { color: var(--muted); font-size: 12px; margin-bottom: 10px; }
    .tech-version { color: var(--text); font-size: 12px; margin-bottom: 8px; }
    .signals-list { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
    .signal-tag { background: rgba(255,255,255,0.05); color: var(--muted); font-size: 10px; padding: 2px 6px; border-radius: 3px; }

    .color-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
    .color-card { background: var(--card); border: 1px solid var(--border); border-radius: 6px; overflow: hidden; display: flex; }
    .color-preview { width: 50px; height: 50px; flex-shrink: 0; }
    .color-info { padding: 8px 12px; display: flex; flex-direction: column; justify-content: center; font-size: 12px; }
    .color-hex { font-weight: 600; font-family: monospace; }
    .color-role { color: var(--muted); font-size: 10px; }

    .typo-list { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 16px; }
    .typo-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border); }
    .typo-row:last-child { border-bottom: none; }
    .typo-role { font-weight: 600; width: 100px; font-size: 13px; color: var(--accent); }
    .typo-family { flex: 1; font-size: 14px; }
    .typo-meta { font-family: monospace; font-size: 12px; color: var(--muted); }

    .meta-box { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 16px; }
    .meta-item { display: flex; margin-bottom: 8px; font-size: 13px; }
    .meta-label { width: 140px; color: var(--muted); font-weight: 500; }
    .meta-value { color: var(--text); flex: 1; word-break: break-all; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Teknoloji & Tasarım Analiz Raporu</h1>
      <div class="subtitle">Hedef: <strong>${domain}</strong> &bull; Üretilme Tarihi: ${new Date().toLocaleString('tr-TR')}</div>
    </header>

    <section>
      <h2>Tespit Edilen Teknolojiler (${result.technologies.length})</h2>
      <div class="tech-grid">
        ${techCards || '<p style="color: var(--muted);">Teknoloji tespit edilemedi.</p>'}
      </div>
    </section>

    <section>
      <h2>Tasarım Renk Paleti</h2>
      <div class="color-grid">
        ${colorSwatches || '<p style="color: var(--muted);">Renk paleti çıkarılamadı.</p>'}
      </div>
    </section>

    <section>
      <h2>Tipografi Skalası</h2>
      <div class="typo-list">
        ${typoItems || '<p style="color: var(--muted);">Tipografi bilgisi çıkarılamadı.</p>'}
      </div>
    </section>

    <section>
      <h2>Site Meta & Güvenlik Özeti</h2>
      <div class="meta-box">
        <div class="meta-item"><span class="meta-label">Başlık:</span><span class="meta-value">${this.escapeHtml(result.meta?.title || '—')}</span></div>
        <div class="meta-item"><span class="meta-label">Açıklama:</span><span class="meta-value">${this.escapeHtml(result.meta?.description || '—')}</span></div>
        <div class="meta-item"><span class="meta-label">Dil / Encoding:</span><span class="meta-value">${this.escapeHtml(result.meta?.language || '—')} / ${this.escapeHtml(result.meta?.encoding || '—')}</span></div>
        <div class="meta-item"><span class="meta-label">HTTPS:</span><span class="meta-value">${result.security?.https ? '✓ Aktif' : '✗ Pasif'}</span></div>
        <div class="meta-item"><span class="meta-label">HSTS:</span><span class="meta-value">${result.security?.hsts ? '✓ Var' : '✗ Yok'}</span></div>
        <div class="meta-item"><span class="meta-label">CSP:</span><span class="meta-value">${result.security?.csp ? '✓ Tanımlı' : '✗ Yok'}</span></div>
      </div>
    </section>
  </div>
</body>
</html>`;
  }
}
