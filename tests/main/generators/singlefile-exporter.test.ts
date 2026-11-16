import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SingleFileExporter } from '../../../src/main/generators/singlefile-exporter';

describe('SingleFileExporter Security & Inlining', () => {
  let tempRoot: string;
  let siteDir: string;

  beforeEach(async () => {
    tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'wc-singlefile-'));
    siteDir = path.join(tempRoot, 'site');
    await fs.promises.mkdir(path.join(siteDir, 'assets'), { recursive: true });
    await fs.promises.writeFile(path.join(tempRoot, 'secret-outside.txt'), 'SENSITIVE_SECRET_TOKEN', 'utf-8');
    await fs.promises.writeFile(
      path.join(siteDir, 'assets', 'app.css'),
      'body { color: #111; background: url("../../secret-outside.txt"); }',
      'utf-8'
    );
    await fs.promises.writeFile(
      path.join(siteDir, 'assets', 'app.js'),
      'const msg = "</script><script>window.__pwn=1</script>"; console.log(msg);',
      'utf-8'
    );
  });

  afterEach(async () => {
    await fs.promises.rm(tempRoot, { recursive: true, force: true });
  });

  it('blocks path traversal outside siteDir while safely inlining local assets and escaping </script>', async () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="assets/app.css">
  <link rel="stylesheet" href="../secret-outside.txt">
</head>
<body>
  <img src="../secret-outside.txt">
  <script src="assets/app.js"></script>
  <script src="../secret-outside.txt"></script>
</body>
</html>`;

    const exported = await SingleFileExporter.export(html, siteDir);

    expect(exported).toContain('<style data-inlined-from="assets/app.css">');
    expect(exported).not.toContain('SENSITIVE_SECRET_TOKEN');
    expect(exported).not.toContain(Buffer.from('SENSITIVE_SECRET_TOKEN').toString('base64'));
    expect(exported).not.toContain('</script><script>window.__pwn=1');
    expect(exported).toContain('<\\/script>');
  });
});
