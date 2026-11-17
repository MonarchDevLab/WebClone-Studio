import { _electron as electron, ElectronApplication, Page, test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MockTargetServerController, startMockTargetServer } from '../fixtures/mock-target-server';

async function launchElectronTestApp(userDataDir: string): Promise<{ app: ElectronApplication; page: Page }> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k !== 'ELECTRON_RUN_AS_NODE' && typeof v === 'string') {
      env[k] = v;
    }
  }

  const args = [
    path.resolve('out/main/index.js'),
    `--user-data-dir=${userDataDir}`,
  ];
  if (process.platform === 'linux') {
    args.push('--no-sandbox', '--disable-gpu');
  }

  const app = await electron.launch({
    executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
    args,
    env,
  });

  const page = await app.firstWindow({ timeout: 25_000 });
  await page.waitForSelector('[role="tablist"]', { timeout: 20_000 });
  return { app, page };
}

test.describe('WebClone Studio v2.0 Electron End-to-End Flow', () => {
  let tempRoot: string;
  let userDataDir: string;
  let cloneOutputDir: string;
  let electronApp: ElectronApplication | null = null;
  let fixture: MockTargetServerController | null = null;

  test.beforeEach(async () => {
    tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'wc-pw-e2e-'));
    userDataDir = path.join(tempRoot, 'userdata');
    cloneOutputDir = path.join(tempRoot, 'clones');
    await fs.promises.mkdir(userDataDir, { recursive: true });
    await fs.promises.mkdir(cloneOutputDir, { recursive: true });
  });

  test.afterEach(async () => {
    if (electronApp) {
      await electronApp.close().catch(() => {});
      electronApp = null;
    }
    if (fixture) {
      await fixture.close().catch(() => {});
      fixture = null;
    }
    await fs.promises.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  });

  test('verifies hardened Preload surface, WCAG keyboard tablist, and Command Palette dialog', async () => {
    const launched = await launchElectronTestApp(userDataDir);
    electronApp = launched.app;
    const page = launched.page;

    const apiAudit = await page.evaluate(() => {
      const api = (window as any).electronAPI;
      return {
        hasApi: Boolean(api),
        hasAnalyze: typeof api?.analyze === 'function',
        hasExportWacz: typeof api?.exportWacz === 'function',
        hasTelemetryBatch: typeof api?.onTelemetryBatch === 'function',
        hasRawSend: 'send' in (api || {}),
        hasRawInvoke: 'invoke' in (api || {}),
        hasRawOn: 'on' in (api || {}),
        hasRawRemove: 'removeListener' in (api || {}),
      };
    });

    expect(apiAudit.hasApi).toBe(true);
    expect(apiAudit.hasAnalyze).toBe(true);
    expect(apiAudit.hasExportWacz).toBe(true);
    expect(apiAudit.hasTelemetryBatch).toBe(true);
    expect(apiAudit.hasRawSend).toBe(false);
    expect(apiAudit.hasRawInvoke).toBe(false);
    expect(apiAudit.hasRawOn).toBe(false);
    expect(apiAudit.hasRawRemove).toBe(false);

    const tabs = page.locator('[role="tab"]');
    await expect(tabs).toHaveCount(6);
    await tabs.nth(0).focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('End');
    await expect(tabs.nth(5)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Home');
    await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('Control+K');
    await expect(page.getByRole('dialog', { name: 'Komut Paleti' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Komut Paleti' })).toBeHidden();
  });

  test('analyzes local HTTP fixture, clones with WACZ, and inspects artifacts in 6-tab Explorer', async () => {
    fixture = await startMockTargetServer();
    const launched = await launchElectronTestApp(userDataDir);
    electronApp = launched.app;
    const page = launched.page;

    // Configure isolated clone directory and allowLocalhostTargets cleanly via IPC
    await page.evaluate(async (dir) => {
      await (window as any).electronAPI.saveSettings({
        defaultOutputDir: dir,
        allowLocalhostTargets: true,
        defaultExportWacz: true,
        defaultReverseEngineering: true,
        defaultDownloadImages: true,
        defaultDownloadMedia: true,
      });
    }, cloneOutputDir);

    const urlInput = page.locator('#url-input-field');
    await urlInput.fill(fixture.baseUrl);
    await urlInput.press('Enter');

    // Overview populates analyzed site heading
    await expect(page.getByRole('heading', { name: /Mock Fixture App/i })).toBeVisible({
      timeout: 25_000,
    });

    // Open Clone Setup Modal and launch clone through Step 1..4
    await page.getByRole('button', { name: /Klon Sihirbazını Aç/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Disable openFolderOnComplete in Step 4 so Windows Explorer window doesn't pop up during E2E
    for (let s = 1; s < 4; s++) {
      await page.getByRole('button', { name: /İleri/i }).click();
    }
    const openFolderCheckbox = page.locator('label', { hasText: "Dosya Gezgini'nde" }).locator('input');
    if (await openFolderCheckbox.isChecked()) {
      await openFolderCheckbox.uncheck();
    }

    await page.getByRole('button', { name: /Klonlamayı Başlat/i }).click();

    // Wait for listProjects IPC to register completed cloned directory
    await expect
      .poll(
        async () => {
          const list = await page.evaluate(() => (window as any).electronAPI.listProjects());
          return Array.isArray(list) ? list.length : 0;
        },
        { timeout: 35_000 }
      )
      .toBeGreaterThanOrEqual(1);

    // Navigate to Artefakt Gezgini tab and open cloned project
    await page.getByRole('tab', { name: /Artefakt Gezgini/i }).click();
    const projectCard = page.locator('button', { hasText: '127.0.0.1' }).first();
    await projectCard.click();

    await expect(page.getByRole('tab', { name: /Tokenlar & Veri/i })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('tab', { name: /Tokenlar & Veri/i }).click();
    await expect(page.getByText(/oklch\(0\.65 0\.18 220\)/)).toBeVisible({ timeout: 10_000 });

    await page.getByRole('tab', { name: /Arşiv & Fark/i }).click();
    await expect(page.getByText(/\.wacz/i).first()).toBeVisible();

    await page.getByRole('button', { name: /Fark Analizini Çalıştır/i }).click();
    await expect(page.getByText(/Değişmedi/i)).toBeVisible({ timeout: 15_000 });
  });
});
