import { app, BrowserWindow } from 'electron';
import os from 'node:os';
import path from 'node:path';
import { AnalyzeResult } from '../../shared/types';
import { TechDetector } from '../analyzers/tech-detector';
import { DesignAnalyzer } from '../analyzers/design-analyzer';
import { SiteMapper } from '../analyzers/site-mapper';
import { SecurityScanner } from '../analyzers/security-scanner';
import { SizeEstimator } from '../analyzers/size-estimator';
import { PageRenderer } from '../browser/page-renderer';
import { CrawlerOrchestrator } from '../cloner/crawler-orchestrator';
import { SettingsStore } from '../storage/settings-store';
import { ProjectStore } from '../storage/project-store';

export interface IpcRuntimeContext {
  mainWindow?: BrowserWindow;
  pageRenderer: PageRenderer;
  techDetector: TechDetector;
  designAnalyzer: DesignAnalyzer;
  siteMapper: SiteMapper;
  securityScanner: SecurityScanner;
  sizeEstimator: SizeEstimator;
  settingsStore: SettingsStore;
  projectStore: ProjectStore;
  activeJobs: Map<string, CrawlerOrchestrator>;
  analyzeCache: Map<string, { result: AnalyzeResult; screenshot?: Buffer }>;
  lastAnalyzeResult: AnalyzeResult | null;
  lastAnalyzeScreenshot: Buffer | null;
}

export function normalizeUrlKey(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    return `${u.origin}${u.pathname}`.replace(/\/+$/, '').toLowerCase();
  } catch {
    return rawUrl.trim().replace(/\/+$/, '').toLowerCase();
  }
}

export function getDynamicFolder(name: 'downloads' | 'documents' | 'desktop'): string {
  try {
    if (app && typeof app.getPath === 'function') {
      return app.getPath(name);
    }
  } catch {}
  const base = process.env.USERPROFILE || os.homedir();
  const folder = name.charAt(0).toUpperCase() + name.slice(1);
  return path.join(base, folder);
}

export function createIpcRuntimeContext(mainWindow?: BrowserWindow): IpcRuntimeContext {
  const pageRenderer = new PageRenderer();
  return {
    mainWindow,
    pageRenderer,
    techDetector: new TechDetector(),
    designAnalyzer: new DesignAnalyzer(pageRenderer),
    siteMapper: new SiteMapper(),
    securityScanner: new SecurityScanner(),
    sizeEstimator: new SizeEstimator(),
    settingsStore: SettingsStore.getInstance(),
    projectStore: ProjectStore.getInstance(),
    activeJobs: new Map(),
    analyzeCache: new Map(),
    lastAnalyzeResult: null,
    lastAnalyzeScreenshot: null,
  };
}
