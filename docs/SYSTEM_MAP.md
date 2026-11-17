# SYSTEM MAP

## Design Tokens (Kalıcı - Yönetim Merkezi Teması, `src/renderer/src/styles/globals.css` `@theme` TEK KAYNAK)
- **Canvas:** `#08090C` | **Surface 1:** `#0B0D13` | **Surface 2:** `#10131B` | **Surface 3:** `#181C28` | **Overlay:** `#141724`
- **Accent (Siyan, birincil aksiyon):** `#06B6D4` | **Accent Hover:** `#22D3EE`
- **Secondary (Mor, ikincil vurgu):** `#A855F7` | **Secondary Hover:** `#C084FC`
- **Success (Zümrüt):** `#10B981` | **Success Hover:** `#34D399`
- **Warning (Amber):** `#F59E0B` | **Warning Hover:** `#FBBF24`
- **Error (Gül):** `#F43F5E` | **Error Hover:** `#FB7185`
- **Info:** `#06B6D4` (accent ile aynı)
- **Text Primary:** `#F4F4F5` | **Secondary:** `#A1A1AA` | **Muted:** `#71717A` | **Dim:** `#52525B`
- **Borders:** `rgba(255, 255, 255, 0.07)` (subtle) / `rgba(255, 255, 255, 0.12)` (medium) / `rgba(6, 182, 212, 0.50)` (focus)
- **Fonts:** Inter (UI gövde/başlık, 400-700 tek değişken dosya, offline gömülü), JetBrains Mono (sayısal veriler, metrikler, kod ve log akışı, 400-500 tek değişken dosya, offline gömülü): `src/renderer/src/assets/fonts/*.woff2` (latin + latin-ext), `@font-face` ile CDN olmadan yüklenir.
- **Brand Identity & Assets:** 3D Cyber-Spider Crawler Bot (Bağımsız mekanik titanyum siber örümcek, neon siyan veri küresi ve lazer ağ matriksi). Varlıklar: `resources/icon.png` (1024x1024 RGBA), `resources/icon-256.png`, `resources/icon.ico` (16..256px multi-layer ICO), `src/renderer/src/assets/logo-64.png` (64x64 RGBA, 6.9 KB), `resources/banner.png`, `resources/ui_showcase.png`.
- **Disiplin notu:** Tüm renkler `@theme` içindeki 5 semantik token (`accent`, `secondary`, `success`, `warning`, `error`) ve nötr yüzeyler üzerinden ifade edilir.

## Teknoloji Yığını (v2.0.0)
- **Shell / Runtime:** Electron 45.3.2 (Chromium 156, Node.js 24.22, yerleşik `node:sqlite`)
- **Build & Dev:** electron-vite 5 + Vite 6 + TypeScript 5.8
- **Browser / HTTP Engine:** BoringSSL Chromium `session.fetch` (`HttpClient`), domain-izole `SessionManager`, sıcak `WindowPool` ve `PageRenderer` (`getHTML({ serializableShadowRoots: true })`, CDP Network/Page)
- **Frontend:** React 19 (`React.lazy` + `manualChunks`), Tailwind CSS 4, Lucide React, Zustand 5, Sonner, React Resizable Panels, WCAG 2.2 AA (`tablist`/`useFocusTrap`)
- **Scraping & Parsing:** `cheerio/slim`, `robots-parser`, `sanitize-filename`, `source-map`, `bottleneck`
- **Storage:** Yerleşik `node:sqlite` (`DatabaseSync` WAL `CrawlCheckpointDb`), `SettingsStore`, `ProjectStore`
- **Packaging:** electron-builder 26 (Windows Portable/Setup/MSI, macOS DMG, Linux AppImage; `asarUnpack` `mappings.wasm`)
- **Developer & Architecture:** Monolith Works / MonarchDevLab

## Modül Sınırları ve Mimarisi
```
src/
├── main/
│   ├── security/       # url-guard (SSRF/DNS/IPv6), path-guard (realpath/kök kilidi), ipc-guard (gönderici doğrulama)
│   ├── analyzers/      # TechDetector, TechSignatures, DesignAnalyzer (CSS Color 4 + luminans), SiteMapper (nested XML), SecurityScanner, SizeEstimator, AdaptiveExtractor
│   ├── browser/        # SessionManager, HttpClient (BoringSSL session.fetch), WindowPool, PageRenderer, stealth-scripts
│   ├── cloner/         # CrawlerOrchestrator, PageWorker, CloneFinalizer, PageProcessor, AssetDownloader, UrlRewriter, FileOrganizer
│   │   └── reverse-engineering/ # SourcemapReconstructor, FrameworkExtractor (__next_f RSC), TokenExtractor (Tailwind v4 @theme), ApiInterceptor
│   ├── generators/     # WaczExporter (saf-TS WACZ 1.1.1), ApiContractGenerator (OpenAPI 3.1 & TS), ComponentExporter (multi-landmark TSX), SingleFileExporter, SystemMapGenerator
│   ├── output/         # ManifestGenerator, ReadmeGenerator, ReportGenerator
│   ├── server/         # PreviewServer (127.0.0.1 HTTP + /_sw-replay.js SW + HTTP 206 Range + mock API) + sw-replay-script
│   ├── services/       # UpdateChecker (GitHub Releases sürüm denetimi)
│   ├── storage/        # CrawlCheckpointDb (node:sqlite WAL), SettingsStore, ProjectStore
│   ├── ipc/            # Modular domain routers (analyze, clone, project, preview, artifacts, settings, context, index)
│   ├── index.ts        # App lifecycle, CSP & cleanup
│   └── window.ts       # BrowserWindow fabrika (navigation & popup guards)
├── preload/
│   └── index.ts        # En az yetki prensipli ContextBridge API (ham send/invoke yok)
├── renderer/
│   └── src/
│       ├── components/ # Sidebar, UrlInput, StatusBar, TitleBar, CommandPaletteModal, ErrorBoundary, explorer/*, modal/steps/*, overview/*
│       ├── layouts/    # MainLayout (Resizable panels)
│       ├── pages/      # OverviewPage, TechStackPage, SiteMapPage, ClonePage, ArtifactExplorerPage (6 alt sekme), SettingsPage
│       ├── stores/     # ui-store, analyze-store, clone-store, project-store
│       └── hooks/      # useIpc (100ms batch), useFocusTrap
└── shared/
    ├── version.ts      # Tekil sürüm, ürün adı ve Chrome 156 UA üreticisi
    ├── format.ts       # Ortak bayt ve süre biçimleyiciler
    ├── validators.ts   # URL, domain ve ayar doğrulayıcılar
    ├── types.ts        # Paylaşılan TypeScript sözleşmeleri
    └── ipc-channels.ts # IPC kanal sabitleri
```
