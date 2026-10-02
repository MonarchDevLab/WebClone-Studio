# HANDOFF

## Anlık Durum
"Ultimate Web Clone" planı (Aşama 1-5) tam başarıyla uygulandı ve proje Ouroboros protokolü kapsamında tamamlandı.
1. **Ultimate Özellikler:**
   - **Stealth Evasion:** Cloudflare/Bot korumalarını aşmak için CDP `Page.addScriptToEvaluateOnNewDocument` ile `navigator.webdriver` ve özellik manipülasyonu sağlandı.
   - **Infinite Scroll:** Dinamik yüklenen içerikler (lazy-load) için native Chromium auto-scroll (aşağı/yukarı) entegre edildi.
   - **Shadow DOM Piercing:** Web components ve shadow-root kullanan modern siteler için DOM ayrıştırma algoritması Chromium `getInnerHTML` API'si ile derinlemesine delindi.
   - **Structured Data & React Export:** Sayfadaki liste/grid yapıları (Cheerio ile) analiz edilip `_meta/structured-data.json` olarak çıkartılıyor; temizlenmiş HTML yapısı `_components/` altında kullanıma hazır React `.tsx` bileşenlerine dönüştürülüyor.
   - **Obfuscation Bypass:** İndirilen `.js` dosyalarındaki (Webpack/Vite chunk'ları vb.) gizli asset uzantıları (`.woff2`, `.png`, `.json` vb.) regex ve AST analiziyle bulunup crawler kuyruğuna otomatik ekleniyor.
2. **Güvenlik:** ReDoS açığı `escapeWildcardToRegExp` ile kapatıldı, IPC kanal beyaz listesi zırhlandı, Chromium sandbox aktifleştirildi, preview server null-byte injection koruması eklendi, HTML/CSS rapor üreticisine sanitizasyon (`safeHex`, `safeCssValue`, `escapeHtml`) eklendi.
3. **Bellek & Performans:** Crawler queue O(1) pointer tabanlı dequeue'ya çevrildi, IPC handler aktif iş havuzu temizliği yapıldı, Zustand clone-store array operasyonları optimize edildi, SiteMapPage ağaç yapısı lazy-expand ile hafifletildi, EBUSY dosya kilitlenmeleri çözüldü.
4. **Mimari & Sağlamlık:** XML sitemap `xmlMode: true` ile Cheerio üzerinden parse edildi, asenkron I/O ve atomik dosya yazımı (`.tmp`) uygulandı, CSS hash temizliği ve harici protokol izolasyonu yapıldı.
5. **Portable Paket:** Güncel kodlarla taşınabilir paket (`dist/WebClone-Studio-Portable.exe`, ~77MB) tamamen bağımsız (Playwright/Puppeteer vb. gerektirmeyen) native Electron altyapısıyla 0 hata ile derlenmeye hazır.
6. **Eksiksiz İndirme & Hibrit SPA Kurtarma:** Statik modda çekilen sayfalar boş React/Vue/Next iskeletiyse otomatik Chromium render motoru devreye sokuluyor, geçersiz/süresi dolmuş SSL sertifikaları için tolerans sağlandı.

## Kritik Komutlar
- Development: `npm run dev`
- Test: `npm test`
- Build (Production): `npm run build`
- Build (Portable): `npm run build:portable`
- Check & Lint: `npm run typecheck`
- Clean: `rm -rf dist release node_modules out`

## Commit Zinciri
- **Son Commit:** `6f1fa25` feat(cloner): implement Obfuscation Bypass to extract hidden fonts and assets from JS chunks
- **Önceki Commitler:**
  - `96041df` feat(cloner): implement HTML to React TSX component export
  - `7df194c` feat(cloner): extract structured JSON data from grid/list layouts
  - `b02fc68` feat(crawler): implement deep shadow dom piercing using getInnerHTML
  - `4b13a7b` feat(evasion): add infinite scroll and stealth bot evasion scripts

## Riskler
- Yok.
