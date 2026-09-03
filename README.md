# WebClone Studio

<div align="center">

**High-Performance Architecture Extraction & Lossless Offline Web Mirroring Engine**

[![Platform](https://img.shields.io/badge/Platform-Windows%20x64%20(Portable)-06B6D4.svg?style=flat-square)](#)
[![Runtime](https://img.shields.io/badge/Electron-33.4-10B981.svg?style=flat-square)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6.svg?style=flat-square)](#)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?style=flat-square)](#)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-4.0-38BDF8.svg?style=flat-square)](#)
[![License](https://img.shields.io/badge/License-Proprietary-A855F7.svg?style=flat-square)](#)

*Developed & Maintained by Monolith Works & MonarchDevLab*

</div>

---

## 📌 Overview

**WebClone Studio** is an enterprise-grade desktop workstation designed for web architects, reverse engineers, and frontend developers. It provides dual capabilities:

1. **Lossless Offline Mirroring:** Crawls, resolves, and rewrites modern dynamic and static web applications for 100% offline fidelity, handling responsive images (`srcset`), CSS font/background discovery, and fuzzy link normalization.
2. **Architectural System Map Extraction:** Dissects live web applications into comprehensive, structured Markdown (`SYSTEM_MAP.md`) specifications—extracting CSS custom properties (`:root`), typography scales, color palettes, shadow elevations, container grids, and component blueprints.

---

## ⚡ Key Architectural Capabilities

### 🔍 1. Six-Layer Technology Fingerprinting
- **Layer 1 - HTTP Response Headers:** Server software, edge proxies, caching directives, security policies (`CSP`, `HSTS`, `X-Frame-Options`).
- **Layer 2 - Session & Cookie Tokens:** Framework session signatures, analytics identifiers, CSRF indicators.
- **Layer 3 - Meta Tags & OpenGraph:** CMS generators, site verification keys, structured schema.
- **Layer 4 - DOM Node Heuristics:** Root containers (`#__next`, `#root`, `[data-reactroot]`), data attributes, framework-specific class patterns.
- **Layer 5 - Script Source Signatures:** Bundler footprints (Webpack, Vite, Turbopack, Rollup), library CDNs, runtime tags.
- **Layer 6 - Global Runtime Scope:** Browser window objects (`window.__NEXT_DATA__`, `window.Vue`, `window.angular`).

### 📦 2. Lossless Crawler Engine & Fuzzy URL Normalization
- **Isolated Routing:** Alt-routes (`/company/about/`) are safely mapped to `company/about/index.html`, eliminating root file overwrite hazards.
- **Dynamic Query Hashing:** Query strings are preserved through non-colliding MD5 tokens (`page_a1b2c3d4.html`).
- **CSS AST & Regex Extraction:** Recursively analyzes external stylesheets to discover `@import`, embedded font files (`.woff2`, `.ttf`), and SVG sprite sheets.
- **Fuzzy URL Rewriting:** 5-tier fuzzy matching algorithm repairs relative URLs, query deviations, anchor fragments (`#section`), and lazy-loaded attributes (`data-src` -> `src`).

### 📐 3. System Map & Blueprint Specification Engine
- Generates a production-ready `SYSTEM_MAP.md` covering:
  - Exact `:root` CSS variables and design tokens.
  - WCAG AA/AAA contrast ratio validations.
  - Box-shadows, border-radii, and backdrop blur matrices.
  - ASCII hierarchical site navigation trees.
  - Drop-in React 19 / Tailwind CSS scaffold templates (`Navbar.tsx`, `Hero.tsx`, `globals.css`).

### 🖥️ 4. Native Chromium Headless Engine (No External Drivers)
- Replaces heavy external automation frameworks (e.g., Playwright/Puppeteer) with Electron's internal Chromium engine (`offscreen: true, webSecurity: true, sandbox: true`).
- Zero browser driver downloads; completely self-contained in a single executable.

### 🌐 5. Integrated Micro Preview Server (127.0.0.1)
- Bundles an embedded Node.js HTTP preview server to bypass browser `file:///` CORS and relative asset restrictions.
- Launches cloned sites on dynamic local ports with MIME type resolution and path traversal security guards.

---

## 🏗️ Architecture & Module Boundaries

```
src/
├── main/
│   ├── analyzers/      # TechDetector, DesignAnalyzer, SiteMapper, SecurityScanner, SizeEstimator
│   ├── browser/        # PageRenderer (Isolated offscreen Chromium BrowserView)
│   ├── cloner/         # CrawlerEngine, PageProcessor, AssetDownloader, UrlRewriter, FileOrganizer
│   ├── generators/     # SystemMapGenerator (Markdown architectural system map)
│   ├── output/         # ManifestGenerator, ReadmeGenerator, ReportGenerator
│   ├── server/         # PreviewServer (127.0.0.1 lightweight static HTTP server)
│   ├── storage/        # SettingsStore (LOCALAPPDATA JSON), ProjectStore (Manifest indexer)
│   ├── index.ts        # App lifecycle & multi-window coordinator
│   ├── window.ts       # BrowserWindow factory & secure webPreferences
│   └── ipc-handlers.ts # IPC request/response bridge & event streams
├── preload/
│   └── index.ts        # Context-isolated bridge API (window.electronAPI)
├── renderer/
│   └── src/
│       ├── components/ # Workstation UI (Sidebar, UrlInput, StatusBar, TitleBar, CloneSetupModal)
│       ├── layouts/    # MainLayout (Resizable split-pane system)
│       ├── pages/      # OverviewPage, TechStackPage, SiteMapPage, ClonePage, SettingsPage
│       ├── stores/     # Zustand state stores (ui, analyze, clone, project)
│       └── hooks/      # IPC subscription hooks
└── shared/
    ├── types.ts        # Single source of truth TypeScript domain interfaces
    └── ipc-channels.ts # Type-safe IPC channel enumerations
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 20.x
- npm >= 10.x
- Windows 10/11 x64

### Installation
```bash
# Clone the repository
git clone https://github.com/MonarchDevLab/Web-clone.git
cd Web-clone

# Install dependencies
npm install
```

### Development
```bash
# Start Vite dev server with Electron hot reloading
npm run dev
```

### Code Quality & Validation
```bash
# Run TypeScript compilation check
npm run typecheck

# Build renderer and main bundles
npm run build
```

### Packaging Windows Portable Binary
```bash
# Produce standalone Windows x64 portable executable (dist/WebClone-Studio-Portable.exe)
npm run build:portable
```

---

## 🔒 Security & Data Integrity

- **Environment Isolation:** Zero reliance on hardcoded local directories. All project caches and user preferences resolve dynamically through `$env:LOCALAPPDATA` and native shell path redirections.
- **Anti-Leak Build Pipeline:** Strict bundling filters reject any `.env*`, `.pem`, `.key`, or secret files during package assembly.
- **Path Traversal Guard:** Both file organizers and preview servers validate paths using `path.relative` boundaries to prevent directory escape attacks.
- **IPC Lifecycle Shield:** All inter-process communication listeners implement `sender.isDestroyed()` checks to guard against window destruction race conditions.

---

## 📄 License & Attribution

Copyright © 2026 **Monolith Works & MonarchDevLab**. All rights reserved.

Proprietary enterprise software engineered for professional architectural analysis and web data archiving.
