import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { WaczExporter } from '../../../src/main/generators/wacz-exporter';

interface ParsedZipEntry {
  name: string;
  data: Buffer;
  crc32: number;
  compressionMethod: number;
}

function parseStoreZip(buf: Buffer): ParsedZipEntry[] {
  // Locate EOCD signature 0x06054b50 from the tail
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  expect(eocdOffset).toBeGreaterThan(-1);

  const entryCount = buf.readUInt16LE(eocdOffset + 10);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  const entries: ParsedZipEntry[] = [];
  let cursor = cdOffset;

  for (let i = 0; i < entryCount; i++) {
    expect(buf.readUInt32LE(cursor)).toBe(0x02014b50);
    const compressionMethod = buf.readUInt16LE(cursor + 10);
    const crc32 = buf.readUInt32LE(cursor + 16);
    const compSize = buf.readUInt32LE(cursor + 20);
    const nameLen = buf.readUInt16LE(cursor + 28);
    const extraLen = buf.readUInt16LE(cursor + 30);
    const commentLen = buf.readUInt16LE(cursor + 32);
    const localHeaderOffset = buf.readUInt32LE(cursor + 42);
    const name = buf.toString('utf-8', cursor + 46, cursor + 46 + nameLen);

    expect(buf.readUInt32LE(localHeaderOffset)).toBe(0x04034b50);
    const localNameLen = buf.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const data = buf.subarray(dataStart, dataStart + compSize);

    entries.push({ name, data, crc32, compressionMethod });
    cursor += 46 + nameLen + extraLen + commentLen;
  }

  return entries;
}

describe('WaczExporter (Pure-TS WACZ 1.1.1 Generator)', () => {
  let tempProjectDir: string;

  beforeEach(async () => {
    tempProjectDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'wc-wacz-'));
    const siteDir = path.join(tempProjectDir, 'site');
    const metaDir = path.join(tempProjectDir, '_meta');
    await fs.promises.mkdir(path.join(siteDir, 'assets', 'images'), { recursive: true });
    await fs.promises.mkdir(metaDir, { recursive: true });

    await fs.promises.writeFile(
      path.join(siteDir, 'index.html'),
      '<!DOCTYPE html><html><head><title>Home Page</title></head><body><h1>Main</h1></body></html>',
      'utf-8'
    );
    await fs.promises.writeFile(
      path.join(siteDir, 'about.html'),
      '<!DOCTYPE html><html><head><title>About Us</title></head><body><p>Bio</p></body></html>',
      'utf-8'
    );
    await fs.promises.writeFile(
      path.join(siteDir, 'assets', 'images', 'logo_1234.png'),
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );

    await fs.promises.writeFile(
      path.join(tempProjectDir, 'manifest.json'),
      JSON.stringify({
        project: { name: 'Example WACZ Site' },
        source: { url: 'https://example.org/' },
      }),
      'utf-8'
    );

    await fs.promises.writeFile(
      path.join(metaDir, 'url-map.json'),
      JSON.stringify({
        '/': 'index.html',
        '/about': 'about.html',
        '/img/logo.png': 'assets/images/logo_1234.png',
      }),
      'utf-8'
    );
  });

  afterEach(async () => {
    await fs.promises.rm(tempProjectDir, { recursive: true, force: true });
  });

  it('produces valid STORE ZIP with datapackage-digest SHA-256 and independently gunzippable CDXJ WARC slices', async () => {
    const result = await WaczExporter.exportProject(tempProjectDir);
    expect(result.filePath.endsWith('example-wacz-site.wacz')).toBe(true);
    expect(fs.existsSync(result.filePath)).toBe(true);

    const zipBytes = await fs.promises.readFile(result.filePath);
    const entries = parseStoreZip(zipBytes);
    const byName = new Map(entries.map((e) => [e.name, e]));

    expect(Array.from(byName.keys()).sort()).toEqual([
      'archive/data.warc.gz',
      'datapackage-digest.json',
      'datapackage.json',
      'indexes/index.cdxj',
      'pages/pages.jsonl',
    ]);

    for (const entry of entries) {
      expect(entry.compressionMethod).toBe(0);
      if (typeof zlib.crc32 === 'function') {
        expect(entry.crc32).toBe(zlib.crc32(entry.data) >>> 0);
      }
    }

    const datapackageBuf = byName.get('datapackage.json')!.data;
    const datapackage = JSON.parse(datapackageBuf.toString('utf-8'));
    expect(datapackage.wacz_version).toBe('1.1.1');
    expect(datapackage.resources).toHaveLength(3);

    const digestDoc = JSON.parse(byName.get('datapackage-digest.json')!.data.toString('utf-8'));
    const actualSha = crypto.createHash('sha256').update(datapackageBuf).digest('hex');
    expect(digestDoc.path).toBe('datapackage.json');
    expect(digestDoc.hash).toBe(`sha256:${actualSha}`);

    const pagesText = byName.get('pages/pages.jsonl')!.data.toString('utf-8').trim();
    const pageLines = pagesText.split('\n').map((l) => JSON.parse(l));
    expect(pageLines.length).toBe(3);
    expect(pageLines[1].url).toContain('example.org');

    const dataWarcGz = byName.get('archive/data.warc.gz')!.data;
    const cdxjText = byName.get('indexes/index.cdxj')!.data.toString('utf-8').trim();
    const cdxjRows = cdxjText.split('\n');
    expect(cdxjRows.length).toBe(3);

    // Ensure lexicographic SURT sort and independent gzip member decompression per slice
    const surts = cdxjRows.map((row) => row.split(' ')[0]);
    expect([...surts].sort()).toEqual(surts);

    for (const row of cdxjRows) {
      const firstSpace = row.indexOf(' ');
      const secondSpace = row.indexOf(' ', firstSpace + 1);
      const meta = JSON.parse(row.slice(secondSpace + 1));
      const slice = dataWarcGz.subarray(meta.offset, meta.offset + meta.length);
      const plainRecord = zlib.gunzipSync(slice).toString('utf-8');
      expect(plainRecord).toContain('WARC/1.1');
      expect(plainRecord).toContain(`WARC-Target-URI: ${meta.url}`);
      expect(plainRecord).toContain('HTTP/1.1 200 OK');
    }
  });
});
