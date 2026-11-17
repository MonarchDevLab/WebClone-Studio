import { ProjectManifest } from '../../shared/types';
import { APP_NAME, APP_ORG_SIGNATURE, APP_TAGLINE_TR, APP_VERSION } from '../../shared/version';

/**
 * Generates the offline project summary README.md placed in each cloned project's root folder.
 */
export class ReadmeGenerator {
  public static generate(manifest: ProjectManifest): string {
    const techList =
      manifest.technologies.length > 0
        ? manifest.technologies
            .map(
              (t) =>
                `- **${t.category}:** ${t.name}${t.version ? ` (${t.version})` : ''} - %${t.confidence} güven`
            )
            .join('\n')
        : '- Belirgin teknoloji imzası tespit edilemedi.';

    const fileIndexList = Object.entries(manifest.fileIndex)
      .map(
        ([key, val]) =>
          `- **${key.toUpperCase()}:** ${val.count} dosya (${(val.sizeBytes / (1024 * 1024)).toFixed(2)} MB)`
      )
      .join('\n');

    return `# ${manifest.project.name} - Çevrimdışı Web Arşivi

Bu proje klasörü **${APP_NAME} v${APP_VERSION}** (${APP_TAGLINE_TR} | ${APP_ORG_SIGNATURE}) tarafından oluşturulmuştur. Tüm sayfalar, varlıklar, dinamik proxy görselleri ve medya dosyaları çevrimdışı sadakatle kaydedilmiş ve yerel yollara dönüştürülmüştür.

---

## Proje Özeti

| Parametre | Değer |
|---|---|
| **Orijinal URL** | [${manifest.source.url}](${manifest.source.url}) |
| **Hedef Domain** | ${manifest.source.domain} |
| **Klonlama Modu** | ${manifest.settings?.mode === 'dynamic' ? 'Dinamik (Chromium 156 SPA)' : 'Statik (BoringSSL session.fetch)'} |
| **Oluşturulma Tarihi** | ${new Date(manifest.project.createdAt).toLocaleString('tr-TR')} |
| **Süre** | ${manifest.statistics.durationHuman} |
| **Toplam Sayfa / Dosya** | ${manifest.statistics.totalPages} sayfa / ${manifest.statistics.totalFiles} dosya |
| **Toplam Boyut** | ${manifest.statistics.totalSizeHuman} |
| **Ortalama Hız** | ${manifest.statistics.averageSpeedHuman} |
| **Hata / Atlanan URL** | ${manifest.statistics.failedUrls} |

---

## Nasıl Görüntülenir?

1. **WebClone Studio Önizleme Sunucusu (Önerilen):** Uygulama içinde **Artefakt Gezgini > Önizleme** sekmesinden yerel sunucuyu başlatın. Bu mod \`/_sw-replay.js\` Service Worker, HTTP \`206\` Range video/ses akışı ve \`_meta/api-endpoints.json\` mock yanıtlarını tam olarak etkinleştirir.
2. **Yerel Statik HTTP Sunucusu:**
\`\`\`bash
npx serve site
\`\`\`
3. **Taşınabilir Arşivler (\`_exports/\`):** Tek dosya \`_exports/index.standalone.html\`, Chromium \`_exports/index.mhtml\` veya ReplayWeb.page uyumlu \`.wacz\` paketini açın.

---

## Klasör Yapısı ve Tersine Mühendislik Çıktıları

| Yol | Açıklama |
|---|---|
| \`${manifest.entryPoint}\` | Çevrimdışı web sitesinin giriş noktası |
| \`site/_source-code/\` | SourceMap dosyalarından asenkron kurtarılan kaynak kod ağacı |
| \`_components/*.tsx\` | HTML bölümlerinden üretilmiş React 19 TSX bileşenleri |
| \`_meta/tokens.theme.css\` | CSS Color 4 (\`oklch\`/\`oklab\`/\`display-p3\`) ve Tailwind v4 \`@theme\` tokenları |
| \`_meta/tailwind.config.js\` & \`design-tokens.json\` | Tasarım tokenları ve Tailwind v3 yapılandırması |
| \`_meta/openapi.json\` & \`api-types.d.ts\` | Yakalanan ağ trafiğinden derlenen OpenAPI 3.1 ve TypeScript modelleri |
| \`_meta/extracted-state.json\` | Next.js (\`__NEXT_DATA__\`, \`__next_f\`), Nuxt ve hydration durumları |
| \`_meta/adaptive-entities.json\` | Yapısal semantik veri varlıkları |
| \`_meta/SYSTEM_MAP.md\` & \`tech-report.html\` | Mimari şartname ve görsel teknoloji raporu |
| \`_meta/crawl-state.sqlite\` | SQLite WAL kuyruk ve artımlı ETag/SHA-256 doğrulama veritabanı |
| \`_exports/*.wacz\` | Standart WACZ 1.1.1 (WARC/1.1 + SURT CDXJ) web arşivi |

---

## Tespit Edilen Teknolojiler

${techList}

---

## Dosya Dağılımı

${fileIndexList}

---
*${APP_NAME} v${APP_VERSION} - ${APP_ORG_SIGNATURE}*
`;
  }
}
