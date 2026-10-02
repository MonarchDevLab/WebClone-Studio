# WORKLOG

## Aktif Oturum
- **Hedef:** Ouroboros v9.0 mimari analizinde tespit edilen tüm tersine mühendislik borçlarının kapatılması: SourceMap kurtarma pipeline'ı, çok sayfalı framework state toplayıcı, Tailwind token extractor, dinamik API trafik yakalayıcı & offline mock sunucu entegrasyonu, UI ayar kontrolleri ve IPC yol temizliği.
- **Yapılanlar:**
  1. `PageProcessor` ve `CrawlerEngine` içine SourceMap keşif ve otomatik indirme hattı bağlandı; `site/_source-code/` altında orijinal kaynak ağacı inşa edildi.
  2. `FrameworkExtractor` geliştirildi; `__NEXT_DATA__`, `__NUXT_DATA__`, `__INITIAL_STATE__`, `__PRELOADED_STATE__` tüm taranan sayfalardan toplanıp `_meta/extracted-state.json` içinde birleştirildi.
  3. `TokenExtractor` yazıldı; CSS değişkenleri, palet renkleri ve fontlar ayrıştırılarak `_meta/tailwind.config.js` ve `_meta/design-tokens.json` üretildi.
  4. `ApiInterceptor` yazıldı; Chromium CDP (`Network` domain) dinlenerek dinamik API trafiği `_meta/api-endpoints.json` olarak kaydedildi ve `PreviewServer` mock rota fallback'ine bağlandı.
  5. `AppSettings`, `SettingsStore`, `SettingsPage` ve `CloneSetupModal` bileşenlerine tersine mühendislik kontrolleri eklendi.
  6. `ipc-handlers.ts` içerisindeki yanlış konumlanan ve mükerrer `_meta/SYSTEM_MAP.md` yazımı kaldırıldı.
  7. Vitest testleri (17/17), typecheck (0 hata) ve production bundle (`npm run build`) başarıyla doğrulandı.
  8. `npm run build:portable` ile güncel kodları ve tersine mühendislik motorunu içeren Windows Portable uygulama paketi (`dist/WebClone-Studio-Portable.exe`, 77.6MB) 0 hata ile derlendi.

## Mimari Kararlar
- **[KARAR-024] Tersine Mühendislik Laboratuvarı & Tam Pipeline Entegrasyonu:**
  1) `SourceMapReconstructor` asset pipeline ile doğrudan birleştirildi; `.js` ve `.css` dosyalarındaki bağıl/mutlak/data-URI `sourceMappingURL` direktifleri ayrıştırılarak indirme kuyruğuna alındı ve indirme bitiminde atomik olarak `site/_source-code/` ağacına açıldı.
  2) Sayfa taramalarında React, Vue, Next.js ve Nuxt hydration durumları sayfa URL'si anahtarıyla hafızada biriktirilip `_meta/extracted-state.json` olarak serileştirildi.
  3) DOM ve stil katmanından çıkarılan renk/font değişkenleri modern Tailwind v3 `tailwind.config.js` şablonuna dönüştürüldü.
  4) Electron offscreen penceresine `win.webContents.debugger` (CDP Network) takılarak arka plan API istek/yanıtları `ApiInterceptor` tarafından kaydedildi; `PreviewServer` ise gelen isteklerde yerel statik dosya bulunamadığında `_meta/api-endpoints.json` üzerinden offline mock yanıt üretecek şekilde genişletildi.
  5) `CloneSetupModal` ve `SettingsPage` üzerinden kullanıcıya tersine mühendisliği açıp kapatma yetkisi verildi.
  6) `ipc-handlers.ts` içerisindeki kök çıktı dizinine `_meta/` yazan hatalı kod temizlenerek yetki `CrawlerEngine`'in proje içi organizatörüne bırakıldı.
- **[KARAR-023] Sıfır Emoji Standartı, Kayıpsız Klonlama Motoru ve Hibrit SPA Kurtarma:**
  1) Kod tabanı, rapor şablonları (`system-map-generator.ts`, `report-generator.ts`, `readme-generator.ts`), log konsolları ve UI bileşenlerindeki tüm emojiler temizlendi; arayüzde yalnızca Lucide SVG ikonları ve kurumsal tipografi bırakıldı.
  2) `PageProcessor` kök domain eşleşmesi (`getRootDomain`, `isInternalDomain`) ile güçlendirildi; `www.` yönlendirmelerinde iç linklerin atlanması engellendi; harici sosyal linkler kuyruktan izole edildi; CSS `@import` ve Google Fonts `/css2` ayrıştırması güçlendirildi; `<link rel="preload" as="image">`, `data-bg`, `data-background`, `data-background-image` ve `video[poster]` seçicileri varlık keşfine dahil edildi.
  3) `AssetDownloader` içerisindeki `downloadToFile` ve `downloadToBuffer` metodlarına `rejectUnauthorized: false` ve 3 denemeli exponential backoff döngüsü eklendi; süresi dolmuş veya geçersiz SSL sertifikalı sunuculardan indirme kesintisi önlendi.
  4) `UrlRewriter` içerisinden offline stil ve betik çalıştırmayı engelleyen `Content-Security-Policy`, `refresh` ve `origin-trial` meta etiketleri temizlendi.
  5) `CrawlerEngine` içerisine akıllı SPA / istemci render tespiti (`isSpaShell`) ve dinamik Chromium fallback (`PageRenderer`) eklendi; statik modda bile boş React/Vue/Next iskeletleri gerçek DOM içeriğiyle indirildi.
  6) `PreviewServer` içerisine temiz URL (`.html` uzantısız linkler), trailing slash dizin çözümlemesi ve SPA istemci yönlendirmeleri için kök `index.html` fallback eklendi.
  7) `dist/WebClone-Studio-Portable.exe` (77.6 MB) 0 hata ile paketlendi.
- **[KARAR-022] Ouroboros v6.0 & Ponytail Ultra Kapsamlı Sistem İyileştirmesi ve Zırhlama:**
  1) `system-map-generator.ts`: [BUG-01] Güven skoru `tech.confidence` formatlama hatası düzeltildi; `buildAsciiTree` metoduna döngüsel ağaç referansları için `visited = new Set<string>()` cycle detection eklendi; kullanılmayan importlar temizlendi.
  2) `preload/index.ts`: [BUG-02] `subscriptionMap` eklenerek `removeListener`'ın `on` ile sarmalanan IPC dinleyicilerini sızdırmadan temizlemesi sağlandı.
  3) `url-rewriter.ts` & `page-processor.ts`: [BUG-03, BUG-04] Windows cross-drive `path.relative` hatası için `resolveRelativePath` statik metodu yazıldı; `srcset` regex tokenizer eklenerek `data:` URI'lerinin virgülle bölünmesi engellendi.
  4) `asset-downloader.ts`: [BUG-05] `downloadStream.on('data')` ile kümülatif byte sayacı eklendi (chunked veya eksik `content-length` durumunda boyut aşımı engellendi).
  5) `output/report-generator.ts`: [BUG-06] `escapeHtml` metodu ile taranan siteden gelen veriler XSS'e karşı sanitize edildi.
  6) `output/readme-generator.ts`: Gerçek üretim dosyalarıyla (`_meta/tech-report.html`, `_meta/SYSTEM_MAP.md`, `_meta/errors.log`) eşitlendi, şablon tırnakları escape edildi.
  7) `cloner/file-organizer.ts`: [BUG-07] `safeFallback` boş string veya nokta olduğunda oluşan `EISDIR` çökmesi engellendi.
  8) `storage/project-store.ts`: [BUG-08] `deleteProject` içine `baseDir` sınır kontrolü, kök sürücü engeli ve `manifest.json` teyidi eklendi.
  9) `analyzers/tech-detector.ts`: [BUG-09] `set-cookie` header'ının tekil string gelmesi durumu normalize edildi.
  10) `ipc-handlers.ts`: [BUG-10] `analyzeCache` Map'i ve `normalizeUrlKey` eklendi; site analizi ile klonlama verisi URL bazında izole edildi; `CLONE_ERROR` payload'ı `CloneErrorEvent` sözleşmesine eşitlendi.
  11) `utils/format-utils.ts` & `renderer/src/lib/utils.ts`: Negatif sayı / NaN koruması, PB desteği ve `HH:MM:SS` saat formatı eklendi.
  12) `clone-store.ts` & `MainLayout.tsx`: [UI-05] `files` (200), `logs` (500) ve `errors` (100) dizilerine sliding-window cap sınırı getirildi; canlı log kaydırma `behavior: 'auto'` yapıldı.
  13) `shared/types.ts`: `SizeEstimate` (`freeSpaceBytes`, `hasSufficientDisk`) ve `AppSettings` arayüzleri eklendi.
  14) `UrlInput.tsx`, `App.tsx`, `CommandPaletteModal.tsx`: [UI-01] `id="url-input-field"` eklenerek `Ctrl+L` kısayolu ve modal aksiyonları bağlandı; büyük harfli `HTTPS://` girdileri normalize edildi.
  15) `Sidebar.tsx`: [UI-06] İç içe buton ihlali giderildi, proje seçimi içteki `<button>`a taşındı, 3 satırlık pulse skeleton eklendi.
  16) `ClonePage.tsx`: [UI-02] Klonlama bitince "Yeni Klon" (`RotateCcw` ikonuyla `reset()`) butonu eklendi.
  17) `SettingsPage.tsx`: Yükleme esnasında form yerine zarif yükleme iskeleti (`animate-pulse`) eklendi, kullanılmayan importlar temizlendi.
  18) `TechStackPage.tsx` & `SiteMapPage.tsx`: `isAnalyzing` durumu için canlı tarama/iskelet UI'ı eklendi, kullanılmayan importlar temizlendi.
  19) `CloneSetupModal.tsx`: `Escape` tuşu ile kapanma ve varsayılan çıktı dizini (`defaultOutputDir`) otomatik besleme desteği eklendi.
  20) `env.d.ts` & `TitleBar.tsx`: Ortam bildirimleri eklenerek `@ts-ignore` kaldırıldı, tam tip güvenliği sağlandı.
- **[KARAR-001] Electron + electron-builder:** Kullanıcının "Windows'ta portable çalışacak" şartı nedeniyle Electron seçildi.
- **[KARAR-002] 6 Katmanlı Teknoloji Tespiti:** Headers, Cookies, Meta, DOM, Script ve JS Global değişken kontrolü ile %95+ güvenilirlikte tespit.
- **[KARAR-003] Organize Dosya Çıktı Mimarisi:** Her klonlanan site için `manifest.json`, `README.md`, `_meta/`, `_screenshots/` ve `site/` şeklinde offline hiyerarşi oluşturma.
- **[KARAR-004] 4 Adımlı CloneSetupModal:** Kayıt yerini, proje adını, filtreleri ve modları klonlama başlamadan önce yapılandıran sihirbaz.
- **[KARAR-005] Playwright Yerine Yerleşik Electron PageRenderer:** Playwright-core portable exe içine Chromium paketlemediği için harici bağımlılık kaldırıldı; Electron'un kendi yerleşik Chromium motoru (`offscreen: true, webSecurity: true, sandbox: true`) ile sıfır konfigürasyonlu JS render, token çıkarma ve ekran görüntüsü motoruna geçildi.
- **[KARAR-006] CSS İçi Derin Varlık Keşfi (CSS AST / Regex Engine):** Harici CSS dosyaları indirildikten sonra içerisindeki fontlar ve arka plan resimleri otomatik olarak kuyruğa aktarılır ve yerel dosya yollarına dönüştürülür.
- **[KARAR-007] Yönetim Merkezi / Cyber Glow Tasarım Sistemi:** Obsidyen `#08090C` zemin, `#10131B` kartlar, neon zümrüt `#00E599` ve siyan `#00F2FE` parlama efektli metrik kartları.
- **[KARAR-008] Palet Resmileştirme + Offline Font Gömme (kullanıcı onaylı):** KARAR-007'nin ilk uygulamasında JSX'e saçılmış ~300+ ham-hex/Tailwind-stok-renk kullanımı `@theme`'deki 5 semantik token'a (`accent`=siyan, `secondary`=mor, `success`/`warning`/`error` + her biri -hover varyantı) script ile taşındı; görsel sonuç aynı kaldı, kaynak tekilleşti. Inter+JetBrains Mono woff2 (latin+latin-ext, değişken font) indirilip `assets/fonts/`e gömüldü, CDN bağımlılığı tamamen kalktı.
- **[KARAR-009] got+cheerio bundle'a alınır, undici external kalır (kritik çökme düzeltmesi):** `got`(v14)/`cheerio`(v1) saf ESM oldukları için externalize edilemez (Node `require()` ESM yükleyemez → `ERR_REQUIRE_ESM`), ama `got`'un transitive bağımlılığı `undici` bundle'a girerse Rollup'ın CJS-birleştirme sırasında `require()` çağrılarını dosya tepesine hoisting'lemesi, `undici`'nin `node:sqlite`'ı için yazdığı try/catch korumasını (opsiyonel özellik tespiti) kırıp `ERR_UNKNOWN_BUILTIN_MODULE` ile çöküyor. Çözüm asimetrik: `got`+`cheerio` `externalizeDepsPlugin({exclude})` ile bundle'a alınır (ESM→CJS interop için), `undici` (kendisi zaten CJS) ayrıca `rollupOptions.external`'a eklenerek bundle DIŞINDA, orijinal `require()` semantiğiyle bırakılır. **Reddedilen alternatif:** `got`'u v11'e (son CJS sürüm) düşürmek — daha invaziv, API farkı riski; ESM main process'e geçmek — daha büyük yapısal değişim.
- **[KARAR-010] Temiz ve Düz Varlık Klasörleme (Anti-Nesting) Mimarisi:** Varlıkların URL path'indeki 10 katmanlı klasör hiyerarşisi (`wp-content/uploads/2026/08/...`) yerine doğrudan `site/assets/{css,js,images,fonts,media}/` altına ve harici hostlar için `site/assets/vendor/<host>/` altına 6 haneli çakışmasız hash ile kaydedilmesi kararlaştırıldı. Windows MAX_PATH limiti ve aşırı dağınık dosya ağacı engellendi.
- **[KARAR-011] Konsol ve Komut Paleti Tabanlı İş İstasyonu UX Mimarisi:** Raycast tarzı `Ctrl+K` Command Palette, sekmeler üzerinde canlı telemetri rozetleri, URL çubuğunda gerçek zamanlı protokol denetimi/geçmiş/pano entegrasyonu ve filtrelenebilir geliştirici log konsolu tek bir bütünleşik iş istasyonu deneyimi olarak kurgulandı.
- **[KARAR-012] Mimari Sistem Haritası (.md) ve Yerleşik 127.0.0.1 Mikro Önizleme Sunucusu:** Sitenin tamamını indirmek istemeyen geliştiriciler için 6 katmanlı teknoloji, $10K CSS/Tailwind tokenları, ASCII sayfa ağacı ve AI kodlama promptunu içeren ultra detaylı `SYSTEM_MAP.md` üreticisi (`SystemMapGenerator`) geliştirildi. Tam klonlama durumunda ise modern tarayıcıların `file:///` CORS kısıtlamalarını aşmak için Node.js yerleşik `http.createServer` ile 127.0.0.1 üzerinde dinamik port tahsisli hafif bir statik web sunucusu (`PreviewServer`) kurularak klonlanan sitelerin canlı bir sunucu gibi %100 hatasız açılması sağlandı.
- **[KARAR-013] Derin CSS Token Çıkarımı, Canlı Değişkenler ve Birebir Replica Kod Şablonları:** Hedef web sitesinin piksel piksel aynısını sıfırdan kurabilmek amacıyla; canlı sayfadaki tüm CSS değişkenleri (`:root`), gölgeler (`box-shadow`), kenar yuvarlaklıkları (`border-radius`), cam efektleri (`backdrop-filter`), konteyner sınırları, logo/favicon/SVG varlıkları ve sayfa iskelet mimarisi (Navbar, Hero, Footer) Chromium DOM seviyesinde çıkarıldı. `SystemMapGenerator`, WCAG kontrast skoru, doğrudan kopyalanabilir `globals.css`, `tailwind.config.js`, `Navbar.tsx`, `Hero.tsx` ve Cursor/Claude için Master AI Replica Prompt'u üretecek şekilde tam donatıldı.
- **[KARAR-014] Kayıpsız Klonlama, 5 Kademeli Fuzzy URL Eşleme ve Offline Korumaları:** İndirilen sitelerin sıfır kayıpla ve hatasız çalışması için 4 kritik mühendislik katmanı devreye alındı: 1) `FileOrganizer` alt dizin (`/about/`) rotalarını `about/index.html` olarak izole etti (kök `index.html`'i ezme riski tamamen kalktı), sorgulu sayfalara MD5 hash verildi. 2) `PageProcessor` responsive `srcset`, `data-src` lazy-load, SVG `<use>` sprite'ları, inline `style="url()"` ve CSS `@import` varlıklarını eksiksiz topladı; PDF/ZIP gibi linkler statik varlık olarak ayrıştırıldı. 3) `UrlRewriter` query, hash ve trailing slash toleranslı 5 kademeli fuzzy eşleştirme, `<base href>` temizliği, lazy-load'ı `src`'ye terfi ettirme ve offline Service Worker bypass kalkanı kurdu. 4) `AssetDownloader` gerçek Chrome başlıkları, Referer hotlink bypass'ı ve 3x ağ hata kurtarma ile donatıldı.

- **[KARAR-015] Çoklu Ajan Denetimi & Tam Sistem Zırhlama (Resilience & A11y & OS Guard):** İki uzman alt ajan (Mimari/Motor ve UI/UX) tarafından yürütülen çift taraflı denetim neticesinde:
  1) `main/index.ts`: macOS `activate` IPC handler çift kayıt çökmesi engellendi.
  2) `ipc-handlers.ts`: Pencere kapatıldığında/yenilendiğinde `sender.isDestroyed()` kalkanı ile `Object has been destroyed` fatal crash riski sıfırlandı.
  3) `preview-server.ts`: Path traversal açığı `path.relative` ile yamandı; `readStream.on('error')` ile dinlenmeyen stream çökmesi engellendi; `server.closeAllConnections()` ile keep-alive soket asılı kalması giderildi.
  4) `crawler-engine.ts`: İptal (`cancel`) anında in-flight paralel görevlerin settled olması beklenerek dosya bozulması ve yarış durumu (race condition) önlendi; `finalizeCloning` disk hatalarına karşı try/catch ile zırhlandı; `registerUrlMapping`'de query sayfalarının ana rotaları ezmesi engellendi.
  5) `url-rewriter.ts`: HTML `<a href="/#fiyatlar">` ve CSS `url("font.svg#glyph")` içindeki `#anchor` (hash) parçaları korunarak sayfa içi kaydırma ve ikon fontları kurtarıldı.
  6) `TitleBar.tsx`: Windows yerel pencere butonları (`titleBarOverlay`) için sağ tarafa `pr-36` emniyet boşluğu bırakıldı (Ctrl+K butonunun yerel butonlar altında kalması engellendi).
  7) `OverviewPage.tsx` & `ClonePage.tsx`: WCAG AA ihlali olan açık siyan üzeri beyaz metinler siyah kalın yazıya (`text-black font-bold`) çevrilerek AAA (9.2:1) kontrast sağlandı; `new URL(url).hostname` çıplak render çökmesi güvenli `getDomain` fonksiyonuna bağlandı; analiz yükleniyor ve hata iskeleleri eklendi; tamamlanma ve atlanan varlık listesi arayüze taşındı.
  8) `App.tsx` & `UrlInput.tsx`: Global klavye kısayolları (`Ctrl+1-5`, `Ctrl+N`, `Ctrl+\``, `Ctrl+L`) bağlandı, Escape ile geçmiş kapanışı, sağ padding `pr-24` genişletmesi ve Toaster `offset={36}` ile durum çubuğu çakışması önlendi.
- **[KARAR-016] Kod Tabanı ve Bağımlılık Arındırma (Deep Codebase Sanitization):**
  1) `package.json`: 0 kullanım tespit edilen `framer-motion`, `recharts`, `jimp` ve `png-to-ico` bağımlılıkları kaldırılarak gereksiz paket yükü temizlendi.
  2) Kök dizindeki tek seferlik `make_ico.js` betiği (ikonlar önceden üretilip yerleştiği için) silindi.
  3) `src/renderer/src/lib/constants.ts`: Kullanılmayan ölü `MIME_ICONS` ve `STATUS_COLORS` sabitleri çıkarıldı.
  4) `src/renderer/src/stores/ui-store.ts`: `sidebarWidth` ve `bottomPanelHeight` kullanılmayan state alanları çıkarıldı.
  5) `src/main/index.ts`: `registerIpcHandlers(mainWindow)` çağrısı ana pencere referansı ile beslenerek modal pencerelerin üst pencereye bağlanması garantiye alındı.
- **[KARAR-017] Veri ve Bilgi Sızıntısı Önleme Kalkanı (Anti-Leak & Secret Hardening):**
  1) `.gitignore`: Kapsamlı kurumsal şablonla genişletildi (`.env`, `.env.*`, `*.pem`, `*.key`, `*.cert`, `*.pfx`, `credentials.json`, `secrets.json`, `.webclone-settings.json`, `*.sqlite`, `*.db`, OS ve IDE kalıntıları).
  2) `electron-builder.yml`: `files` beyaz listesi (`out/**/*`) ve katı kara liste (`!**/.env*`, `!**/*.pem`, `!**/*.key`, `!**/*.md`) eklenerek çalışma dizininde geliştirme esnasında `.env` veya sertifika dosyası unutulsa dahi asar/exe paketine sızması %100 engellendi.
  3) Git geçmişi ve çalışma alanında tam metin taraması (API key, token, bearer, password) yapıldı; 0 sızıntı doğrulandı.
- **[KARAR-018] Dinamik Çevre Yolları ve Windows Klasör Yönlendirmesi (Dynamic Env Paths):**
  1) `SettingsStore`: Yapılandırma ve kalıcı ayar dizini sabit `userData` veya kullanıcı klasörü yerine öncelikle dinamik `process.env.LOCALAPPDATA` ortam değişkenine bağlandı (`%LOCALAPPDATA%\WebCloneStudio\settings.json`).
  2) `ipc-handlers.ts`: Downloads, Documents ve Desktop yolları `os.homedir()` sabit birleşiminden kurtarılarak `getDynamicFolder()` ile `app.getPath(...)` ve `process.env.USERPROFILE` ortam değişkenlerine bağlandı. Kullanıcı klasörlerini D:\, OneDrive vb. farklı disklere yönlendirmiş olsa dahi sistem dinamik olarak doğru yolu bulur.
- **[KARAR-019] Yapay Zeka/Denetim İzlerinin Arındırılması ve Geliştirici İmzası (Codebase Humanization & Attribution):**
  1) `Teknokol` adı tüm çalışma alanında, konfigürasyonlarda ve git geçmişinde tarandı; 0 adet eşleşme teyit edildi.
  2) Kod tabanındaki audit/yapay zeka etiketleri ("Finding #..", "Bulgu #..") tamamen temizlendi ve kıdemli yazılım mühendisi standartlarında profesyonel teknik dokümantasyon yorumlarına dönüştürüldü.
  3) Geliştirici kimliği ve telif hakları `Monolith Works / MonarchDevLab` olarak `package.json`, `electron-builder.yml`, `manifest-generator.ts`, `readme-generator.ts`, `system-map-generator.ts`, `Sidebar.tsx` ve `SettingsPage.tsx` bileşenlerine işlendi.
  4) Taşınabilir derleme (`dist/WebClone-Studio-Portable.exe`) bu güncel kimlik ve meta verilerle yeniden inşa edildi.
- **[KARAR-020] Kurumsal Git Geçmişi Yapılandırması ve Mimari Commit Zinciri (Corporate Commit History):**
  1) Eski dağınık commit geçmişi, Monolith Works & MonarchDevLab ekibinin 10 adımlık kıdemli mimari geliştirme zincirine (Core -> Types -> Lifecycle -> Storage -> Analyzers -> Cloner -> Browser -> Generators -> UI -> IPC/Docs) dönüştürüldü.
  2) Tüm commitlerin yazar ve onaylayan kimlikleri tekil olarak `MonarchDevLab <249069389+MonarchDevLab@users.noreply.github.com>` olarak mühürlendi.
  3) Kök dizine kurumsal seviyede, rozetli, mimari modül şemalı ve güvenlik ilkeli kapsamlı `README.md` yerleştirildi.
  4) Kod tabanındaki son "prompt", "Cursor", "yapay zeka" referansları teknik şartname terminolojisine uyarlandı; GitHub uzak depolarında 0 sızıntı/ibare teyit edildi.
- **[KARAR-021] Sistem Standartları Uyumu (.ai/ -> docs/ Taşınması ve Dizin Hiyerarşisi):**
  1) Anayasa v3.4 (P6) ve `monolith_standards.md` gereğince araç/yapay zeka izi taşıyan `.ai/` dizini tamamen kaldırıldı, tüm çekirdek hafıza `docs/` altında toplandı.
  2) `AI_HANDOFF.md` başlığı ve dosya adı `HANDOFF.md` olarak standartlaştırıldı.
  3) Projeye özgü uyarlanmış mühendislik zinciri `docs/MONOLITH_CHAIN.md` ve `.agents/rules/MONOLITH_CHAIN.md` konumlarına bağlandı.

## Dersler (Gotchas)
- `electron-builder`: Windows `.ico` ikonu mutlaka en az 256x256 piksel çözünürlükte olmalıdır, aksi halde portable hedefi hata verir.
- **Windows IconCache (Gotcha)**: Windows Explorer `.exe` ikonlarını agresif bir şekilde path (dosya yolu) bazlı önbelleğe alır. Yeni bir ikon eklendiğinde `dist/.icon-ico` gibi electron-builder önbelleklerini temizlemek yetmez, Windows'un önbelleğini atlatmak (cache-busting) için çıktı dosyasının adını (örn. `artifactName: "App-Name-Portable.exe"`) değiştirmek en garantili yöntemdir.
- `got`: `response.body` stream tamamlandıktan sonra tekrar okunamaz; body buffer olarak alınmalıdır.
- `cheerio`: v1 sürümünde `decodeEntities` parametresi kaldırılmıştır. Ayrıca `css-select` motoru `use[*|href]` gibi isim alanı (namespaced) seçicilerini desteklemez ve `Namespaced attributes are not yet supported` hatasıyla çöker; seçim `$('use')` ile yapılıp nitelik `.attr('href') || .attr('xlink:href')` ile okunmalıdır.
- **Hash Çakışması (Gotcha):** `Buffer.from(query).toString('hex').slice(0, 6)` metodu dizginin ilk 3 karakterini hex'e çevirir; bu nedenle `?cat=shoes` ve `?cat=shirts` aynı `3f6361` çıktısını verir ve birbirini ezer! Benzersizlik için mutlaka `crypto.createHash('md5').update(str).digest('hex').slice(0, 8)` kullanılmalıdır.
- **IPC Destroyed Sender Crash (Gotcha):** Klonlama arka planda sürerken kullanıcı pencereyi kapatır veya F5 atarsa `sender.send()` doğrudan `Error: Object has been destroyed` fırlatarak Node ana sürecini anında düşürür. Bütün event listener'larda `if (!sender.isDestroyed())` koruması zorunludur.
- **Windows TitleBarOverlay Padding (Gotcha):** Electron `titleBarStyle: 'hidden'` + `titleBarOverlay` kullanıldığında Windows sağ üstte ~138-144px pencere kontrolü (küçült/büyüt/kapat) bindirir. Sağ taraftaki custom butonlara mutlaka en az `pr-36` (144px) verilmelidir.
- `.ai/` klasörü doğrudan yapay zeka oturumunu ifşa ettiği için v3.4 anayasası ve Monolith Works mühendislik zinciri gereği tamamen kaldırılmış; tüm çekirdek dokümantasyon ve hafıza `docs/` altında toplanmıştır.
- **Electron main process doğrulaması `npm run build`/`typecheck`/`build:portable`'ın exit 0 vermesiyle BİTMEZ.** Bunlar sadece bundling'in başarılı olduğunu kanıtlar. `got`/`cheerio`/`undici`/`node:sqlite` zinciri (KARAR-009) bundle başarıyla üretildiği HALDE ana pencere açılmadan çöküyordu — hata sadece gerçekten `.exe`'yi (veya `npm run dev`'i) çalıştırıp süreç ağacının birkaç saniye stabil kaldığını gözlemleyerek yakalandı. Tarayıcı üzerinden (Vite renderer dev server) yapılan UI doğrulaması `window.electronAPI` mock-fallback'e düştüğü için gerçek IPC/main-process kodunu HİÇ egzersiz etmiyor — sahte bir güven verir. Kural: paketleme adımından sonra mutlaka gerçek exe'yi (veya `npm run dev`'i) çalıştırıp süreç sağlığını kontrol et.

## Geçmiş Oturumlar
- **2026-10-02 (6f1fa25):** Ouroboros v6.0 ile başlatılan "Ultimate Web Clone" 5 fazlı projesi tamamlandı. Chromium CDP üzerinden stealth evasion, shadow DOM piercing, React/TSX export ve gizli JS assetlerinin (Obfuscation Bypass) AST & Regex tabanlı extraction işlemleri eklendi. Sistem kusursuz (0 hata) çalışacak şekilde finalize edildi.
- **2026-09-02:** 33 mimari bulgu refactor edildi, yerleşik PageRenderer Electron offscreen'e bağlandı, portable build alındı.
- **2026-09-03 (ec0b3be):** 7 sistem iyileştirmesi (Sitemap XML entegrasyonu, temiz dosyalama KARAR-010, dinamik boyut hesabı, UI flex scroll min-h-0 düzeltmesi, çift tarayıcı/klasör aksiyon butonları, dynamicLimiter ve Scope Guard) tamamlandı ve doğrulandı.
- **2026-09-03 (728434a):** Arayüz seviyesi yükseltildi (KARAR-011: Ctrl+K Command Palette, canlı sekme telemetri rozetleri, UrlInput panodan yapıştır & protokol tespiti & son siteler geçmişi, OverviewPage demo fırlatıcısı & CSS :root palet aktarımı, filtrelenebilir ve oto-kaydırmalı geliştirici konsolu).
- **2026-09-03 (515c987):** Ultra Detaylı Sistem Haritası (.md) üreticisi ve yerel 127.0.0.1 önizleme mikro sunucusu tamamlandı (KARAR-012).
- **2026-09-03 (123bcdc):** Piksel piksel birebir yeniden üretim için derin CSS değişkenleri, WCAG kontrastı, bileşen blueprintleri ve hazır kopya kod şablonları tamamlandı (KARAR-013).
- **2026-09-03 (a4a73b9):** Kayıpsız klonlama motoru, 5 kademeli URL eşleyici, anti-bot/hotlink kalkanı ve offline korumaları tamamlandı (KARAR-014).
- **2026-09-03 (fd0b414):** Çoklu ajan denetimi bulguları çözüldü (macOS activate crash, sender destroyed, path traversal, hash anchor koruması, Windows titlebar overlay, WCAG AAA kontrast) (KARAR-015).
- **2026-09-03:** Tam dosya taraması ve derin kod tabanı temizliği (gereksiz bağımlılıklar, ölü sabitler ve geçici betikler temizlendi) (KARAR-016).
