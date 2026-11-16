import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ProjectStore } from '../../../src/main/storage/project-store';
import { SettingsStore } from '../../../src/main/storage/settings-store';

describe('ProjectStore Safety & Lifecycle', () => {
  let tempRoot: string;
  let outputBase: string;
  let originalDir: string;

  beforeEach(async () => {
    tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'wc-proj-'));
    outputBase = path.join(tempRoot, 'WebClone');
    await fs.promises.mkdir(outputBase, { recursive: true });
    originalDir = SettingsStore.getInstance().get().defaultOutputDir;
    SettingsStore.getInstance().set({ defaultOutputDir: outputBase });
  });

  afterEach(async () => {
    SettingsStore.getInstance().set({ defaultOutputDir: originalDir });
    await fs.promises.rm(tempRoot, { recursive: true, force: true });
  });

  it('refuses to delete defaultOutputDir itself or foreign directories without WebClone Studio manifest', async () => {
    const store = ProjectStore.getInstance();

    // Create a valid project inside outputBase
    const projDir = path.join(outputBase, 'valid-site');
    await fs.promises.mkdir(projDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(projDir, 'manifest.json'),
      JSON.stringify({
        version: '2.0.0',
        generator: 'WebClone Studio v2.0.0',
        project: { name: 'Valid', slug: 'valid-site', createdAt: new Date().toISOString() },
        source: { url: 'https://example.com', domain: 'example.com', protocol: 'https' },
        statistics: { totalFiles: 3, totalSizeBytes: 1024 },
      })
    );

    // Must refuse deleting the root outputBase!
    const deletedRoot = await store.deleteProject(outputBase);
    expect(deletedRoot).toBe(false);
    expect(fs.existsSync(outputBase)).toBe(true);
    expect(fs.existsSync(projDir)).toBe(true);

    // Must refuse deleting an unverified dir inside outputBase without manifest
    const unverifiedDir = path.join(outputBase, 'random-folder');
    await fs.promises.mkdir(unverifiedDir, { recursive: true });
    expect(await store.deleteProject(unverifiedDir)).toBe(false);
    expect(fs.existsSync(unverifiedDir)).toBe(true);

    // Valid project can be listed and deleted
    const listed = await store.listProjects();
    expect(listed.some((p) => p.slug === 'valid-site')).toBe(true);

    const deletedProj = await store.deleteProject(projDir);
    expect(deletedProj).toBe(true);
    expect(fs.existsSync(projDir)).toBe(false);
  });
});
