# WebClone Studio

<div align="center">

**High-Performance Web Architecture Extraction, Lossless Offline Mirroring & Reverse Engineering Workstation**

[![Platform](https://img.shields.io/badge/Platform-Windows%20x64%20(Setup%20%7C%20Portable%20%7C%20MSI)-06B6D4.svg?style=flat-square)](#)
[![Runtime](https://img.shields.io/badge/Electron-33.4-10B981.svg?style=flat-square)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6.svg?style=flat-square)](#)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?style=flat-square)](#)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-4.0-38BDF8.svg?style=flat-square)](#)
[![Auto--Update](https://img.shields.io/badge/Updates-GitHub%20Releases-F59E0B.svg?style=flat-square)](#)
[![License](https://img.shields.io/badge/License-MIT-A855F7.svg?style=flat-square)](#)

*Developed by Monolith Works | Published via MonarchDevLab*

<br/>

[ **English Documentation** ](#-english-documentation) &nbsp;&bull;&nbsp; [ **Türkçe Dokümantasyon** ](#-türkçe-dokümantasyon)

</div>

---

# English Documentation

## Overview

**WebClone Studio** is an enterprise-grade desktop workstation designed for web architects, reverse engineers, security researchers, and frontend developers. It transforms target web applications into complete offline archives, modular React 19 component libraries, and OpenAPI contracts.

The workstation combines native Chromium offscreen rendering with deep network interception, enabling the extraction of modern SPAs (Single Page Applications), SSR bundles, and dynamic Web Components with zero external driver dependencies.

---

## Architectural Highlights

### 1. Autonomous State Explorer
- **Interactive DOM Expansion:** Automatically discovers and safely simulates interactions on tabs (`[role="tab"]`), accordions (`.accordion-header`, `details summary`), and collapsible elements (`[aria-expanded="false"]`).
- **Hidden Dynamic States:** Uncovers hidden content, FAQ panels, and contextual menus before snapshotting the DOM tree.

### 2. Lossless Offline Mirroring & Fuzzy URL Engine
- **Declarative Shadow DOM:** Pierces closed and open Shadow Roots using Chromium native `getInnerHTML({ includeShadowRoots: true })`, capturing modern Web Components faithfully.
- **Fuzzy URL Normalization:** 5-tier fuzzy matching repairs relative URLs, query string variations, and anchor fragments (`#section`).
- **Dynamic Asset Scraper:** Recursively inspects CSS files for `@import`, font faces (`.woff2`, `.ttf`), background assets, and inline SVG sprites.
- **Obfuscation Bypass:** Static regex and AST analysis scan JavaScript bundles and Webpack/Vite chunks to extract hidden endpoints, asset paths, and dynamic base64 web fonts.

### 3. Frontend Reverse Engineering & Decompilation
- **SourceMap Virtual Tree:** Detects and reconstructs original frontend source code hierarchies (`site/_source-code/`) from production source maps.
- **Framework Hydration State:** Captures `window.__NEXT_DATA__`, `window.__NUXT_DATA__`, and SSR state payloads into `_meta/extracted-state.json`.
- **Design Tokens & Tailwind v4:** Scans `:root` CSS variables, active computed styles, and color palettes to generate `_meta/tailwind.config.js` and `_meta/design-tokens.json`.
- **Structured Data Mining:** Heuristically extracts repeating cards, grids, and list items into clean `_meta/structured-data.json`.
- **React 19 TSX Exporter:** Converts cloned HTML documents into clean, modular React functional components (`_components/Page_*.tsx`) with JSX class names, inline styles, and camelCased SVG attributes.

### 4. API Traffic Interception & OpenAPI 3.1 Contract Generator
- **Network Capture:** Hooks Chromium DevTools Protocol (CDP `Network` domain) to intercept all background XHR, Fetch, and JSON requests.
- **OpenAPI 3.1 Specification:** Automatically generates a comprehensive `_meta/openapi.json` (Swagger) contract from captured traffic.
- **Type-Safe TypeScript Definitions:** Infers JSON schemas and compiles ready-to-use TypeScript interfaces (`_meta/api-types.d.ts`).
- **Offline Mock Server:** Embedded 127.0.0.1 micro-server responds to AJAX calls using recorded JSON databases (`_meta/api-endpoints.json`).

### 5. SingleFile Standalone HTML Exporter
- Inlines CSS stylesheets, WOFF2 base64 web fonts, scripts, and media files directly into a 100% self-contained file (`_exports/index.standalone.html`).
- Eliminates the need for local web servers when sharing archives.

### 6. GitHub Auto-Update Hub
- Built-in update checker communicates with GitHub Releases API (`MonarchDevLab/WebClone-Studio/releases/latest`).
- Real-time notification in Settings with release notes and one-click installer downloads.

---

## Downloads & Installation (Windows x64)

Every release includes three distribution formats built for Windows:

| Format | File Name | Description |
| :--- | :--- | :--- |
| **Setup Installer** | `WebClone-Studio-Setup-1.0.0.exe` | Standard NSIS installer with desktop shortcut and uninstaller. |
| **Portable Edition** | `WebClone-Studio-Portable.exe` | Zero-install standalone binary. Runs directly without admin privileges. |
| **MSI Package** | `WebClone-Studio-1.0.0.msi` | Windows Installer package suitable for enterprise domain deployment. |

---

## Development & Build Pipeline

```bash
# Clone the repository
git clone https://github.com/MonarchDevLab/WebClone-Studio.git
cd WebClone-Studio

# Install dependencies
npm install

# Start development mode
npm run dev

# Type check
npm run typecheck

# Build all Windows packages (Setup, Portable, MSI)
npm run build:all
```

---

<br/>

# Türkçe Dokümantasyon

## Genel Bakış

**WebClone Studio**, web mimarları, tersine mühendislik uzmanları, güvenlik araştırmacıları ve frontend geliştiricileri için tasarlanmış kurumsal düzeyde bir masaüstü istasyonudur. Hedef web uygulamalarını eksiksiz çevrimdışı arşivlere, modüler React 19 bileşenlerine ve OpenAPI veri sözleşmelerine dönüştürür.

Uygulama; harici tarayıcı sürücülerine (Playwright, Puppeteer vb.) ihtiyaç duymadan, Electron'un dahili offscreen Chromium motoru ve Chrome DevTools Protokolü (CDP) üzerinden çalışır.

---

## Temel Mimari Yetenekler

### 1. Otonom Durum Gezgini (State Explorer)
- **Güvenli Etkileşimli Genişletme:** Sayfa içerisindeki sekmeleri (`[role="tab"]`), akordeon menüleri (`.accordion-header`, `details summary`) ve açılır alanları (`[aria-expanded="false"]`) otomatik tespit ederek tıklar ve açar.
- **Gizli Durumların Çıkarımı:** Sayfa DOM'u dondurulmadan önce gizli SSS blokları, sekmeler ve açılır menü içerikleri eksiksiz yakalanır.

### 2. Kayıpsız Çevrimdışı Klonlama & Akıllı URL Motoru
- **Declarative Shadow DOM:** Chromium'un `getInnerHTML({ includeShadowRoots: true })` API'si ile Shadow Root sınırlarını delerek modern Web Components yapılarını eksiksiz kaydeder.
- **Esnek URL Eşleme:** 5 kademeli eşleme algoritması; bağıl yolları, sorgu parametresi sapmalarını ve `#` çapa bağlantılarını yerel dosya sistemine onararak bağlar.
- **Dinamik Varlık Taraması:** CSS dosyalarını AST seviyesinde ayrıştırarak `@import`, font (`.woff2`, `.ttf`), görsel ve SVG sprite varlıklarını bulup indirir.
- **Obfuscation Bypass:** Minify edilmiş JavaScript ve Webpack/Vite chunk'larını tarayarak gizlenmiş asset yollarını ve dinamik font dosyalarını otomatik kurtarır.

### 3. Tersine Mühendislik & Frontend Dekompilasyonu
- **SourceMap Kaynak Ağacı Kurtarma:** Üretim ortamındaki `.map` dosyalarını analiz ederek orijinal kaynak kod hiyerarşisini (`site/_source-code/`) yeniden inşa eder.
- **Framework Hydration Durumu:** SSR/SPA sayfalarından `window.__NEXT_DATA__` ve `window.__NUXT_DATA__` verilerini çekip `_meta/extracted-state.json` içine birleştirir.
- **Tasarım Sistemi & Tailwind v4:** Canlı stillerden CSS değişkenlerini (`:root`), renk skalasını ve font ailelerini çıkararak `_meta/tailwind.config.js` ve `_meta/design-tokens.json` üretir.
- **Yapısal Veri Madenciliği:** Sayfalardaki liste ve kart bloklarını (Cheerio ile) analiz ederek `_meta/structured-data.json` olarak yapılandırır.
- **React 19 Bileşen İhracı:** Temizlenmiş HTML sayfalarını modern, tipli React fonksiyonel bileşenlerine (`_components/Page_*.tsx`) dönüştürür.

### 4. Ağ Trafiği Yakalama & OpenAPI 3.1 Sözleşme Üretimi
- **CDP Ağ İzleme:** Sayfa yüklenirken ve dolaşılırken arka planda yapılan tüm XHR, Fetch ve JSON isteklerini yakalar.
- **OpenAPI 3.1 Spesifikasyonu:** Yakalanan dinamik API trafiğinden otomatik `_meta/openapi.json` dosyası derler.
- **TypeScript Arayüzleri:** Yanıt gövdelerinden otomatik JSON şema analizi yaparak frontend için hazır `_meta/api-types.d.ts` modellerini üretir.
- **Çevrimdışı Mock Sunucusu:** Yerleşik 127.0.0.1 mikro sunucusu, kaydedilen API veritabanını (`_meta/api-endpoints.json`) kullanarak internet olmadan da dinamik yanıtlara cevap verir.

### 5. Bağımsız Tek Dosya Arşivleyici (SingleFile)
- Tüm CSS, JS, WOFF2 font ve görselleri Base64 veri formatında HTML içine gömerek harici klasör ve sunucu gerektirmeyen `_exports/index.standalone.html` dosyasını oluşturur.

### 6. GitHub Güncelleme Merkezi
- Uygulama içi Ayarlar menüsünden tek tıkla GitHub Releases API'si (`MonarchDevLab/WebClone-Studio`) sorgulanır.
- Yeni sürüm çıktığında sürüm notları, yayın tarihi ve doğrudan indirme bağlantıları listelenir.

---

## Kurulum ve İndirme Seçenekleri (Windows x64)

Her sürüm için üç farklı Windows paketi derlenir:

| Paket Türü | Dosya Adı | Açıklama |
| :--- | :--- | :--- |
| **Setup Kurulum** | `WebClone-Studio-Setup-1.0.0.exe` | Masaüstü ve Başlat menüsü kısayollarını oluşturan tam NSIS kurulumu. |
| **Portable Sürüm** | `WebClone-Studio-Portable.exe` | Kurulum gerektirmeyen, yönetici yetkisi istemeyen taşınabilir tek dosya. |
| **MSI Kurulumu** | `WebClone-Studio-1.0.0.msi` | Kurumsal ağlar ve grup ilkeleri (GPO) için standart Windows Installer paketi. |

---

## Geliştirici Kılavuzu & Derleme

```bash
# Projeyi klonlayın
git clone https://github.com/MonarchDevLab/WebClone-Studio.git
cd WebClone-Studio

# Bağımlılıkları yükleyin
npm install

# Geliştirme sunucusunu başlatın
npm run dev

# Tip kontrolü
npm run typecheck

# Tüm Windows kurulum paketlerini üretin (Setup, Portable, MSI)
npm run build:all
```

---

## Lisans ve Mimari Kimlik

Bu proje ve tüm mimari mülkiyet hakları **Monolith Works** kuruluşuna aittir.  
Resmi yayınlama kanalı: **MonarchDevLab**.

Lisans: **MIT License**.
