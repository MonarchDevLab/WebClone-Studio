import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { assertInsideRoot } from '../security/path-guard';

function escapeInlineScriptContent(js: string): string {
  return js.replace(/<\/(script)/gi, '<\\/$1');
}

function escapeInlineStyleContent(css: string): string {
  return css.replace(/<\/(style)/gi, '<\\/$1');
}

export class SingleFileExporter {
  /**
   * Inlines local stylesheets, images, fonts, and scripts inside siteDir into a self-contained HTML file.
   * Enforces canonical root boundary checks on all resolved local asset paths.
   */
  public static async export(html: string, siteDir: string): Promise<string> {
    const resolvedSiteRoot = path.resolve(siteDir);
    const $ = cheerio.load(html);

    // 1. Inline stylesheets (<link rel="stylesheet" href="..."> -> <style>...</style>)
    const linkTags = $('link[rel="stylesheet"]').toArray();
    for (const link of linkTags) {
      const href = $(link).attr('href');
      if (href && !href.startsWith('http://') && !href.startsWith('https://')) {
        const cleanHref = href.split('?')[0].split('#')[0].replace(/^\/+/, '');
        const candidatePath = path.resolve(resolvedSiteRoot, cleanHref);
        try {
          const safePath = await assertInsideRoot(resolvedSiteRoot, candidatePath, false);
          if (fs.existsSync(safePath)) {
            let cssContent = await fs.promises.readFile(safePath, 'utf-8');
            cssContent = await this.inlineCssUrls(cssContent, path.dirname(safePath), resolvedSiteRoot);
            $(link).replaceWith(
              `<style data-inlined-from="${href.replace(/"/g, '&quot;')}">\n${escapeInlineStyleContent(cssContent)}\n</style>`
            );
          }
        } catch {}
      }
    }

    // 2. Inline images (<img src="..."> -> data:image/...;base64,...)
    const imgTags = $('img').toArray();
    for (const img of imgTags) {
      const src = $(img).attr('src');
      if (src && !src.startsWith('data:') && !src.startsWith('http://') && !src.startsWith('https://')) {
        const cleanSrc = src.split('?')[0].split('#')[0].replace(/^\/+/, '');
        const candidatePath = path.resolve(resolvedSiteRoot, cleanSrc);
        try {
          const safePath = await assertInsideRoot(resolvedSiteRoot, candidatePath, false);
          if (fs.existsSync(safePath)) {
            const ext = path.extname(safePath).toLowerCase().replace('.', '');
            const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
            const fileBuf = await fs.promises.readFile(safePath);
            if (fileBuf.length < 5 * 1024 * 1024) {
              const dataUri = `data:${mimeType};base64,${fileBuf.toString('base64')}`;
              $(img).attr('src', dataUri);
            }
          }
        } catch {}
      }
    }

    // 3. Inline scripts (<script src="..."> -> <script>...</script>)
    const scriptTags = $('script[src]').toArray();
    for (const sc of scriptTags) {
      const src = $(sc).attr('src');
      if (src && !src.startsWith('http://') && !src.startsWith('https://')) {
        const cleanSrc = src.split('?')[0].split('#')[0].replace(/^\/+/, '');
        const candidatePath = path.resolve(resolvedSiteRoot, cleanSrc);
        try {
          const safePath = await assertInsideRoot(resolvedSiteRoot, candidatePath, false);
          if (fs.existsSync(safePath)) {
            const stats = await fs.promises.stat(safePath);
            if (stats.size < 1024 * 1024) {
              const jsContent = await fs.promises.readFile(safePath, 'utf-8');
              const safeSrcComment = src.replace(/\*\//g, '*\\/');
              const safeBody = escapeInlineScriptContent(`\n/* Inlined: ${safeSrcComment} */\n${jsContent}\n`);
              $(sc).removeAttr('src');
              $(sc).html(safeBody);
            }
          }
        } catch {}
      }
    }

    const stamp = `<!-- WebClone Studio - SingleFile Standalone Archive - ${new Date().toISOString()} -->\n`;
    return stamp + $.html();
  }

  private static async inlineCssUrls(css: string, cssDir: string, siteRoot: string): Promise<string> {
    const urlRegex = /url\(\s*['"]?([^'")]+)['"]?\s*\)/g;
    let match: RegExpExecArray | null;
    let modifiedCss = css;

    while ((match = urlRegex.exec(css)) !== null) {
      const rawUrl = match[1];
      if (rawUrl.startsWith('data:') || rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
        continue;
      }

      const cleanRelative = rawUrl.split('?')[0].split('#')[0];
      const baseForResolve = cleanRelative.startsWith('/') ? siteRoot : cssDir;
      const trimmedRelative = cleanRelative.startsWith('/') ? cleanRelative.replace(/^\/+/, '') : cleanRelative;
      const candidatePath = path.resolve(baseForResolve, trimmedRelative);

      try {
        const safePath = await assertInsideRoot(siteRoot, candidatePath, false);
        if (fs.existsSync(safePath)) {
          const stats = await fs.promises.stat(safePath);
          if (stats.size < 2 * 1024 * 1024) {
            const ext = path.extname(safePath).toLowerCase().replace('.', '');
            let mime = 'application/octet-stream';
            if (['woff', 'woff2', 'ttf', 'otf'].includes(ext)) mime = `font/${ext}`;
            else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif'].includes(ext)) {
              mime = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
            } else if (ext === 'svg') {
              mime = 'image/svg+xml';
            }

            const buf = await fs.promises.readFile(safePath);
            const dataUri = `data:${mime};base64,${buf.toString('base64')}`;
            modifiedCss = modifiedCss.replace(match[0], `url("${dataUri}")`);
          }
        }
      } catch {}
    }

    return modifiedCss;
  }
}
