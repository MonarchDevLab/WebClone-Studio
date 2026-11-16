import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  assertInsideRoot,
  assertSafeShellOpenFile,
  assertDeletableProjectDir,
} from '../../../src/main/security/path-guard';

describe('Security path-guard', () => {
  let tempBase: string;
  let defaultOutputDir: string;

  beforeEach(async () => {
    tempBase = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'wc-path-guard-'));
    defaultOutputDir = path.join(tempBase, 'WebClone');
    await fs.promises.mkdir(defaultOutputDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.promises.rm(tempBase, { recursive: true, force: true });
  });

  it('blocks path traversal outside site root in assertInsideRoot', async () => {
    const siteDir = path.join(defaultOutputDir, 'proj1', 'site');
    await fs.promises.mkdir(siteDir, { recursive: true });
    const insideFile = path.join(siteDir, 'assets', 'app.css');
    await fs.promises.mkdir(path.dirname(insideFile), { recursive: true });
    await fs.promises.writeFile(insideFile, 'body{}');

    const secretFile = path.join(tempBase, 'secret.txt');
    await fs.promises.writeFile(secretFile, 'TOP_SECRET');

    const resolved = await assertInsideRoot(siteDir, insideFile);
    expect(resolved).toContain('app.css');

    await expect(assertInsideRoot(siteDir, path.join(siteDir, '..', '..', '..', 'secret.txt'))).rejects.toThrow(
      /ERR_PATH_TRAVERSAL/
    );
  });

  it('blocks dangerous executables and UNC paths in assertSafeShellOpenFile', async () => {
    const htmlFile = path.join(tempBase, 'index.html');
    await fs.promises.writeFile(htmlFile, '<html></html>');
    const exeFile = path.join(tempBase, 'payload.exe');
    await fs.promises.writeFile(exeFile, 'MZ');

    await expect(assertSafeShellOpenFile(htmlFile)).resolves.toContain('index.html');
    await expect(assertSafeShellOpenFile(exeFile)).rejects.toThrow(/ERR_PATH_TRAVERSAL/);
    await expect(assertSafeShellOpenFile('\\\\attacker-server\\share\\file.html')).rejects.toThrow(
      /ERR_PATH_TRAVERSAL/
    );
  });

  it('prevents deleting defaultOutputDir itself, drive root, or unverified directories', async () => {
    // SEC-02: deleting defaultOutputDir must always fail!
    await expect(assertDeletableProjectDir(defaultOutputDir, defaultOutputDir)).rejects.toThrow(
      /ERR_UNSAFE_PROJECT_DELETE/
    );

    // Foreign dir even WITH a fake manifest.json (without WebClone Studio generator) must fail!
    const foreignDir = path.join(tempBase, 'foreign-app');
    await fs.promises.mkdir(foreignDir, { recursive: true });
    await fs.promises.writeFile(path.join(foreignDir, 'manifest.json'), JSON.stringify({ generator: 'Other' }));
    await expect(assertDeletableProjectDir(foreignDir, defaultOutputDir)).rejects.toThrow(
      /ERR_UNSAFE_PROJECT_DELETE/
    );

    // Valid WebClone Studio project dir passes
    const validProj = path.join(defaultOutputDir, 'example_com');
    await fs.promises.mkdir(validProj, { recursive: true });
    await fs.promises.writeFile(
      path.join(validProj, 'manifest.json'),
      JSON.stringify({ generator: 'WebClone Studio v2.0.0 (Monolith Works / MonarchDevLab)' })
    );
    await expect(assertDeletableProjectDir(validProj, defaultOutputDir)).resolves.toContain('example_com');
  });
});
