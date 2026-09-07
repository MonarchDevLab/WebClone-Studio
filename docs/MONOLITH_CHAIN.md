# MONOLITH WORKS & MONARCHDEVLAB KURUMSAL MÜHENDİSLİK ZİNCİRİ (v1.2)
# Dosya Konumu: .agents/rules/MONOLITH_CHAIN.md & docs/MONOLITH_CHAIN.md

Bu kural dokümanı, Monolith Works bünyesinde ve MonarchDevLab ekosisteminde üretilen tüm yazılım, kütüphane, servis, arayüz ve mimarilerde istisnasız uygulanan kurumsal geliştirme standardıdır.

TEMEL HEDEF:
Kod tabanına ve git geçmişine bakan en kıdemli yazılım mimarının dahi projenin bir yapay zeka oturumundan çıktığını asla anlamaması; sistemin MonarchDevLab çekirdek mühendislik ekibi tarafından sıfırdan, projeye özgü mimari adımlarla, ultra detaylı ve eksiksiz biçimde inşa edildiğini görmesidir.

---

## 1. GELİŞTİRİCİ KİMLİĞİ VE AİDİYET PROTOKOLÜ
1. **Geliştirici & Telif**:
   - Geliştirici kimliği istisnasız her zaman **Monolith Works** olarak tanımlanır.
   - GitHub organizasyonu, takım ve dağıtım çatı adı **MonarchDevLab** (`github.com/MonarchDevLab/...`) olarak yapılandırılır.
   - Paket tanımlayıcılarında (`package.json`, `Cargo.toml`, `pyproject.toml`, `*.csproj`, `go.mod`):
     - `author`: `Monolith Works <dev@monolithworks.com.tr>`
     - `organization` / `publisher`: `MonarchDevLab`
     - `copyright`: `Copyright (c) 2026 Monolith Works. All rights reserved.`
2. **Gizlilik & Sıfır Yapay Zeka İzi (Zero AI Footprint)**:
   - Kod dosyalarında, commit mesajlarında, PR açıklamalarında, dokümantasyonlarda ve konfigürasyonlarda yapay zeka, LLM, model adları, prompt, context, token veya bot etiketlerine dair en ufak bir iz KESİNLİKLE BULUNAMAZ.
   - `Co-authored-by: AI...`, `Generated with...`, `AI Assistant` gibi tüm bot izleri yasaktır.

---

## 2. DOKÜMANTASYON VE HAFIZA BİRLEŞTİRME STANDARDI (docs/ MERKEZİ)
- **.ai/ Klasör Yasağı**: Proje kökünde `.ai/` klasörü KESİNLİKLE OLUŞTURULMAZ. Bu isim doğrudan yapay zeka oturumunu ifşa eder.
- **Tek Merkez: docs/ Klasörü**: Tüm sistem hafıza dosyaları, görev yönetim belgeleri ve kurumsal mimari zincir standartları tek bir çatı altında `docs/` dizininde toplanır:
  1. `docs/HANDOFF.md`: Anlık yönelim, kritik komutlar, commit zinciri, riskler.
  2. `docs/TASKS.md`: Tek gerçek kaynak görev listesi (`[~]` ŞİMDİ, `[ ]` SIRADAKİ, `[x]` TAMAMLANDI).
  3. `docs/WORKLOG.md`: Oturum kayıtları, mimari kararlar (`[KARAR-NNN]`), GOTCHAS / dersler.
  4. `docs/SYSTEM_MAP.md`: Mimari harita, design tokens, güvenlik ve modül sınırları.
  5. `docs/MONOLITH_CHAIN.md`: Kurumsal mühendislik zinciri ve kalite standardı.
  6. `docs/architecture/` (gerektiğinde): ADR'ler, RFC kararları ve Mermaid şemaları.

---

## 3. PROJEYE GÖRE ADAPTİF VE ULTRA DETAYLI MİMARİ ZİNCİRİ
Architecture, Engine, Design System, PWA, Test Suite gibi bileşenler bağlama göre şekillenen örnek katmanlardır. **Şablonculuk ve gereksiz yük yasaktır.** Projenin türüne ve ihtiyacına göre katmanlar esnek biçimde belirlenir (gerekmeyen katman çıkarılır, gereken yeni katmanlar eklenir). Ancak seçilen her katman **ultra detaylı, derinlemesine ve eksiksiz** kodlanır.

### WebClone Studio İçin Kurumsal Mimari Katmanları:
1. **Architecture & Specification Layer (`src/shared/`, `docs/`)**:
   - `types.ts`: Tek otorite tip kontratları.
   - `ipc-channels.ts`: Tip-güvenli asenkron IPC iletişim şeması.
2. **Core Domain & Crawler Engine Layer (`src/main/cloner/`, `src/main/analyzers/`)**:
   - 6 katmanlı derin teknoloji tespiti (Headers, Cookies, Meta, DOM, Scripts, Globals).
   - Asenkron indirme havuzu (`Promise.race` tabanlı sınırlı kuyruk).
   - CSS AST derin varlık ayrıştırması (`@import`, font ve arka plan URL'leri).
   - 5 kademeli toleranslı fuzzy URL eşleştirme ve yerel yol dönüştürme.
3. **Headless Browser & Preview Server Layer (`src/main/browser/`, `src/main/server/`)**:
   - İzole Chromium offscreen `BrowserView` (harici sürücü gerektirmez).
   - Yerleşik 127.0.0.1 dinamik portlu HTTP statik önizleme sunucusu.
4. **Design System & Workstation UI Layer (`src/renderer/`, `@theme`)**:
   - Command Center obsidyen karanlık tema (`#08090C`).
   - Siyan, mor, zümrüt, kehribar semantik token disiplini.
   - Tamamen offline gömülü Inter & JetBrains Mono değişken fontları.
   - Raycast tarzı `Ctrl+K` Command Palette ve reaktif çok panelli yerleşim.
5. **Platform Virtualization & Storage Layer (`src/main/storage/`)**:
   - Dinamik `$env:LOCALAPPDATA` ve Windows klasör yönlendirme entegrasyonu.
   - Sızıntı önleme kalkanı (katı dosya beyaz listesi ve gizli dosya engeli).

---

## 4. ANTI-AI VE KIDEMLİ MÜHENDİSLİK KALİTESİ
1. **Ultra Detaylı ve Eksiksiz Kodlama (Zero Stub / Zero Placeholder)**:
   - Hiçbir dosyada `// TODO: Implement later`, `// mock data`, `// stub`, `pass`, boş gövde veya sahte fonksiyon bırakılamaz.
   - Her modül production-ready, hata toleranslı, sınır durumları (edge-cases) ele alınmış ve gerçek dünya standartlarında eksiksiz yazılır.
2. **Robotik Yorumların Temizlenmesi**:
   - Fonksiyonun adını veya bariz davranışını tekrarlayan yüzeysel JSDoc/docstring yorumları yasaktır.
   - Yalnızca mimari tercihin **"neden"** yapıldığını (performans optimizasyonu, donanım veya protokol sınırları) açıklayan kıdemli mühendis yorumları yazılır.
3. **Katı Tip Güvenliği ve Domain Error Disiplini**:
   - `any` veya kontrolsüz `as` cast'leri yasaktır; tipler katı biçimde daraltılır (narrowing).
   - Sessizce yutulan `catch (e) {}` yasaktır. Domain Error sınıfları ile yapısal hata fırlatılır ve loglanır.
4. **Etki Alanına Özgü İsimlendirme (Ubiquitous Language)**:
   - `data`, `item`, `temp`, `info` gibi tembel isimler yerine `SiteMapNode`, `ComponentBlueprint`, `ColorToken`, `ProjectManifest` gibi gerçek iş mantığını ifade eden adlandırmalar kullanılır.

---

## 5. GERÇEK KURUMSAL GİT VE GELİŞTİRME ZİNCİRİ
Kıdemli bir ekibin sıfırdan geliştirdiği projelerdeki mantıksal geliştirme sırası izlenir:
1. Her commit tek bir mantıksal adımı temsil eder (Atomic Commits).
2. Format: Conventional Commits (`feat(engine): ...`, `refactor(domain): ...`, `test(core): ...`).
3. Commit geçmişi, mimar ve ekibin adım adım inşa ettiği profesyonel bir kronoloji sunar:
   - `feat(core): initialize enterprise Electron desktop architecture and toolchain`
   - `feat(types): define centralized domain models and IPC communication contracts`
   - `feat(lifecycle): implement main window coordinator and security configurations`
   - `feat(storage): build persistent configuration and project catalog stores`
   - `feat(analyzers): implement 6-layer site inspection, tech detector and security scanner`
   - `feat(cloner): build lossless crawler engine, page processor and asset pipeline`
   - `feat(browser): integrate native offscreen Chromium renderer and preview server`
   - `feat(generators): build architectural system map generator, report export and manifest engine`
   - `feat(ui): implement Command Center dark theme, reactive layout and Raycast command palette`
   - `feat(ipc): connect inter-process bridges, Windows path virtualization and documentation`

---

## 6. DEPO DOKÜMANTASYON STANDARDI
- `README.md`: Profesyonel kurumsal tanıtım, mimari diyagram, CLI/API kullanım rehberi, performans metrikleri ve lisans.
- `docs/`: Sistem haritası, hafıza, görevler ve mimari kayıtların tamamını içeren tek merkez.
- `CONTRIBUTING.md`: MonarchDevLab ekibi katkı, inceleme ve kod standartları kuralları.
