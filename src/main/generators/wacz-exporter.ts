import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { ProjectManifest } from '../../shared/types';
import { assertInsideRoot } from '../security/path-guard';

const EXTENSION_MIME_MAP: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.vtt': 'text/vtt; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

interface ZipEntryInput {
  name: string;
  data: Buffer;
  mtime: Date;
}

function toDosTimeDate(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, date.getUTCFullYear());
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = Math.floor(date.getUTCSeconds() / 2);

  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  return { dosTime, dosDate };
}

function buildStoreZipBuffer(entries: ZipEntryInput[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name.replace(/\\/g, '/'), 'utf-8');
    const crc = (zlib.crc32 ? zlib.crc32(entry.data) : 0) >>> 0;
    const size = entry.data.length;
    const { dosTime, dosDate } = toDosTimeDate(entry.mtime);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(size, 18);
    localHeader.writeUInt32LE(size, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, entry.data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(size, 20);
    centralHeader.writeUInt32LE(size, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + entry.data.length;
  }

  const centralBuffer = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuffer.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralBuffer, eocd]);
}

function toSurtKey(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    const reversedHost = u.hostname.toLowerCase().split('.').reverse().join(',');
    const portPart = u.port ? `:${u.port}` : '';
    return `${reversedHost}${portPart})${u.pathname}${u.search}`;
  } catch {
    return urlStr.toLowerCase();
  }
}

function toWarcTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:T.]/g, '').slice(0, 14);
}

function buildWarcInfoRecord(isoDate: string, domain: string): Buffer {
  const payload = Buffer.from(
    [
      'software: WebClone Studio v2',
      'format: WARC File Format 1.1',
      `hostname: ${domain}`,
      `created: ${isoDate}`,
      '',
    ].join('\r\n'),
    'utf-8'
  );
  const header = Buffer.from(
    [
      'WARC/1.1',
      'WARC-Type: warcinfo',
      `WARC-Date: ${isoDate}`,
      `WARC-Record-ID: <urn:uuid:${crypto.randomUUID()}>`,
      'Content-Type: application/warc-fields',
      `Content-Length: ${payload.length}`,
      '',
      '',
    ].join('\r\n'),
    'utf-8'
  );
  return Buffer.concat([header, payload, Buffer.from('\r\n\r\n', 'utf-8')]);
}

function buildWarcResponseRecord(
  targetUri: string,
  isoDate: string,
  mimeType: string,
  body: Buffer
): Buffer {
  const httpHeader = Buffer.from(
    [
      'HTTP/1.1 200 OK',
      `Content-Type: ${mimeType}`,
      `Content-Length: ${body.length}`,
      'Connection: close',
      '',
      '',
    ].join('\r\n'),
    'utf-8'
  );
  const httpPayload = Buffer.concat([httpHeader, body]);
  const warcHeader = Buffer.from(
    [
      'WARC/1.1',
      'WARC-Type: response',
      `WARC-Target-URI: ${targetUri}`,
      `WARC-Date: ${isoDate}`,
      `WARC-Record-ID: <urn:uuid:${crypto.randomUUID()}>`,
      'Content-Type: application/http; msgtype=response',
      `Content-Length: ${httpPayload.length}`,
      '',
      '',
    ].join('\r\n'),
    'utf-8'
  );
  return Buffer.concat([warcHeader, httpPayload, Buffer.from('\r\n\r\n', 'utf-8')]);
}

async function collectFilesRecursive(dir: string, baseDir: string): Promise<string[]> {
  if (!fs.existsSync(dir)) return [];
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await collectFilesRecursive(full, baseDir)));
    } else if (entry.isFile()) {
      results.push(path.relative(baseDir, full).split(path.sep).join('/'));
    }
  }
  return results.sort();
}

function extractHtmlTitle(buf: Buffer): string {
  const headSlice = buf.toString('utf-8', 0, Math.min(buf.length, 32768));
  const match = headSlice.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : '';
}

function sha256Hex(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * Exports a cloned project directory as a compliant WACZ 1.1.1 archive using pure Node built-ins.
 */
export class WaczExporter {
  public static async exportProject(
    projectDir: string
  ): Promise<{ filePath: string; sizeBytes: number; sha256: string }> {
    const safeProject = await fs.promises.realpath(path.resolve(projectDir));
    const siteDir = path.join(safeProject, 'site');
    const exportsDir = path.join(safeProject, '_exports');
    await fs.promises.mkdir(exportsDir, { recursive: true });

    let projectName = path.basename(safeProject);
    let sourceOrigin = 'https://localhost';
    let mainPageUrl = 'https://localhost/';

    for (const candidate of [
      path.join(safeProject, 'manifest.json'),
      path.join(safeProject, '_meta', 'manifest.json'),
    ]) {
      if (fs.existsSync(candidate)) {
        try {
          const manifest = JSON.parse(
            await fs.promises.readFile(candidate, 'utf-8')
          ) as ProjectManifest;
          if (manifest.project?.name) projectName = manifest.project.name;
          if (manifest.source?.url) {
            mainPageUrl = manifest.source.url;
            sourceOrigin = new URL(manifest.source.url).origin;
          }
          break;
        } catch {}
      }
    }

    const urlMapReverse = new Map<string, string>();
    const urlMapPath = path.join(safeProject, '_meta', 'url-map.json');
    if (fs.existsSync(urlMapPath)) {
      try {
        const rawMap = JSON.parse(await fs.promises.readFile(urlMapPath, 'utf-8')) as Record<
          string,
          string
        >;
        for (const [origKey, relLocal] of Object.entries(rawMap)) {
          if (typeof relLocal !== 'string') continue;
          const cleanRel = relLocal.replace(/^\/+/, '');
          if (!urlMapReverse.has(cleanRel)) {
            const fullOrig = origKey.startsWith('http')
              ? origKey
              : new URL(origKey, sourceOrigin).href;
            urlMapReverse.set(cleanRel, fullOrig);
          }
        }
      } catch {}
    }

    const now = new Date();
    const isoDate = now.toISOString();
    const warcTimestamp = toWarcTimestamp(now);
    const domain = (() => {
      try {
        return new URL(sourceOrigin).hostname;
      } catch {
        return 'localhost';
      }
    })();

    const warcGzChunks: Buffer[] = [];
    let warcOffset = 0;

    // 1. warcinfo member
    const warcInfoGz = zlib.gzipSync(buildWarcInfoRecord(isoDate, domain));
    warcGzChunks.push(warcInfoGz);
    warcOffset += warcInfoGz.length;

    const cdxjLines: string[] = [];
    const pagesLines: string[] = [
      JSON.stringify({ format: 'json-pages-1.0', id: 'pages', title: 'All Pages' }),
    ];

    const siteFiles = await collectFilesRecursive(siteDir, siteDir);
    for (const relPath of siteFiles) {
      const absFile = path.join(siteDir, relPath);
      const safeFile = await assertInsideRoot(safeProject, absFile, false);
      const fileBuf = await fs.promises.readFile(safeFile);
      const ext = path.extname(safeFile).toLowerCase();
      const mimeType = EXTENSION_MIME_MAP[ext] || 'application/octet-stream';

      const targetUri =
        urlMapReverse.get(relPath) ||
        (relPath === 'index.html'
          ? mainPageUrl
          : new URL(relPath.replace(/\/index\.html$/, '/'), `${sourceOrigin}/`).href);

      const responseRecord = buildWarcResponseRecord(targetUri, isoDate, mimeType, fileBuf);
      const compressedChunk = zlib.gzipSync(responseRecord);
      const length = compressedChunk.length;
      const offset = warcOffset;
      warcGzChunks.push(compressedChunk);
      warcOffset += length;

      const surtKey = toSurtKey(targetUri);
      const digest = `sha-256:${sha256Hex(fileBuf)}`;
      const cdxjMeta = JSON.stringify({
        url: targetUri,
        mime: mimeType.split(';')[0],
        status: 200,
        digest,
        length,
        offset,
        filename: 'data.warc.gz',
      });
      cdxjLines.push(`${surtKey} ${warcTimestamp} ${cdxjMeta}`);

      if (ext === '.html' || ext === '.htm') {
        const title = extractHtmlTitle(fileBuf) || relPath;
        pagesLines.push(
          JSON.stringify({
            id: crypto.createHash('md5').update(targetUri).digest('hex').slice(0, 12),
            url: targetUri,
            title,
            ts: isoDate,
          })
        );
      }
    }

    cdxjLines.sort();

    const dataWarcGz = Buffer.concat(warcGzChunks);
    const indexCdxj = Buffer.from(cdxjLines.join('\n') + (cdxjLines.length ? '\n' : ''), 'utf-8');
    const pagesJsonl = Buffer.from(pagesLines.join('\n') + '\n', 'utf-8');

    const datapackageObj = {
      profile: 'data-package',
      wacz_version: '1.1.1',
      title: projectName,
      created: isoDate,
      software: 'WebClone Studio v2',
      mainPageUrl,
      mainPageDate: isoDate,
      resources: [
        {
          name: 'data.warc.gz',
          path: 'archive/data.warc.gz',
          hash: `sha256:${sha256Hex(dataWarcGz)}`,
          bytes: dataWarcGz.length,
        },
        {
          name: 'index.cdxj',
          path: 'indexes/index.cdxj',
          hash: `sha256:${sha256Hex(indexCdxj)}`,
          bytes: indexCdxj.length,
        },
        {
          name: 'pages.jsonl',
          path: 'pages/pages.jsonl',
          hash: `sha256:${sha256Hex(pagesJsonl)}`,
          bytes: pagesJsonl.length,
        },
      ],
    };

    const datapackageBuf = Buffer.from(JSON.stringify(datapackageObj, null, 2), 'utf-8');
    const datapackageDigestObj = {
      path: 'datapackage.json',
      hash: `sha256:${sha256Hex(datapackageBuf)}`,
    };
    const datapackageDigestBuf = Buffer.from(JSON.stringify(datapackageDigestObj, null, 2), 'utf-8');

    const zipBuffer = buildStoreZipBuffer([
      { name: 'archive/data.warc.gz', data: dataWarcGz, mtime: now },
      { name: 'indexes/index.cdxj', data: indexCdxj, mtime: now },
      { name: 'pages/pages.jsonl', data: pagesJsonl, mtime: now },
      { name: 'datapackage.json', data: datapackageBuf, mtime: now },
      { name: 'datapackage-digest.json', data: datapackageDigestBuf, mtime: now },
    ]);

    const slug =
      projectName
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'archive';
    const rawOutPath = path.join(exportsDir, `${slug}.wacz`);
    const safeOutPath = await assertInsideRoot(safeProject, rawOutPath, true);
    await fs.promises.writeFile(safeOutPath, zipBuffer);

    return {
      filePath: safeOutPath,
      sizeBytes: zipBuffer.length,
      sha256: sha256Hex(zipBuffer),
    };
  }
}
