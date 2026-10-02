# OP · planla — Webclone Studio v2.0 'Ultimate' Mimari Stratejisi

**Tarih:** 2026-10-02
**Yazan:** Antigravity / Ouroboros Otonom Süreç

Webclone Studio mevcut durumuyla (v1.0.0) statik varlıkları indirebilen, SPA'leri Electron Offscreen rendering ile çözümleyebilen ve CDP (Chrome DevTools Protocol) ile API trafiklerini mock'layabilen son derece gelişmiş bir araçtır. 

Kullanıcı talebi: *"bu konu önemli web site klonlama vb konular için ne gerekiyorsa ayarla ultimate seviyeye getirelim analiz yap ve dikkatlice planla."*

Bu hedefe ulaşmak için sistemin "Ultimate" seviyeye çıkarılmasını sağlayacak 5 ana sütun (Phase) belirlenmiştir. Bu plan, projenin mevcut **Playwright'sız hafif Electron mimarisini (77.6MB Portable yapısını)** bozmadan, tamamen yerleşik CDP ve Electron webContents API'leri kullanılarak tasarlanmıştır.

---

## 1. Etkileşimli ve Derin Klonlama (Interactive & Deep Extraction)
Mevcut sistem sadece sayfa yüklenmesini bekler. Ancak modern siteler sonsuz kaydırma (infinite scroll) ve Shadow DOM kullanır.
- **CDP ile İnsan-Benzeri Otomasyon:** `Input.dispatchMouseEvent` ve `Runtime.evaluate` kullanılarak otomatik sayfa kaydırma, görünür viewport dışındaki lazy-load resimleri ve "Daha Fazla Yükle" butonlarını tetikleme mekanizması.
- **Shadow DOM & Web Components:** Cheerio yerine CDP'nin `DOM.getDocument({ pierce: true })` komutu kullanılarak Shadow DOM köklerinin statik HTML'e dönüştürülmesi (Flattening).
- **Kimlik Doğrulamalı (Auth) Klonlama:** Kullanıcının ana penceredeki (BrowserView) bir oturum açma işlemini tamamlamasını bekleyip, elde edilen session cookie'leri ve LocalStorage'ı klonlama motoruna aktaran "Kilitli İçerik" klonlama modu.

## 2. Gelişmiş Anti-Bot ve WAF Atlatma (Stealth Evasion)
Cloudflare, Akamai, DataDome gibi sistemler standart Electron veya Headless tarayıcıları kolayca engeller.
- **CDP Script Enjeksiyonu:** `Page.addScriptToEvaluateOnNewDocument` kullanılarak `navigator.webdriver` bayrağının silinmesi.
- **Parmak İzi (Fingerprint) Spoofing:** Canvas, WebGL, AudioContext parmak izi okumalarını manipüle eden (override) koruma kalkanı.
- **TLS & Header Optimizasyonu:** Electron `webRequest` API'leri üzerinden `Sec-Ch-Ua`, `Accept-Language` gibi başlıkların organik Windows/Chrome profillerine %100 benzetilmesi.

## 3. Akıllı Bileşen ve Şema Tersine Mühendisliği (AI-Driven Reverse Engineering)
Ultimate bir klon aracı, sadece statik HTML değil, "yeniden kullanılabilir" kod üretmelidir.
- **Bileşen Hiyerarşisi (React/Vue) Dönüşümü:** DOM ağacı analiz edilerek (örneğin; Header, Hero, Grid, Footer olarak bölümlenip) doğrudan Tailwind tabanlı `.tsx` dosyaları halinde export edilmesi. (Düşük Bilişsel Yük: Yalnızca semantik DOM yapısını LLM/Kurallar motoruna göndererek gerçekleştirilir.)
- **GraphQL / OpenAPI Şema İnşası:** Mevcut `api-endpoints.json` üzerine, yakalanan trafiklerin veri tiplerini analiz eden bir JSON-Schema / Type tanımlayıcı (TypeScript Interfaces) oluşturucu motor.

## 4. Headless CMS Veri Çıkarımı (Structured Data Mining)
- **Tekrarlayan Veri Keşfi:** Sayfadaki blog yazıları, ürün listeleri veya emlak ilanları gibi tekrarlayan DOM kalıplarının otomatik tespiti (List/Grid tespiti).
- **Semantik Dışa Aktarım:** Bu verilerin başlık, açıklama, resim, fiyat gibi yapılandırılmış `dataset.json` veya `markdown/frontmatter` belgeleri olarak dışarı aktarılması (Bir siteyi bir WordPress/Strapi dump'ına çevirme).

## 5. Dinamik ve Obfuscated İçerik Koruması 
- **Font & WebGL Çıkarımı:** Sayfadaki `@font-face` tanımlarının yanı sıra, CSS-in-JS veya obfuscated JS içinde saklanan font dosyalarının base64 çözümlenmesi.
- **Akıllı URL Rewriter Pro:** Mevcut URL rewriter'ın geliştirilerek JS içindeki (Webpack chunk, dinamik import) gizlenmiş yolların (path) ve şifrelenmiş asset URL'lerinin statik AST (Abstract Syntax Tree) taramasıyla (SWC/Babel) bulunup değiştirilmesi.

---

## 🛠 Uygulama Yol Haritası (Sıradaki Adımlar)

### Aşama 1: Temel CDP Güçlendirmesi (Sıradaki İşlem)
- `src/main/browser/page-renderer.ts` içine Anti-Bot stealth scriptlerinin eklenmesi.
- `CrawlerEngine`'e otomatik scroll ve lazy-load bekleme mekanizmasının kurulması.

### Aşama 2: Shadow DOM & Veri Çıkarımı
- Klonlama sisteminin CDP DOM piercing yapacak şekilde revize edilmesi.
- Tekrarlayan veri (Structured Data) keşif modülünün `src/main/analyzers/` altına eklenmesi.

### Aşama 3: AI Component & Type Export
- Klonlanan HTML'i React/Tailwind bileşenlerine çeviren AI/AST motorunun eklenmesi.
- Kilitli/Auth gerektiren sayfalar için manuel login arayüzünün entegrasyonu.

> OP KANIT: Proje analiz edilmiş, Electron limitasyonları gözetilerek (Playwright eklenmeden) 77MB portable hedefini koruyan, tamamen CDP tabanlı `Ultimate` mimari dokümante edilmiştir.
