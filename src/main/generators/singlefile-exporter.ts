import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

export class SingleFileExporter {
  /**
   * Bir HTML sayfasını ve yerel varlıklarını (CSS, Script, Font, Resim) Base64 Data URI
   * ve gömülü etiketlere dönüştürerek tek bir bağımsız (self-contained) .html dosyası üretir.
   */
  public static async export(html: string, siteDir: string): Promise<string> {
    const $ = cheerio.load(html, );

    // 1. CSS <link rel="stylesheet" href="..."> -> <style>...</style>
    const linkTags = $('link[rel="stylesheet"]').toArray();
    for (const link of linkTags) {
      const href = $(link).attr('href');
      if (href && !href.startsWith('http://') && !href.startsWith('https://')) {
        const cleanHref = href.split('?')[0].split('#')[0].replace(/^\/+/, '');
        const localPath = path.join(siteDir, cleanHref);
        try {
          if (fs.existsSync(localPath)) {
            let cssContent = await fs.promises.readFile(localPath, 'utf-8');
            cssContent = await this.inlineCssUrls(cssContent, path.dirname(localPath));
            $(link).replaceWith(`<style data-inlined-from="${href}">\n${cssContent}\n</style>`);
          }
        } catch {}
      }
    }

    // 2. Görseller <img src="..."> -> <img src="data:image/...;base64,...">
    const imgTags = $('img').toArray();
    for (const img of imgTags) {
      const src = $(img).attr('src');
      if (src && !src.startsWith('data:') && !src.startsWith('http://') && !src.startsWith('https://')) {
        const cleanSrc = src.split('?')[0].split('#')[0].replace(/^\/+/, '');
        const localPath = path.join(siteDir, cleanSrc);
        try {
          if (fs.existsSync(localPath)) {
            const ext = path.extname(localPath).toLowerCase().replace('.', '');
            const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
            const fileBuf = await fs.promises.readFile(localPath);
            if (fileBuf.length < 5 * 1024 * 1024) { // Max 5MB
              const dataUri = `data:${mimeType};base64,${fileBuf.toString('base64')}`;
              $(img).attr('src', dataUri);
            }
          }
        } catch {}
      }
    }

    // 3. Scriptler <script src="..."> -> <script>...</script>
    const scriptTags = $('script[src]').toArray();
    for (const sc of scriptTags) {
      const src = $(sc).attr('src');
      if (src && !src.startsWith('http://') && !src.startsWith('https://')) {
        const cleanSrc = src.split('?')[0].split('#')[0].replace(/^\/+/, '');
        const localPath = path.join(siteDir, cleanSrc);
        try {
          if (fs.existsSync(localPath)) {
            const stats = await fs.promises.stat(localPath);
            if (stats.size < 1024 * 1024) { // Max 1MB
              const jsContent = await fs.promises.readFile(localPath, 'utf-8');
              $(sc).removeAttr('src');
              $(sc).text(`\n/* Inlined: ${src} */\n${jsContent}\n`);
            }
          }
        } catch {}
      }
    }

    // Bağımsızlık ve offline garantisi yorumu
    const stamp = `<!-- WebClone Studio - SingleFile Standalone Archive (Otonom Bağımsız Çıktı) - ${new Date().toISOString()} -->\n`;
    return stamp + $.html();
  }

  private static async inlineCssUrls(css: string, cssDir: string): Promise<string> {
    const urlRegex = /url\(\s*['"]?([^'")]+)['"]?\s*\)/g;
    let match: RegExpExecArray | null;
    let modifiedCss = css;

    while ((match = urlRegex.exec(css)) !== null) {
      const rawUrl = match[1];
      if (rawUrl.startsWith('data:') || rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) continue;

      const cleanRelative = rawUrl.split('?')[0].split('#')[0];
      const localPath = path.resolve(cssDir, cleanRelative);

      try {
        if (fs.existsSync(localPath)) {
          const stats = await fs.promises.stat(localPath);
          if (stats.size < 2 * 1024 * 1024) { // Max 2MB font/asset
            const ext = path.extname(localPath).toLowerCase().replace('.', '');
            let mime = 'application/octet-stream';
            if (['woff', 'woff2', 'ttf', 'otf'].includes(ext)) mime = `font/${ext}`;
            else if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) mime = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
            else if (ext === 'svg') mime = 'image/svg+xml';

            const buf = await fs.promises.readFile(localPath);
            const dataUri = `data:${mime};base64,${buf.toString('base64')}`;
            modifiedCss = modifiedCss.replace(match[0], `url("${dataUri}")`);
          }
        }
      } catch {}
    }

    return modifiedCss;
  }
}
