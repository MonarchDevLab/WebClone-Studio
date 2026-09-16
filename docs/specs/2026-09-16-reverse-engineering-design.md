# WebClone Studio: Tersine Mühendislik (Reverse Engineering) Motoru Tasarımı

## 1. Genel Bakış
WebClone Studio uygulamasının salt bir statik HTML indiriciden çıkarak dinamik bir web tersine mühendislik laboratuvarına dönüştürülmesi hedeflenmektedir. Bu belge, 4 temel tersine mühendislik modülünün (Sourcemap, State, API, Design Tokens) mimarisini, veri akışını ve sınırlarını tanımlar. Ouroboros v6.0 kuralları gereği, tüm modüller belleği (RAM) tüketmeyecek stream (akış) mimarisiyle tasarlanacaktır.

## 2. Mimari ve Modül Sınırları

Tersine mühendislik bileşenleri, çekirdek klonlama motorundan izole edilmiş `src/main/cloner/reverse-engineering/` dizini altında konumlandırılacaktır.

### 2.1. Sourcemap Reconstructor (`sourcemap-reconstructor.ts`)
- **Amacı:** İndirilen JS/CSS dosyalarından orijinal TypeScript/JSX/Vue kaynak kodlarını klasör hiyerarşisiyle kurtarmak.
- **Girdi:** `AssetDownloader` tarafından indirilen JavaScript/CSS dosyalarının içerikleri.
- **İşlem:** `//# sourceMappingURL=` veya doğrudan `X-SourceMap` header'ını tespit eder. Hedef `.map` dosyasını indirir, `source-map` kütüphanesi ile `sources` ve `sourcesContent` alanlarını ayrıştırır.
- **Çıktı:** Kurtarılan dosyalar `site/_source-code/` dizinine yazılır.

### 2.2. Framework Data Extractor (`framework-extractor.ts`)
- **Amacı:** Modern SPA (Single Page Application) framework'lerinin gizli arka uç veri durumlarını (hydration state) ayıklamak.
- **Girdi:** `PageProcessor` üzerinden geçen HTML DOM yapısı.
- **İşlem:** Cheerio ile `<script id="__NEXT_DATA__">`, `window.__NUXT__`, `window.__INITIAL_STATE__` (Redux), Apollo Cache gibi yapıları regex ve AST ile yakalar.
- **Çıktı:** Veriler `_meta/extracted-state.json` içine key-value formatında kaydedilir.

### 2.3. API Traffic Interceptor (`api-interceptor.ts`)
- **Amacı:** Sayfa dolaşımı esnasında yapılan dinamik XHR/Fetch/GraphQL isteklerini dinlemek ve kaydetmek.
- **Girdi:** `PageRenderer` (Electron Chromium `webContents.debugger` veya Network sekmesi olayları).
- **İşlem:** Sadece `xhr` ve `fetch` türündeki istekleri dinler. İstek URL'si, metodu, query parametreleri, POST gövdesi ve gelen HTTP yanıtını (JSON/XML) yakalar.
- **Çıktı:** İstekler mock sunucusu için `_meta/api-endpoints.json` dosyasına OpenAPI'ye benzer (URL -> Method -> Response) yapıda kaydedilir.

### 2.4. Tasarım Sistemi Çıkarıcı (`token-extractor.ts`)
- **Amacı:** Stil dosyalarından ve computed DOM node'larından markanın renk, boşluk ve tipografi altyapısını sökmek.
- **Girdi:** Ana CSS/Stil dosyaları.
- **İşlem:** `:root` içerisindeki CSS değişkenlerini (`--primary-color` vb.) ayrıştırır. Eğer Tailwind kullanılıyorsa, sınıf isimlerinden Tailwind konfigürasyonunu tersine tahmin eder.
- **Çıktı:** Kullanıcıya hazır `_meta/tailwind.config.js` ve `_meta/design-tokens.json` sunar.

## 3. Veri Akışı ve Entegrasyon
1. Kullanıcı `CloneSetupModal` üzerinden "Tersine Mühendislik Motoru" (Reverse Engineering) ayarını aktif eder.
2. `CrawlerEngine` URL'yi yakalar ve `PageRenderer`'a iletir. `PageRenderer` render olurken `api-interceptor.ts` aktif olarak trafiği dinler.
3. İndirilen HTML `framework-extractor.ts` modülünden geçer ve veriler toplanır.
4. CSS ve JS indirilirken `sourcemap-reconstructor.ts` asenkron bir worker veya kuyruk üzerinden `.map` çözümlemesini yapar.
5. Sitenin çevrimdışı önizlemesi başlatıldığında `PreviewServer`, `_meta/api-endpoints.json` dosyasını okuyarak giden AJAX isteklerini sahte (mock) yanıtlarla karşılar; böylece arama veya filtreleme gibi işlemler çevrimdışı çalışmaya devam eder.

## 4. Hata Yönetimi ve Güvenlik
- **Güvenlik Sınırı:** Hiçbir çalıştırılabilir kod (JS execution) ana Node.js sürecinde (Main Process) çalıştırılmaz. API yanıtları sadece JSON olarak ayrıştırılır, `eval()` kesinlikle kullanılmaz.
- **Hata Toleransı (Fault Tolerance):** Bir Sourcemap çözümleme hatası sitenin genel klonlanmasını durduramaz. Sadece ilgili modülde başarısızlık logu oluşturulur (Ouroboros izole try/catch akışı).

## 5. UI Değişiklikleri
- **CloneSetupModal & SettingsPage:** "Gelişmiş Tersine Mühendislik (API Yakalama, Sourcemap, React/Next.js State)" için on/off switch eklenecektir.

## 6. Gerekli Kütüphaneler
- Orijinal kaynak çıkarma için: `source-map` kütüphanesi (kurulacak).
- Diğer işlemler Electron ve Cheerio'nun mevcut yetenekleriyle çözülecektir.
