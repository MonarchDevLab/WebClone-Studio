# Tersine Mühendislik & Çekirdek Güçlendirme — Uygulama Planı

Hedef: İzole yazılmış modülleri klonlama motoruna bağlamak, eksik API Trafik ve Token Çıkarıcı modüllerini inşa etmek, UI kontrollerini eklemek ve motoru sıfır hata ile üretime hazır hale getirmek.  
Tasarım: `docs/specs/2026-09-16-reverse-engineering-design.md` · Yığın: TypeScript, Node.js, Electron Chromium, Cheerio, Source-Map, Zustand, React  
Yürütme: Kendin (`mod-insa.md` / `mod-tdd.md`)

## Genel Kısıtlar
- Windows dosya sistemiyle tam uyumlu (Path traversal korumalı, geçersiz karakter sanitizasyonu).
- Main process içinde indirilmiş JavaScript'i `eval()` etmek kesinlikle yasaktır.
- Tüm I/O işlemleri asenkron ve atomik geçici dosya (`.tmp`) üzerinden yürütülür.
- RAM şişmesini önlemek için tüm veri yapıları sınırlı/stream tabanlı çalışır.
- UI katmanında sıfır emoji kuralı geçerlidir (Lucide SVG ikonları kullanılır).
- `npm run typecheck` ve `npm test` %100 temiz ve hatasız olmalıdır.

## İnceleme Odağı
1. `sourcemap-reconstructor`: `//# sourceMappingURL=` göreli URL'leri, inline data URI sourcemap'ler ve `../` path traversal denemeleri.
2. `framework-extractor`: HTML içinde birden fazla script etiketi, bozuk/kaçırılmış JSON metinleri ve büyük payload'lar.
3. `token-extractor`: Karmaşık minified CSS dosyalarındaki `:root` değişkenleri, CSS renk formatları (hsl, oklch, hex, rgb).
4. `api-interceptor`: Chromium offscreen render sırasında gerçekleşen eşzamanlı fetch/xhr isteklerinin thread-safe toplanması.
5. `preview-server`: Canlı sitedeki parametreli API rotalarının yerel önizleme sunucusunda eşleştirilmesi.

## Dosya Haritası
- Oluştur: `src/main/cloner/reverse-engineering/api-interceptor.ts` (API trafik yakalayıcı ve şema formatlayıcı)
- Oluştur: `src/main/cloner/reverse-engineering/token-extractor.ts` (CSS token ve Tailwind konfigürasyon çıkarıcı)
- Oluştur: `tests/main/cloner/reverse-engineering/token-extractor.test.ts` (Token extractor testleri)
- Oluştur: `tests/main/cloner/reverse-engineering/api-interceptor.test.ts` (API interceptor testleri)
- Değiştir: `src/main/cloner/crawler-engine.ts` (Sourcemap indirme, framework state agregasyonu, token ve API entegrasyonu)
- Değiştir: `src/main/cloner/page-processor.ts` (JS ve CSS dosyalarındaki sourcemap URL'lerinin keşfi)
- Değiştir: `src/main/server/preview-server.ts` (Mock API endpoint yanıt desteği)
- Değiştir: `src/main/storage/settings-store.ts` (defaultReverseEngineering ayar desteği)
- Değiştir: `src/shared/types.ts` (AppSettings ve CloneSettings tiplerinin genişletilmesi)
- Değiştir: `src/main/ipc-handlers.ts` (Hatalı _meta yolunun temizlenmesi)
- Değiştir: `src/renderer/src/components/modal/CloneSetupModal.tsx` (Tersine mühendislik toggle switch arayüzü)
- Değiştir: `src/renderer/src/pages/SettingsPage.tsx` (Varsayılan tersine mühendislik ayar kontrolü)
- Değiştir: `docs/TASKS.md` (Görev takip matrisi)
- Değiştir: `docs/HANDOFF.md` (Durum raporu)

---

### Görev 1: SourceMap Keşif ve İndirme Hattı (Asset Pipeline Entegrasyonu)
Dosyalar: değiştir `src/main/cloner/page-processor.ts`, değiştir `src/main/cloner/crawler-engine.ts`, test `tests/main/cloner/reverse-engineering/sourcemap-reconstructor.test.ts`  
Arayüz: `reconstructSourceTree(mapContent: string, outputDir: string): Promise<void>`

- [ ] 1. Başarısız test: `.map` keşif ve çözümleme senaryosu testi.
- [ ] 2. Koş: `npm test` — Beklenen: FAIL veya yeni senaryo testi fail.
- [ ] 3. Minimum uygulama:
  - `page-processor.ts` içinde JS dosyalarındaki `//# sourceMappingURL=...` veya `/*# sourceMappingURL=... */` regex ile taranır.
  - `crawler-engine.ts` içinde JS/CSS indirildiğinde sourcemap referansı varsa ve `settings.reverseEngineering` aktifse `.map` dosyası kuyruğa eklenir.
  - `.map` dosyası indiğinde `reconstructSourceTree` çağrılarak kaynak kodlar `site/_source-code/` klasörüne kurtarılır.
- [ ] 4. Koş: `npm test` — Beklenen: PASS.
- [ ] 5. Commit: `feat(cloner): wire sourcemap discovery and extraction pipeline`
Geri dönüş: git revert HEAD

---

### Görev 2: Framework State Çıkarıcı Entegrasyonu (Multi-Page Aggregation)
Dosyalar: değiştir `src/main/cloner/crawler-engine.ts`, test `tests/main/cloner/reverse-engineering/framework-extractor.test.ts`  
Arayüz: `extractFrameworkState(html: string): Record<string, any>`

- [ ] 1. Başarısız test: Çok sayfalı agregasyon testi.
- [ ] 2. Koş: `npm test` — Beklenen: FAIL.
- [ ] 3. Minimum uygulama:
  - `crawler-engine.ts` içinde taranan her HTML sayfası için `extractFrameworkState` çağrılır.
  - Elde edilen veri boş değilse `allExtractedStates[item.url] = state` yapısında toplanır.
  - `finalizeCloning` aşamasında `_meta/extracted-state.json` dosyasına yazılır.
- [ ] 4. Koş: `npm test` — Beklenen: PASS.
- [ ] 5. Commit: `feat(cloner): aggregate and persist framework state across pages`
Geri dönüş: git revert HEAD

---

### Görev 3: Tasarım Sistemi ve Tailwind Token Extractor
Dosyalar: oluştur `src/main/cloner/reverse-engineering/token-extractor.ts`, oluştur `tests/main/cloner/reverse-engineering/token-extractor.test.ts`, değiştir `src/main/cloner/crawler-engine.ts`  
Arayüz: `export function extractDesignTokensFromCss(cssContents: string[]): { tokens: Record<string, any>; tailwindConfig: string }`

- [ ] 1. Başarısız test: CSS değişkenleri ve Tailwind config üretim testi.
- [ ] 2. Koş: `npx vitest run tests/main/cloner/reverse-engineering/token-extractor.test.ts` — Beklenen: FAIL.
- [ ] 3. Minimum uygulama:
  - `token-extractor.ts` modülü: `:root` değişkenleri (`--primary`, `--font-*`), hex/rgb/hsl renkler ve font ailelerini parse eder.
  - Standart bir `tailwind.config.js` şablonu üretir.
  - `crawler-engine.ts:finalizeCloning` aşamasında `_meta/tailwind.config.js` ve `_meta/design-tokens.json` olarak kaydeder.
- [ ] 4. Koş: `npx vitest run tests/main/cloner/reverse-engineering/token-extractor.test.ts` — Beklenen: PASS.
- [ ] 5. Commit: `feat(reverse-engineering): implement tailwind and design token extractor`
Geri dönüş: git revert HEAD

---

### Görev 4: API Trafik Yakalayıcı ve Offline Mock Sunucu Desteği
Dosyalar: oluştur `src/main/cloner/reverse-engineering/api-interceptor.ts`, oluştur `tests/main/cloner/reverse-engineering/api-interceptor.test.ts`, değiştir `src/main/browser/page-renderer.ts`, değiştir `src/main/server/preview-server.ts`  
Arayüz: `export interface CapturedApiEndpoint { url: string; method: string; status: number; contentType: string; responseData: any; }`

- [ ] 1. Başarısız test: API trafik yakalama ve preview server mock yanıtlama testi.
- [ ] 2. Koş: `npx vitest run tests/main/cloner/reverse-engineering/api-interceptor.test.ts` — Beklenen: FAIL.
- [ ] 3. Minimum uygulama:
  - `api-interceptor.ts`: Yakalanan XHR/Fetch yanıtlarını URL ve HTTP metoduna göre dizinler ve OpenAPI benzeri JSON yapısına dönüştürür.
  - `page-renderer.ts`: `BrowserWindow` yüklenirken session webRequest dinleyicisi veya network debugger ile API yanıtlarını kaydeder.
  - `crawler-engine.ts`: İndirme bitiminde `_meta/api-endpoints.json` dosyasına yazar.
  - `preview-server.ts`: İstenen rota yerel dosyada bulunamadığında `_meta/api-endpoints.json` içindeki mock yanıtı HTTP 200 JSON olarak döner.
- [ ] 4. Koş: `npx vitest run tests/main/cloner/reverse-engineering/api-interceptor.test.ts` — Beklenen: PASS.
- [ ] 5. Commit: `feat(reverse-engineering): implement api traffic interceptor and offline mock server`
Geri dönüş: git revert HEAD

---

### Görev 5: UI & Ayar Kontrolleri Entegrasyonu
Dosyalar: değiştir `src/shared/types.ts`, değiştir `src/main/storage/settings-store.ts`, değiştir `src/renderer/src/pages/SettingsPage.tsx`, değiştir `src/renderer/src/components/modal/CloneSetupModal.tsx`  
Arayüz: `CloneSettings.reverseEngineering: boolean`, `AppSettings.defaultReverseEngineering: boolean`

- [ ] 1. Tip ve Store genişletmesi: `AppSettings.defaultReverseEngineering` eklenmesi ve `SettingsStore` varsayılan değerinin tanımlanması.
- [ ] 2. `SettingsPage.tsx`: Genel ayarlara "Tersine Mühendislik (Kaynak Kod & API Yakalama)" toggle bileşeninin eklenmesi ve IPC saveSettings entegrasyonu.
- [ ] 3. `CloneSetupModal.tsx`: Modalın Gelişmiş Ayarlar adımına "Tersine Mühendislik Laboratuvarı" şalterinin eklenmesi ve store ayarlarından otomatik yüklenmesi.
- [ ] 4. Koş: `npm run typecheck` — Beklenen: PASS (0 hata).
- [ ] 5. Commit: `feat(ui): add reverse engineering toggles to settings and clone modal`
Geri dönüş: git revert HEAD

---

### Görev 6: IPC Düzeltmesi, Uçtan Uca Doğrulama & Dokümantasyon
Dosyalar: değiştir `src/main/ipc-handlers.ts`, değiştir `docs/TASKS.md`, değiştir `docs/HANDOFF.md`  

- [ ] 1. `ipc-handlers.ts:241`'deki hatalı `path.join(finalOutputDir, '_meta')` dizin yazımının temizlenmesi.
- [ ] 2. Tam test paketi: `npm test` — Tüm testler yeşil.
- [ ] 3. Tip kontrolü: `npm run typecheck` — 0 hata.
- [ ] 4. Derleme: `npm run build` — 0 hata.
- [ ] 5. `docs/TASKS.md` ve `docs/HANDOFF.md` atomik güncellenmesi.
- [ ] 6. Commit: `fix(ipc): resolve redundant meta path and update project documentation`
Geri dönüş: git revert HEAD
