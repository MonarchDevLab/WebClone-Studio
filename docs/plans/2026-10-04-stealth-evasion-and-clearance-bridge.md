# Stealth Evasion, Clearance Bridge & Adaptive Extractor — Uygulama Planı

Hedef: Scrapling framework'ünün öne çıkan anti-bot stealth atlatma, tarayıcı-indirme oturum (clearance) senkronizasyonu ve self-healing adaptif içerik analizi kabiliyetlerini sıfır Python bağımlılığı ve sıfır harici paket maliyetiyle yerel TypeScript/Electron motoruna kazandırmak.
Tasarım: [docs/SYSTEM_MAP.md](docs/SYSTEM_MAP.md)
Yığın: TypeScript 5.8, Electron 33 (CDP), Node.js 22, Got 14, Cheerio 1.0, Vitest
Yürütme: Kendin (Bölüm B)

## Genel kısıtlar
- Projeye kesinlikle Python runtime veya harici ağır binary bağımlılıkları eklenmeyecektir; 73MB portable boyutu korunacaktır.
- Mevcut hiçbir test kırılmayacak, `npm run typecheck` ve `npm test` %100 temiz kalacaktır.
- Tüm loglama ve IPC akışları mevcut mimari standartlarına (`emitLog`, `emitProgress`) tam uyumlu olacaktır.
- Değişiklikler atomik ve geri döndürülebilir adımlarla işletilecektir.

## İnceleme odağı
- `Page.addScriptToEvaluateOnNewDocument` içine enjekte edilen scriptlerin web sayfalarındaki gerçek JavaScript context'ini bozmaması (prototype pollution veya unhandled exception yaşanmaması).
- Cloudflare Turnstile ve DataDome'un tespit ettiği `outerWidth: 0`, `screen.availWidth` ve `navigator.permissions` tutarsızlıklarının gerçekçi masaüstü değerleriyle maskelenmesi.
- Chromium'dan hasat edilen `cf_clearance` ve `__cf_bm` çerezlerinin `AssetDownloader` HTTP/2 ve HTTP/1.1 başlıklarına domain bazlı doğru enjekte edilmesi.
- WAF 403/503 meydan okuma sayfalarının (challenge) sonsuz döngüye girmeden azami 1 kez dinamik render motoruna eskalasyon yapması.
- Obfuscate/hash sınıflı (Tailwind, CSS Modules) DOM ağaçlarında adaptif skorlama fonksiyonunun boş sonuç dönmeden en baskın semantik blokları yakalaması.

## Dosya haritası
- `src/main/browser/stealth-scripts.ts`: Ultra-Stealth CDP enjeksiyon betiklerinin ve profil maskeleme üretecinin yer aldığı yeni modül.
- `src/main/browser/page-renderer.ts`: CDP stealth entegrasyonu ve oturum çerezlerini (`session.cookies` / CDP) dışa aktarma yeteneği.
- `src/main/cloner/asset-downloader.ts`: Çerez havuzu (Cookie Jar / session headers) desteği ve HTTP/2 header uyumu.
- `src/main/cloner/crawler-engine.ts`: WAF/Cloudflare tespit mantığı, dinamik eskalasyon ve çerez köprüsünün bağlanması.
- `src/main/analyzers/adaptive-extractor.ts`: Sınıf isimlerinden bağımsız semantik içerik ve sayfalama tetikleyicisi bulan adaptif analiz motoru.
- `tests/main/browser/stealth-scripts.test.ts`: Stealth script doğruluğu ve format testleri.
- `tests/main/cloner/clearance-bridge.test.ts`: Çerez senkronizasyonu ve WAF tespit testleri.
- `tests/main/analyzers/adaptive-extractor.test.ts`: Adaptif semantik çıkarım birim testleri.

## Defter
- Ön kontrol: Paylaşılan arayüzler `page-renderer.ts` -> `crawler-engine.ts` -> `asset-downloader.ts` ve `adaptive-extractor.ts`.

---

### Görev 1: Ultra-Stealth CDP Enjeksiyon Motoru (`stealth-scripts.ts`)
Dosyalar: oluştur `src/main/browser/stealth-scripts.ts` · test `tests/main/browser/stealth-scripts.test.ts`
Arayüz: üretir `generateStealthScript(): string`
- [ ] 1. Başarısız test — `generateStealthScript()` çıktısında `webdriver`, `chrome.runtime`, `WebGLRenderingContext`, `permissions.query`, `outerWidth` ve `AudioContext` maskeleme bloklarının bulunduğunu doğrulayan test.
- [ ] 2. Koş: `npm test tests/main/browser/stealth-scripts.test.ts` — Beklenen: FAIL, modül bulunamadı.
- [ ] 3. Minimum uygulama — `src/main/browser/stealth-scripts.ts` dosyasını oluştur; prototype-clean descriptor tanımları, sahte donanım ivmelendirme (NVIDIA/Intel), gerçekçi pencere ölçüleri ve canvas/audio mikro-gürültü enjeksiyonunu sağla.
- [ ] 4. Koş: `npm test tests/main/browser/stealth-scripts.test.ts` — Beklenen: PASS.
- [ ] 5. Commit: `feat(stealth): implement ultra-stealth cdp script generator`
Geri dönüş: commit'i geri al.

---

### Görev 2: PageRenderer Stealth & Çerez İhracatı Entegrasyonu
Dosyalar: değiştir `src/main/browser/page-renderer.ts`
Arayüz: tüketir `generateStealthScript()` · üretir `PageRenderResult.cookies: Array<{ name: string; value: string; domain: string; path: string }>`
- [ ] 1. Başarısız test — `page-renderer.ts` içinde `generateStealthScript()` kullanımını ve render çıktısında `cookies` dizisinin döndüğünü doğrulayan test.
- [ ] 2. Koş: `npm run typecheck` — Beklenen: FAIL / Type hatası (`cookies` alanı eksik).
- [ ] 3. Minimum uygulama — `page-renderer.ts` içerisindeki ilkel stealth bloğunu `generateStealthScript()` ile değiştir. Render tamamlandığında `win.webContents.session.cookies.get({ url })` ile oturum çerezlerini topla ve `PageRenderResult` ile döndür.
- [ ] 4. Koş: `npm run typecheck && npm test` — Beklenen: PASS.
- [ ] 5. Commit: `feat(renderer): integrate ultra-stealth scripts and harvest session cookies`
Geri dönüş: commit'i geri al.

---

### Görev 3: AssetDownloader Çerez Deposu ve Clearance Senkronizasyonu
Dosyalar: değiştir `src/main/cloner/asset-downloader.ts` · test `tests/main/cloner/clearance-bridge.test.ts`
Arayüz: üretir `setCookies(cookies: Array<{ name: string; value: string }>): void`, `getCookieHeader(url: string): string`
- [ ] 1. Başarısız test — `AssetDownloader`'a çerez set edildiğinde `getBrowserHeaders()` çıktısına `cookie` başlığının formatlanarak eklendiğini doğrulayan birim test.
- [ ] 2. Koş: `npm test tests/main/cloner/clearance-bridge.test.ts` — Beklenen: FAIL.
- [ ] 3. Minimum uygulama — `AssetDownloader` sınıfına `setCookies` ve çerez ayrıştırma mantığını ekle; `getBrowserHeaders` içinde ilgili hedefe ait çerezleri `Cookie: name=val; ...` başlığı olarak iliştir.
- [ ] 4. Koş: `npm test tests/main/cloner/clearance-bridge.test.ts` — Beklenen: PASS.
- [ ] 5. Commit: `feat(cloner): add cookie jar and clearance bridge to asset downloader`
Geri dönüş: commit'i geri al.

---

### Görev 4: CrawlerEngine Otomatik WAF Eskalasyonu ve Çerez Köprüsü
Dosyalar: değiştir `src/main/cloner/crawler-engine.ts`
Arayüz: tüketir `PageRenderResult.cookies`, `AssetDownloader.setCookies`
- [ ] 1. Başarısız test — `crawler-engine` içinde Cloudflare/WAF 403/503 engeli tespit edildiğinde dinamik Chromium motoruna eskalasyon tetikleme ve dönen çerezleri downloader'a aktarma simülasyonu.
- [ ] 2. Koş: `npm test tests/main/cloner/clearance-bridge.test.ts` — Beklenen: FAIL.
- [ ] 3. Minimum uygulama — `crawler-engine.ts` içerisine `isWafChallenge(statusCode, htmlStr, headers)` kontrolü ekle. Statik indirme engellendiğinde otomatik dinamik render başlat, `rendered.cookies` varsa `this.downloader.setCookies(rendered.cookies)` ile senkronize et ve akışı kesintisiz sürdür.
- [ ] 4. Koş: `npm test tests/main/cloner/clearance-bridge.test.ts && npm run typecheck` — Beklenen: PASS.
- [ ] 5. Commit: `feat(crawler): implement automatic waf escalation and clearance synchronization`
Geri dönüş: commit'i geri al.

---

### Görev 5: Self-Healing / Adaptif Semantik İçerik Çıkarıcı (`adaptive-extractor.ts`)
Dosyalar: oluştur `src/main/analyzers/adaptive-extractor.ts` · test `tests/main/analyzers/adaptive-extractor.test.ts` · değiştir `src/main/cloner/crawler-engine.ts`
Arayüz: üretir `AdaptiveExtractor.extract(html: string, url: string): AdaptiveExtractionResult`
- [ ] 1. Başarısız test — Obfuscate sınıflara sahip HTML örneğinde ana içerik bloğunu, tekrarlayan veri kartlarını ve sayfalama/yükleme tetikleyicilerini bulan test.
- [ ] 2. Koş: `npm test tests/main/analyzers/adaptive-extractor.test.ts` — Beklenen: FAIL.
- [ ] 3. Minimum uygulama — `src/main/analyzers/adaptive-extractor.ts` dosyasını oluştur; metin/tag yoğunluğu, sibling örüntüsü ve ARIA/role tabanlı self-healing heuristiğini yaz. Reverse engineering aşamasında `_meta/adaptive-entities.json` olarak diske kaydet.
- [ ] 4. Koş: `npm test tests/main/analyzers/adaptive-extractor.test.ts && npm test` — Beklenen: PASS.
- [ ] 5. Commit: `feat(analyzers): add self-healing adaptive semantic extractor`
Geri dönüş: commit'i geri al.

---

### Görev 6: Uçtan Uca Doğrulama, Dokümantasyon ve Paket Testi
Dosyalar: değiştir `docs/HANDOFF.md`, `docs/TASKS.md`, `docs/WORKLOG.md`, `docs/SYSTEM_MAP.md`
- [ ] 1. `npm test` ile tüm birim ve entegrasyon testlerinin eksiksiz geçtiğini doğrula.
- [ ] 2. `npm run typecheck` ile tip güvenliğini doğrula.
- [ ] 3. `npm run build` ile production build'in hatasız derlendiğini doğrula.
- [ ] 4. `docs/` altındaki hafıza dosyalarını güncelle.
- [ ] 5. Commit: `chore(system): verify stealth and clearance bridge integration, update docs`
Geri dönüş: commit'i geri al.
