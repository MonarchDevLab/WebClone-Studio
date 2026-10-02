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
- **Fonts:** Inter (UI gövde/başlık, 400-700 tek değişken dosya, offline gömülü), JetBrains Mono (sayısal veriler, metrikler, kod ve log akışı, 400-500 tek değişken dosya, offline gömülü) — `src/renderer/src/assets/fonts/*.woff2` (latin + latin-ext, Türkçe karakter desteği için ikisi de gerekli), `@font-face` ile CDN'siz yükleniyor.
- **Disiplin notu:** Tüm renkler bu 5 semantik token (accent/secondary/success/warning/error) + nötrler üzerinden ifade edilir. JSX'te `bg-[#hex]` veya Tailwind stok `cyan-400`/`purple-500` gibi ham/off-token sınıf YAZILMAZ.

## Teknoloji Yığını
- **Shell / Runtime:** Electron 33 + Node.js 22
- **Build & Dev:** electron-vite 3 + Vite 6 + TypeScript 5.8
- **Browser / DOM Rendering:** Yerleşik Electron Offscreen `PageRenderer` + Chrome DevTools Protocol (CDP Network & Page domain)
- **Frontend:** React 19, Tailwind CSS 4, Lucide React, Zustand 5, Sonner, React Resizable Panels
- **Scraping & Parsing:** got (v14), cheerio (v1), postcss, robots-parser, sanitize-filename
- **Storage:** Node `fs/promises` + JSON kalıcı store (`SettingsStore`, `ProjectStore`)
- **Packaging:** electron-builder 25 (Windows Setup .exe, Portable .exe, MSI .msi)
- **Auto-Update:** In-App GitHub Releases Update Hub (`UpdateChecker` servisi)
- **Developer & Architecture:** Monolith Works / MonarchDevLab

## Modül Sınırları & Mimarisi
```
src/
├── main/
│   ├── analyzers/      # TechDetector, DesignAnalyzer, SiteMapper, SecurityScanner, SizeEstimator, StructuredDataExtractor
│   ├── browser/        # PageRenderer (Offscreen Chromium, Autonomous State Explorer, Stealth CDP)
│   ├── cloner/         # CrawlerEngine, PageProcessor, AssetDownloader, UrlRewriter, FileOrganizer
│   │   └── reverse-engineering/ # SourcemapReconstructor, FrameworkExtractor, TokenExtractor, ApiInterceptor
│   ├── generators/     # ApiContractGenerator (OpenAPI 3.1 & TS), ComponentExporter (React TSX), SingleFileExporter, SystemMapGenerator
│   ├── output/         # ManifestGenerator, ReadmeGenerator, ReportGenerator
│   ├── server/         # PreviewServer (127.0.0.1 hafif HTTP statik ve mock API sunucusu)
│   ├── services/       # UpdateChecker (GitHub Releases sürüm denetimi ve güncelleme servisi)
│   ├── storage/        # SettingsStore (userData/settings.json), ProjectStore (manifest.json tarayıcı)
│   ├── index.ts        # App lifecycle & Window management
│   ├── window.ts       # BrowserWindow fabrika
│   └── ipc-handlers.ts # IPC request/response & event dispatcher
├── preload/
│   └── index.ts        # Context bridge API (window.electronAPI)
├── renderer/
│   └── src/
│       ├── components/ # UI (Sidebar, UrlInput, StatusBar, TitleBar, CloneSetupModal, ErrorBoundary)
│       ├── layouts/    # MainLayout (Resizable panels)
│       ├── pages/      # OverviewPage, TechStackPage, SiteMapPage, ClonePage, SettingsPage (Update Hub)
│       ├── stores/     # Zustand stores (ui-store, analyze-store, clone-store, project-store)
│       └── hooks/      # useIpc
└── shared/
    ├── types.ts        # Ortak TypeScript arayüzleri ve tipler (Tek Doğruluk Kaynağı)
    └── ipc-channels.ts # IPC kanal tanımları
```
