import { AnalyzeResult, SiteMapNode, ColorToken, TypoToken, ComponentBlueprint } from '../../shared/types';

/**
 * Hedef web sitesinin tüm mimarisini, tasarım sistemini, CSS tokenlarını,
 * bileşen iskeletlerini, rota topolojisini ve birebir yeniden üretim kod şablonlarını
 * sıfır eksikle ultra detaylı bir Markdown (.md) Sistem Haritası ve Şartnamesine dönüştürür.
 */
export class SystemMapGenerator {
  /**
   * Ana dönüştürücü metot.
   */
  public static generate(result: AnalyzeResult): string {
    const rootUrl = result.siteMap?.url || 'https://bilinmeyen-site.com';
    let domain = 'Bilinmeyen Domain';
    try {
      domain = new URL(rootUrl).hostname;
    } catch {}

    const now = new Date();
    const formattedDate = now.toLocaleString('tr-TR', {
      dateStyle: 'full',
      timeStyle: 'medium',
    });

    const lines: string[] = [];

    // ==========================================
    // 1. BAŞLIK VE YÖNETİCİ ÖZETİ
    // ==========================================
    lines.push(`# 🌐 SİSTEM HARİTASI VE MİMARİ TASARIM ŞARTNAMESİ: ${domain}`);
    lines.push('');
    lines.push(`> **Rapor Üretim Tarihi:** ${formattedDate}  `);
    lines.push(`> **Hedef Canlı URL:** \`${rootUrl}\`  `);
    lines.push(`> **Motor:** WebClone Studio v1.0.0 (Monolith Works / MonarchDevLab)  `);
    lines.push(`> **Hedef:** Bu doküman, web sitesinin piksel piksel aynısını modern bir React / Next.js / Tailwind CSS yığınında yeniden inşa etmek için gereken tüm tasarım token'larını, bileşen mimarisini ve kaynak kod şablonlarını eksiksiz içerir.`);
    lines.push('');
    lines.push('---');
    lines.push('');

    lines.push('## 1. YÖNETİCİ VE SEO GENEL BAKIŞI');
    lines.push('');
    lines.push('| Parametre | Değer |');
    lines.push('|---|---|');
    lines.push(`| **Domain / Host** | \`${domain}\` |`);
    lines.push(`| **Protokol** | \`${rootUrl.startsWith('https') ? 'HTTPS (TLS Güvenli - Port 443)' : 'HTTP (Şifresiz - Port 80)'}\` |`);
    lines.push(`| **Sayfa Başlığı (Title)** | ${result.meta?.title ? `\`${this.escapeMd(result.meta.title)}\`` : '_Belirtilmemiş_'} |`);
    lines.push(`| **Meta Açıklama** | ${result.meta?.description ? `\`${this.escapeMd(result.meta.description)}\`` : '_Belirtilmemiş_'} |`);
    lines.push(`| **Dil (Language)** | \`${result.meta?.language || 'tr'}\` |`);
    lines.push(`| **Karakter Kodlaması** | \`${result.meta?.encoding || 'UTF-8'}\` |`);
    lines.push(`| **Viewport Politikası** | \`${result.meta?.viewport || 'width=device-width, initial-scale=1.0'}\` |`);
    lines.push(`| **Canonical URL** | ${result.meta?.canonical ? `\`${result.meta.canonical}\`` : '_Belirtilmemiş_'} |`);
    lines.push(`| **Favicon URL** | ${result.designTokens?.assets?.favicon || result.meta?.favicon ? `\`${result.designTokens?.assets?.favicon || result.meta?.favicon}\`` : '_Belirtilmemiş_'} |`);
    lines.push(`| **Logo Kaynağı** | ${result.designTokens?.assets?.logo ? `\`${result.designTokens.assets.logo}\`` : '_Tespit Edilemedi / Inline SVG_'} |`);
    lines.push(`| **SVG İkon Sayısı** | \`${result.designTokens?.assets?.svgCount || 0} adet inline SVG\` |`);
    lines.push(`| **robots.txt Arama İzni** | ${result.security?.robotsTxt ? '✅ Mevcut' : '❌ Bulunamadı'} |`);
    lines.push(`| **sitemap.xml Haritası** | ${result.security?.sitemap ? '✅ Mevcut' : '❌ Bulunamadı'} |`);
    lines.push('');

    if (result.meta?.ogImage) {
      lines.push('### Sosyal Medya Paylaşım Görseli (OpenGraph Image)');
      lines.push(`- **URL:** \`${result.meta.ogImage}\``);
      lines.push('');
    }

    // ==========================================
    // 2. TEKNOLOJİ VE ALTYAPI YIĞINI (TECH STACK)
    // ==========================================
    lines.push('## 2. TEKNOLOJİ VE ALTYAPI YIĞINI (6 KATMANLI DERİN İNCELEME)');
    lines.push('');
    if (!result.technologies || result.technologies.length === 0) {
      lines.push('_Herhangi bir üçüncü taraf kütüphane tespit edilemedi; site tamamen statik vanilya HTML/CSS ile yazılmış olabilir._');
    } else {
      lines.push('| Kategori | Kütüphane / Altyapı | Versiyon | Güven Skoru | Tespit Katmanı / Kanıt |');
      lines.push('|---|---|---|---|---|');
      result.technologies.forEach((tech) => {
        const versionStr = tech.version ? `\`${tech.version}\`` : '_Belirlenemedi_';
        const confidenceStr = `%${Math.round(tech.confidence * 100)}`;
        const signalsStr = (tech.signals || []).map(s => `\`${this.escapeMd(s)}\``).join(', ') || '_Genel imza eşleşmesi_';
        lines.push(`| **${tech.category}** | **${tech.name}** | ${versionStr} | \`${confidenceStr}\` | ${signalsStr} |`);
      });
    }
    lines.push('');

    // ==========================================
    // 3. $10K TASARIM SİSTEMİ & CSS TOKENLARI
    // ==========================================
    lines.push('## 3. $10K TASARIM SİSTEMİ VE CSS TOKENLARI (PIXEL-PERFECT SPEC)');
    lines.push('');
    lines.push('Bu bölüm, sitenin görsel kimliğini oluşturan tüm renkleri, tipografiyi, gölgeleri, kenar yuvarlaklıklarını ve layout kurallarını içerir.');
    lines.push('');

    const colors = result.designTokens?.colors || [];
    const bgColor = colors.find(c => c.role === 'background')?.hex || '#ffffff';

    // 3.1 Renk Paleti ve WCAG Kontrastı
    lines.push('### 3.1 Renk Paleti ve WCAG AA Kontrast Analizi');
    lines.push('');
    if (colors.length === 0) {
      lines.push('_Renk tokenları çıkarılamadı._');
    } else {
      lines.push(`> **Ana Arka Plan Referansı:** \`${bgColor}\``);
      lines.push('');
      lines.push('| Renk Kodu | Önizleme | RGB | Semantik Rol | Kullanım | Kontrast (Arka Plan) |');
      lines.push('|---|---|---|---|---|---|');
      colors.forEach((c) => {
        const rgb = this.hexToRgb(c.hex);
        const rgbStr = rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : '-';
        const contrast = this.calculateContrast(c.hex, bgColor);
        const contrastBadge = contrast >= 7.0 ? `🌟 %${contrast.toFixed(1)}:1 (AAA)` : contrast >= 4.5 ? `✅ %${contrast.toFixed(1)}:1 (AA)` : `⚠️ %${contrast.toFixed(1)}:1 (Düşük)`;
        lines.push(`| \`${c.hex}\` | \`${c.hex}\` | \`${rgbStr}\` | **${c.role}** | ${c.frequency} kez | ${c.role === 'background' ? '_Referans_' : contrastBadge} |`);
      });
    }
    lines.push('');

    // 3.2 Siteden Çıkarılan Canlı CSS Değişkenleri (:root)
    const liveCssVars = result.designTokens?.cssVariables || {};
    const cssVarKeys = Object.keys(liveCssVars);
    if (cssVarKeys.length > 0) {
      lines.push('### 3.2 Sitenin Canlı CSS Değişkenleri (`:root` / CSS Custom Properties)');
      lines.push(`Sitenin kaynak kodundan doğrudan **${cssVarKeys.length} adet** orijinal CSS değişkeni çıkarıldı:`);
      lines.push('```css');
      lines.push(':root {');
      cssVarKeys.slice(0, 40).forEach(key => {
        lines.push(`  ${key}: ${liveCssVars[key]};`);
      });
      if (cssVarKeys.length > 40) {
        lines.push(`  /* ... ve ${cssVarKeys.length - 40} adet daha CSS değişkeni */`);
      }
      lines.push('}');
      lines.push('```');
      lines.push('');
    }

    // 3.3 Tipografi Hiyerarşisi
    lines.push('### 3.3 Tipografi ve Metin Hiyerarşisi');
    lines.push('');
    const typography = result.designTokens?.typography || [];
    if (typography.length === 0) {
      lines.push('_Tipografi tokenları çıkarılamadı._');
    } else {
      lines.push('| Rol | Font Ailesi | Boyut | Ağırlık (Weight) | Satır Yüksekliği (Line Height) | Harf Aralığı |');
      lines.push('|---|---|---|---|---|---|');
      typography.forEach((t) => {
        lines.push(`| **${t.role}** | \`${t.fontFamily}\` | \`${t.fontSize}\` | \`${t.fontWeight}\` | \`${t.lineHeight}\` | \`${t.letterSpacing || 'normal'}\` |`);
      });
    }
    lines.push('');

    // 3.4 Gölgeler ve Derinlik (Elevation)
    const shadows = result.designTokens?.shadows || [];
    if (shadows.length > 0) {
      lines.push('### 3.4 Derinlik ve Gölge Sistemi (Elevation / Box-Shadow)');
      lines.push('');
      lines.push('| Token Adı | CSS `box-shadow` Değeri |');
      lines.push('|---|---|');
      shadows.forEach((s) => {
        lines.push(`| \`--shadow-${s.name}\` | \`${s.value}\` |`);
      });
      lines.push('');
    }

    // 3.5 Kenar Yuvarlaklıkları (Border Radius) & Cam Efekti (Backdrop Blur)
    const radii = result.designTokens?.radii || [];
    const blurs = result.designTokens?.backdropBlurs || [];
    const gradients = result.designTokens?.gradients || [];
    const containers = result.designTokens?.containerWidths || [];

    lines.push('### 3.5 Kenar Yuvarlaklıkları, Cam Efekti ve Yerleşim Boyutları');
    lines.push('');
    lines.push('- **Kenar Yuvarlaklıkları (Border-Radius):** ' + (radii.length > 0 ? radii.map(r => `\`${r.value}\``).join(', ') : '`0px` (Köşeli)'));
    lines.push('- **Cam / Bulanıklık Efektleri (Backdrop-Filter):** ' + (blurs.length > 0 ? blurs.map(b => `\`${b}\``).join(', ') : '_Yok_'));
    lines.push('- **Gradyanlar (Gradients):** ' + (gradients.length > 0 ? gradients.map(g => `\`${g}\``).join('; ') : '_Yok_'));
    lines.push('- **Konteyner Genişlikleri (Max-Width):** ' + (containers.length > 0 ? containers.map(c => `\`${c}\``).join(', ') : '`1280px`'));
    lines.push('');

    // ==========================================
    // 4. BİLEŞEN MİMARİSİ VE İSKELE BLUEPRINT
    // ==========================================
    lines.push('## 4. SAYFA BİLEŞEN MİMARİSİ VE İSKELE BLUEPRINT');
    lines.push('');
    lines.push('Bu bölüm, ana sayfadaki büyük fonksiyonel bölümlerin yerleşim modelini, bağlantılarını ve stillerini açıklar.');
    lines.push('');

    const components = result.designTokens?.components || [];
    if (components.length === 0) {
      lines.push('_Bileşen mimarisi ayrıştırılamadı._');
    } else {
      components.forEach((comp, idx) => {
        lines.push(`### 4.${idx + 1} ${comp.name} (\`<${comp.tag}>\`)`);
        lines.push(`- **Yerleşim Modeli:** \`${comp.layout || 'Standart Akış'}\``);
        if (comp.height) lines.push(`- **Yükseklik:** \`${comp.height}\``);
        if (comp.minHeight) lines.push(`- **Minimum Yükseklik:** \`${comp.minHeight}\``);
        if (comp.background) lines.push(`- **Arka Plan Rengi:** \`${comp.background}\``);
        if (comp.border) lines.push(`- **Kenarlık (Border):** \`${comp.border}\``);
        if (comp.backdropFilter) lines.push(`- **Bulanıklık (Backdrop):** \`${comp.backdropFilter}\``);
        if (comp.h1) lines.push(`- **Ana Başlık (H1):** "${comp.h1}"`);
        if (comp.subhead) lines.push(`- **Alt Başlık / Açıklama:** "${comp.subhead}"`);

        if (comp.links && comp.links.length > 0) {
          lines.push(`- **Tespit Edilen Menü Linkleri (${comp.links.length}):**`);
          comp.links.forEach(l => {
            lines.push(`  - \`${l.text}\` -> \`${l.href || '#'}\``);
          });
        }

        if (comp.ctas && comp.ctas.length > 0) {
          lines.push(`- **Aksiyon Butonları (CTAs):** ${comp.ctas.map(c => `\`[${c}]\``).join(', ')}`);
        }
        lines.push('');
      });
    }

    // ==========================================
    // 5. KULLANIMA HAZIR REPLICA KOD ŞABLONLARI
    // ==========================================
    lines.push('## 5. BİREBİR AYNISINI OLUŞTURMAK İÇİN HAZIR KOD ŞABLONLARI');
    lines.push('');
    lines.push('Aşağıdaki kod blokları, projenizin ilgili dosyalarına **doğrudan yapıştırılmaya hazırdır**:');
    lines.push('');

    // 5.1 globals.css
    lines.push('### 5.1 `src/styles/globals.css` (CSS Değişkenleri ve Reset)');
    lines.push('```css');
    lines.push('@tailwind base;');
    lines.push('@tailwind components;');
    lines.push('@tailwind utilities;');
    lines.push('');
    lines.push(':root {');
    colors.slice(0, 10).forEach((c, i) => {
      lines.push(`  --color-${c.role}-${i + 1}: ${c.hex};`);
    });
    const primaryFont = result.designTokens?.typography?.[0]?.fontFamily || 'Inter, sans-serif';
    lines.push(`  --font-sans: ${primaryFont};`);
    lines.push('  --font-mono: "JetBrains Mono", monospace;');
    shadows.forEach(s => {
      lines.push(`  --shadow-${s.name}: ${s.value};`);
    });
    lines.push('}');
    lines.push('');
    lines.push('body {');
    lines.push(`  background-color: ${bgColor};`);
    lines.push(`  color: ${colors.find(c => c.role === 'foreground')?.hex || '#ffffff'};`);
    lines.push(`  font-family: var(--font-sans);`);
    lines.push('}');
    lines.push('```');
    lines.push('');

    // 5.2 tailwind.config.js
    lines.push('### 5.2 `tailwind.config.js` Konfigürasyonu');
    lines.push('```javascript');
    lines.push('/** @type {import(\'tailwindcss\').Config} */');
    lines.push('module.exports = {');
    lines.push('  content: ["./src/**/*.{js,ts,jsx,tsx}"],');
    lines.push('  theme: {');
    lines.push('    extend: {');
    lines.push('      colors: {');
    colors.slice(0, 8).forEach((c, i) => {
      lines.push(`        'site-${c.role}-${i + 1}': '${c.hex}',`);
    });
    lines.push('      },');
    lines.push('      fontFamily: {');
    lines.push(`        sans: ['${primaryFont.split(',')[0].replace(/['"]/g, '').trim()}', 'sans-serif'],`);
    lines.push('      },');
    if (shadows.length > 0) {
      lines.push('      boxShadow: {');
      shadows.slice(0, 4).forEach(s => {
        lines.push(`        '${s.name}': '${s.value}',`);
      });
      lines.push('      },');
    }
    lines.push('    },');
    lines.push('  },');
    lines.push('  plugins: [],');
    lines.push('};');
    lines.push('```');
    lines.push('');

    // 5.3 Navbar.tsx
    const navComp = components.find(c => c.name.includes('Navbar'));
    lines.push('### 5.3 `src/components/Navbar.tsx` (Birebir Arayüz Kodu)');
    lines.push('```tsx');
    lines.push('import React from \'react\';');
    lines.push('');
    lines.push('export const Navbar: React.FC = () => {');
    lines.push('  return (');
    lines.push('    <header className="sticky top-0 z-50 w-full backdrop-blur-md border-b border-white/[0.08] px-6 py-3.5 flex items-center justify-between">');
    lines.push('      {/* Logo */}');
    lines.push('      <div className="flex items-center gap-2 font-bold text-lg text-white">');
    lines.push(`        <span>${domain}</span>`);
    lines.push('      </div>');
    lines.push('');
    lines.push('      {/* Menü Linkleri */}');
    lines.push('      <nav className="hidden md:flex items-center gap-6 text-sm text-neutral-300">');
    if (navComp && navComp.links && navComp.links.length > 0) {
      navComp.links.forEach(l => {
        lines.push(`        <a href="${l.href || '#'}" className="hover:text-white transition-colors">${l.text}</a>`);
      });
    } else {
      lines.push('        <a href="#features" className="hover:text-white transition-colors">Özellikler</a>');
      lines.push('        <a href="#docs" className="hover:text-white transition-colors">Dokümantasyon</a>');
      lines.push('        <a href="#pricing" className="hover:text-white transition-colors">Fiyatlandırma</a>');
    }
    lines.push('      </nav>');
    lines.push('');
    lines.push('      {/* Aksiyon Butonları (CTAs) */}');
    lines.push('      <div className="flex items-center gap-3">');
    if (navComp && navComp.ctas && navComp.ctas.length > 0) {
      navComp.ctas.forEach(cta => {
        lines.push(`        <button className="px-4 py-2 bg-white text-black font-semibold text-sm rounded-lg hover:bg-neutral-200 transition-all">${cta}</button>`);
      });
    } else {
      lines.push('        <button className="px-4 py-2 bg-white text-black font-semibold text-sm rounded-lg hover:bg-neutral-200 transition-all">Giriş Yap</button>');
    }
    lines.push('      </div>');
    lines.push('    </header>');
    lines.push('  );');
    lines.push('};');
    lines.push('```');
    lines.push('');

    // 5.4 Hero.tsx
    const heroComp = components.find(c => c.name.includes('Hero'));
    lines.push('### 5.4 `src/components/Hero.tsx` (Hero Bölümü Kodu)');
    lines.push('```tsx');
    lines.push('import React from \'react\';');
    lines.push('');
    lines.push('export const Hero: React.FC = () => {');
    lines.push('  return (');
    lines.push('    <section className="relative min-h-[70vh] flex flex-col items-center justify-center text-center px-4 py-20 max-w-5xl mx-auto">');
    lines.push(`      <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6">`);
    lines.push(`        ${heroComp?.h1 || result.meta?.title || 'Modern Web Çözümleri'}`);
    lines.push('      </h1>');
    lines.push(`      <p className="text-lg sm:text-xl text-neutral-400 max-w-2xl mb-10 leading-relaxed">`);
    lines.push(`        ${heroComp?.subhead || result.meta?.description || 'Hedef web uygulamasının modern arayüz ve mimari replikası.'}`);
    lines.push('      </p>');
    lines.push('      <div className="flex items-center gap-4 flex-wrap justify-center">');
    if (heroComp && heroComp.ctas && heroComp.ctas.length > 0) {
      heroComp.ctas.forEach((cta, i) => {
        lines.push(`        <button className="px-6 py-3 ${i === 0 ? 'bg-white text-black' : 'bg-white/10 text-white border border-white/20'} font-bold rounded-xl hover:scale-105 transition-all">${cta}</button>`);
      });
    } else {
      lines.push('        <button className="px-6 py-3 bg-white text-black font-bold rounded-xl hover:scale-105 transition-all">Hemen Başlayın</button>');
      lines.push('        <button className="px-6 py-3 bg-white/10 text-white border border-white/20 font-bold rounded-xl hover:bg-white/20 transition-all">Dokümantasyon</button>');
    }
    lines.push('      </div>');
    lines.push('    </section>');
    lines.push('  );');
    lines.push('};');
    lines.push('```');
    lines.push('');

    // ==========================================
    // 6. SİTE HARİTASI VE SAYFA TOPOLOJİSİ
    // ==========================================
    lines.push('## 6. SİTE HARİTASI VE SAYFA TOPOLOJİSİ');
    lines.push('');
    lines.push('### 6.1 Hiyerarşik Sayfa Ağacı (ASCII Tree)');
    lines.push('```text');
    if (result.siteMap) {
      lines.push(domain);
      this.buildAsciiTree(result.siteMap, '', true, lines);
    } else {
      lines.push('Sayfa ağacı verisi bulunamadı.');
    }
    lines.push('```');
    lines.push('');

    // 6.2 Düz Sayfa Listesi ve Rota Tablosu
    lines.push('### 6.2 Keşfedilen Rotalar ve Sayfa Detayları');
    lines.push('');
    const flatPages = this.flattenSiteMap(result.siteMap);
    lines.push(`Toplam **${flatPages.length}** adet benzersiz rota keşfedildi:`);
    lines.push('');
    lines.push('| # | Sayfa Yolu / URL | Başlık | Derinlik | HTTP Durumu | Varlık Sayısı |');
    lines.push('|---|---|---|---|---|---|');
    flatPages.slice(0, 50).forEach((p, idx) => {
      let pathName = p.url;
      try {
        pathName = new URL(p.url).pathname || '/';
      } catch {}
      const titleStr = p.title ? `\`${this.escapeMd(p.title.slice(0, 30))}\`` : '-';
      const statusStr = p.statusCode ? `\`${p.statusCode}\`` : '`200`';
      const assetCountStr = p.assetCount !== undefined ? `${p.assetCount}` : '-';
      lines.push(`| ${idx + 1} | \`${pathName}\` | ${titleStr} | \`${p.depth}\` | ${statusStr} | ${assetCountStr} |`);
    });
    if (flatPages.length > 50) {
      lines.push(`| ... | _(${flatPages.length - 50} rota daha var)_ | ... | ... | ... | ... |`);
    }
    lines.push('');

    // ==========================================
    // 7. GÜVENLİK VE PROTOKOL PROFİLİ
    // ==========================================
    lines.push('## 7. GÜVENLİK VE PROTOKOL PROFİLİ');
    lines.push('');
    lines.push('| Güvenlik Parametresi | Durum | Açıklama |');
    lines.push('|---|---|---|');
    lines.push(`| **HTTPS Şifrelemesi** | ${result.security?.https ? '✅ Aktif' : '❌ Pasif'} | ${result.security?.https ? 'Trafik TLS/SSL ile korunuyor.' : 'Bağlantı şifresiz HTTP üzerinden.'} |`);
    lines.push(`| **HSTS (Strict Transport Security)** | ${result.security?.hsts ? '✅ Aktif' : '⚠️ Yok'} | ${result.security?.hsts ? 'Tarayıcının yalnızca HTTPS ile bağlanması zorunlu.' : 'HSTS başlığı tespit edilemedi.'} |`);
    lines.push(`| **CSP (Content Security Policy)** | ${result.security?.csp ? '✅ Yapılandırılmış' : '⚠️ Yok'} | ${result.security?.csp ? 'XSS ve veri sızdırma kalkanı mevcut.' : 'İçerik güvenlik politikası başlığı bulunamadı.'} |`);
    lines.push(`| **robots.txt Arama Motoru İzni** | ${result.security?.robotsTxt ? '✅ Açık' : 'ℹ️ Yok'} | ${result.security?.robotsTxt ? 'Bot yönlendirmeleri tanımlanmış.' : 'Varsayılan bot politikası geçerli.'} |`);
    lines.push('');

    // ==========================================
    // 8. TEKNİK ŞARTNAME VE YENİDEN İNŞA REHBERİ
    // ==========================================
    lines.push('## 8. MASTER TEKNİK ŞARTNAME VE YENİDEN İNŞA REHBERİ');
    lines.push('');
    lines.push('Aşağıdaki teknik şartnameyi kullanarak projenin piksel piksel birebir çalışan tam bir kopyasını modern React / Next.js yığınında sıfırdan inşa edebilirsiniz:');
    lines.push('');
    lines.push('```markdown');
    lines.push(`Sen kıdemli bir Sistem Mimarı ve Frontend Uzmanısın. Görevin, \`${domain}\` web sitesinin piksel piksel aynısını sıfırdan inşa etmektir.`);
    lines.push('');
    lines.push('AŞAĞIDAKİ MİMARİ VE TASARIM ŞARTNAMESİNE BİREBİR UY:');
    lines.push('');
    lines.push('1. TEKNOLOJİ YIĞINI:');
    lines.push('   - Framework: React 19 / Next.js (App Router) veya Vite');
    lines.push('   - Stil: Tailwind CSS');
    lines.push('   - İkonlar: Lucide React (veya inline SVG)');
    lines.push('');
    lines.push('2. RENK PALETİ:');
    lines.push(`   - Arka Plan (Canvas): ${bgColor}`);
    colors.slice(0, 6).forEach(c => {
      lines.push(`   - ${c.role.toUpperCase()}: ${c.hex}`);
    });
    lines.push('');
    lines.push('3. TİPOGRAFİ:');
    lines.push(`   - Birincil Font: ${primaryFont}`);
    lines.push('   - Başlık Ağırlığı: 700 / 800 (Bold / Extrabold)');
    lines.push('');
    lines.push('4. BİLEŞENLER:');
    if (navComp) {
      lines.push(`   - Navbar: ${navComp.height || '60px'} yükseklik, backdrop-blur, ${navComp.links?.map(l => l.text).join(', ') || 'linkler'}`);
    }
    if (heroComp) {
      lines.push(`   - Hero Section: H1 "${heroComp.h1 || result.meta?.title || 'Başlık'}", alt başlık, aksiyon butonları: ${heroComp.ctas?.join(', ') || 'Başla'}`);
    }
    lines.push('');
    lines.push('5. ROTALAR:');
    flatPages.slice(0, 8).forEach(p => {
      let r = p.url;
      try { r = new URL(p.url).pathname; } catch {}
      lines.push(`   - ${r} -> ${p.title || 'Sayfa'}`);
    });
    lines.push('```');
    lines.push('');

    lines.push('---');
    lines.push(`_Bu rapor **WebClone Studio** tarafından ${formattedDate} tarihinde otomatik olarak oluşturulmuştur._`);

    return lines.join('\n');
  }

  /**
   * Site haritasını ASCII ağaç formatında oluşturur.
   */
  private static buildAsciiTree(node: SiteMapNode, prefix: string, isLast: boolean, lines: string[]): void {
    if (!node) return;

    let path = node.url;
    try {
      path = new URL(node.url).pathname || '/';
    } catch {}

    const connector = isLast ? '└── ' : '├── ';
    lines.push(`${prefix}${connector}${path}${node.title ? ` (${node.title})` : ''}`);

    const children = node.children || [];
    const newPrefix = prefix + (isLast ? '    ' : '│   ');

    children.forEach((child, index) => {
      const childIsLast = index === children.length - 1;
      this.buildAsciiTree(child, newPrefix, childIsLast, lines);
    });
  }

  /**
   * SiteMapNode ağacını düz diziye dönüştürür.
   */
  private static flattenSiteMap(root: SiteMapNode): SiteMapNode[] {
    const result: SiteMapNode[] = [];
    const visited = new Set<string>();

    function traverse(node: SiteMapNode) {
      if (!node || !node.url || visited.has(node.url)) return;
      visited.add(node.url);
      result.push(node);
      if (node.children) {
        node.children.forEach(traverse);
      }
    }

    if (root) traverse(root);
    return result;
  }

  /**
   * HEX kodunu RGB objesine çevirir.
   */
  private static hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
      return {
        r: parseInt(cleanHex[0] + cleanHex[0], 16),
        g: parseInt(cleanHex[1] + cleanHex[1], 16),
        b: parseInt(cleanHex[2] + cleanHex[2], 16),
      };
    }
    if (cleanHex.length === 6) {
      return {
        r: parseInt(cleanHex.slice(0, 2), 16),
        g: parseInt(cleanHex.slice(2, 4), 16),
        b: parseInt(cleanHex.slice(4, 6), 16),
      };
    }
    return null;
  }

  /**
   * İki HEX renk arasındaki WCAG 2.1 kontrast oranını hesaplar (1.0 ile 21.0 arası).
   */
  private static calculateContrast(hex1: string, hex2: string): number {
    const rgb1 = this.hexToRgb(hex1);
    const rgb2 = this.hexToRgb(hex2);
    if (!rgb1 || !rgb2) return 1.0;

    const lum1 = this.calculateLuminance(rgb1.r, rgb1.g, rgb1.b);
    const lum2 = this.calculateLuminance(rgb2.r, rgb2.g, rgb2.b);

    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);

    return (brightest + 0.05) / (darkest + 0.05);
  }

  /**
   * Bağıl parlaklık (Relative luminance) formülü.
   */
  private static calculateLuminance(r: number, g: number, b: number): number {
    const [rs, gs, bs] = [r, g, b].map(c => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  /**
   * Markdown tablosu bozabilecek karakterleri temizler.
   */
  private static escapeMd(str: string): string {
    return str.replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
  }
}
