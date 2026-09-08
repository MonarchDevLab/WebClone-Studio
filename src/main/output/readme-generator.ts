import { ProjectManifest } from '../../shared/types';

/**
 * İndirilen projenin kök dizinine koyulacak insan okunabilir README.md dosyasını üretir.
 */
export class ReadmeGenerator {
  public static generate(manifest: ProjectManifest): string {
    const techList = manifest.technologies.length > 0
      ? manifest.technologies.map(t => `- **${t.category}:** ${t.name}${t.version ? ` (${t.version})` : ''} — %${t.confidence} güven`).join('\n')
      : '- Belirgin teknoloji imzası tespit edilemedi.';

    const fileIndexList = Object.entries(manifest.fileIndex)
      .map(([key, val]) => `- **${key.toUpperCase()}:** ${val.count} dosya (${(val.sizeBytes / (1024 * 1024)).toFixed(2)} MB)`)
      .join('\n');

    return `# ${manifest.project.name} — Offline Web Kopyası

Bu klasör **WebClone Studio** (Monolith Works / MonarchDevLab) tarafından otomatik olarak oluşturulmuştur. Tüm iç sayfalar ve statik varlıklar (CSS, JS, Resimler, Fontlar) offline çalışacak şekilde indirilmiş ve linkler yerel yollara uyarlanmıştır.

---

## Proje Özeti

| Parametre | Değer |
|---|---|
| **Orijinal URL** | [${manifest.source.url}](${manifest.source.url}) |
| **Domain** | ${manifest.source.domain} |
| **Klonlama Tarihi** | ${new Date(manifest.project.createdAt).toLocaleString('tr-TR')} |
| **Tamamlanma Süresi** | ${manifest.statistics.durationHuman} |
| **Toplam Sayfa Sayısı** | ${manifest.statistics.totalPages} |
| **Toplam İndirilen Dosya** | ${manifest.statistics.totalFiles} |
| **Toplam Boyut** | ${manifest.statistics.totalSizeHuman} |
| **Ortalama İndirme Hızı** | ${manifest.statistics.averageSpeedHuman} |
| **Başarısız URL Sayısı** | ${manifest.statistics.failedUrls} |

---

## Nasıl Görüntülenir?

İndirilen web sitesini çevrimdışı gezmek için:
1. \`${manifest.entryPoint}\` dosyasını herhangi bir modern web tarayıcısında (Chrome, Edge, Firefox, Brave vb.) açın.
2. Ya da bu klasörde yerel bir HTTP sunucusu başlatın:
\`\`\`bash
npx serve site
\`\`\`

---

## Tespit Edilen Teknolojiler

${techList}

---

## Dosya Dağılımı

${fileIndexList}

---

## Raporlar ve Ek Dosyalar

- **Proje Manifestosu:** \`manifest.json\`
- **Görsel Teknoloji & Tasarım Raporu:** \`_meta/tech-report.html\`
- **Mimari Sistem Haritası & Şartname:** \`_meta/SYSTEM_MAP.md\`
- **Hata ve İstisna Günlüğü:** \`_meta/errors.log\`

---
*WebClone Studio v1.0.0 — Monolith Works / MonarchDevLab tarafından geliştirilmiştir.*
`;
  }
}
