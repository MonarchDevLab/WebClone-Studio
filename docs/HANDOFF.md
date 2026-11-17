# HANDOFF

## Anlık Durum
WebClone Studio v2.0.0 kapsamlı mimari dönüşüm planı (Faz 0..7) tamamlandı, birim/entegrasyon ve gerçek Electron 45 Playwright E2E testlerinden geçti ve `WebClone-Studio-Portable.exe` canlı süreç testiyle doğrulandı.

1. **Çalışma Zamanı ve Ağ/Tarayıcı Mimarisi (`WP-0`, `WP-2`):**
   - **Electron 45.3.2 & Node 24.22:** `electron-vite` 5, `electron-builder` 26 ve yerleşik `node:sqlite` (`DatabaseSync`) üzerine kurulu sıfır harici C++ (`node-gyp`) eklentili mimari.
   - **BoringSSL `session.fetch` (`src/main/browser/http-client.ts` & `session-manager.ts`):** `got` tamamen kaldırıldı (`0` kullanım); tüm statik indirmeler ve önizlemeler domain-izole Chromium session partition'ları (`persist:webclone_<sha256>`) üzerinden TLS JA4 uyumlu olarak yapılır.
   - **Sıcak `WindowPool` & `PageRenderer`:** En fazla 3 adet offscreen BrowserWindow yeniden kullanılır; Declarative Shadow DOM `getHTML({ serializableShadowRoots: true })`, CDP `Network.requestWillBeSent` + `loadingFinished` tam payload yakalama, deterministik parmak izi temizliği (`stealth-scripts.ts`) ve compositor zaman aşımı koruması içerir.

2. **Güvenlik Sertleştirmesi (`WP-1`):**
   - **Zero-Trust Muhafızları (`src/main/security/`):** SSRF/DNS-rebinding/link-local koruması (`url-guard.ts`, `will-redirect` dahil), kanonik `realpath` + silme kilidi (`path-guard.ts`), sender origin doğrulaması (`ipc-guard.ts`).
   - **En Az Yetki Preload & CSP:** `src/preload/index.ts` içinden ham `send`/`invoke`/`on`/`removeListener` kaldırıldı; `window.ts` içinde `setWindowOpenHandler` ve `will-navigate` kilitlendi; `SingleFileExporter` ve `PreviewServer` `assertInsideRoot` ile korundu.

3. **Dayanıklılık, Çökme Kurtarma ve Klonlama Sadakati (`WP-3`, `WP-4`):**
   - **`CrawlCheckpointDb` (`node:sqlite` WAL):** `crawl_runs`, `url_queue`, `assets`, `api_mocks` ve `crawl_diffs` tabloları ile yarıda kalan klonlamaları kurtarır ve ETag/`If-None-Match` + SHA-256 artımlı fark (`MODIFIED`/`ADDED`/`REMOVED`/`unchanged`) raporlar.
   - **Modüler Motor & IPC:** `CrawlerOrchestrator` / `PageWorker` / `CloneFinalizer` ayrıştırıldı; IPC kanalları `src/main/ipc/*.ipc.ts` yönlendiricilerine bölündü (`100 ms` toplu `CLONE_TELEMETRY_BATCH`).
   - **Çevrimdışı Replay & WACZ 1.1.1:** `/_next/image`, `/_ipx`, `/cdn-cgi/image` için kanonik sorgu/MIME ayrımı, göreli ESM modül yolu koruması, `[data-bg]`/`[data-background]` CSS rewrite, `/_sw-replay.js` Service Worker, HTTP `206 Partial Content` Range streaming ve saf-TS WACZ 1.1.1 arşivleyici (`WaczExporter`) eklendi.

4. **Analizörler, Üreticiler ve İş İstasyonu UI/UX (`WP-5`, `WP-6`):**
   - Ağ tekrarsız `TechDetector` (`skipNetworkFallback`), `<sitemapindex>` + hiyerarşik `SiteMapper`, CSS Color 4 (`oklch`/`oklab`/`display-p3`) + luminans rol sınıflandırması, Tailwind v4 `@theme` (`_meta/tokens.theme.css`), çok-bölümlü `ComponentExporter`, asenkron `_up_/` `SourcemapReconstructor` ve Next.js `__next_f` RSC çıkarımı.
   - 6 sekmeli `ArtifactExplorerPage` + 5 modüler alt panel, `React.lazy` + `manualChunks` (giriş JS `66.90 KB`), `< 10 KB` `logo-64.png` (`6.93 KB`) ve WAI-ARIA `tablist` + `useFocusTrap` WCAG 2.2 AA erişilebilirliği.

5. **Ölçülen Çıktılar ve Paketleme (Faz 7 Doğrulaması):**
   - **Testler:** `npm test` (24 dosya, 66 test geçti) ve `npm run test:e2e` (Playwright `_electron` 2/2 geçti).
   - **Boyutlar:** `out/main/index.js` `330.80 KB`, `out/preload/index.js` `5.79 KB`, `app.asar` `2.24 MB` (v1.1.0 `9.50 MB` düzeyinden %76.4 küçülme), `dist/WebClone-Studio-Portable.exe` `98.53 MB` (Chromium 156 upstream `dxcompiler.dll` `24.59 MB` ve `WebClone Studio.exe` `238.55 MB` tabanı nedeniyle).
   - **Canlı Çalıştırma:** `dist/WebClone-Studio-Portable.exe` gerçek Windows süreci olarak 6 saniye boyunca çökmeden (`HAS_EXITED_AT_6S=False`, 5 canlı alt süreç) doğrulandı.

## Kritik Komutlar
- Development: `npm run dev`
- Typecheck: `npm run typecheck`
- Unit & Integration Tests: `npm test`
- Playwright Electron E2E: `npm run test:e2e`
- Production Bundle: `npm run build`
- Portable Package: `npm run build:portable`
- All Windows Packages: `npm run build:all`

## Commit Zinciri (Dal: `feat/v2-architecture-overhaul`)
- `93b8207` `feat(renderer): add 6-tab ArtifactExplorerPage, lazy code splitting, batched telemetry, and WCAG 2.2 AA dialogs`
- `70b4fb7` `feat(analyzers,generators): upgrade CSS Color 4 tokens, multi-landmark TSX, RSC state, and nested sitemaps`
- `a46e7cf` `feat(cloner,archive): add query/MIME proxy fidelity, /_sw-replay.js SW, HTTP 206 Range, and pure-TS WACZ 1.1.1`
- `7134827` `refactor(cloner,ipc): add node:sqlite WAL checkpointing and split monolith modules`
- `7df562d` `feat(browser): unify BoringSSL session.fetch HttpClient, warm WindowPool, and remove got`
- `70757de` `fix(security): enforce SSRF, realpath, CSP, and least-privilege preload guards`
- `c2a533b` `build(runtime): upgrade to electron 45 and unify shared contracts`

## Riskler
- Yok.
