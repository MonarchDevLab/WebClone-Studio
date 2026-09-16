import { ProjectManifest, CloneSettings, TechSignature } from '../../shared/types';
import { formatBytes, formatDuration } from '../utils/format-utils';

export interface ManifestOptions {
  projectName: string;
  targetUrl: string;
  settings: CloneSettings;
  technologies: TechSignature[];
  stats: {
    totalPages: number;
    totalAssets: number;
    totalFiles: number;
    totalSizeBytes: number;
    failedUrls: number;
    durationSeconds: number;
  };
  fileCounts: {
    html: { count: number; sizeBytes: number };
    css: { count: number; sizeBytes: number };
    js: { count: number; sizeBytes: number };
    images: { count: number; sizeBytes: number };
    fonts: { count: number; sizeBytes: number };
    media: { count: number; sizeBytes: number };
    documents: { count: number; sizeBytes: number };
    archives: { count: number; sizeBytes: number };
    data: { count: number; sizeBytes: number };
    other: { count: number; sizeBytes: number };
  };
  entryPoint?: string;
  screenshotPath?: string;
}

/**
 * İndirilen projenin kimlik kartı olan manifest.json dosyasını üretir.
 */
export class ManifestGenerator {
  public static generate(options: ManifestOptions): ProjectManifest {
    const parsedUrl = new URL(options.targetUrl);
    const dateStr = new Date().toISOString();
    const slug = `${parsedUrl.hostname.replace(/[^a-zA-Z0-9.-]/g, '_')}_${dateStr.substring(0, 10)}`;
    
    const avgSpeedBps = options.stats.durationSeconds > 0 
      ? Math.round(options.stats.totalSizeBytes / options.stats.durationSeconds) 
      : 0;

    return {
      version: '1.0',
      generator: 'WebClone Studio v1.0.0 (Monolith Works / MonarchDevLab)',

      project: {
        name: options.projectName,
        slug,
        createdAt: dateStr,
        completedAt: new Date().toISOString(),
      },

      source: {
        url: options.targetUrl,
        domain: parsedUrl.hostname,
        protocol: parsedUrl.protocol.replace(':', ''),
      },

      settings: options.settings,

      statistics: {
        totalPages: options.stats.totalPages,
        totalAssets: options.stats.totalAssets,
        totalFiles: options.stats.totalFiles,
        totalSizeBytes: options.stats.totalSizeBytes,
        totalSizeHuman: formatBytes(options.stats.totalSizeBytes),
        failedUrls: options.stats.failedUrls,
        durationSeconds: options.stats.durationSeconds,
        durationHuman: formatDuration(options.stats.durationSeconds),
        averageSpeedBps: avgSpeedBps,
        averageSpeedHuman: `${formatBytes(avgSpeedBps)}/s`,
      },

      fileIndex: options.fileCounts,
      technologies: options.technologies,
      entryPoint: options.entryPoint || 'site/index.html',
      screenshotPath: options.screenshotPath || '_screenshots/thumbnail.png',
    };
  }
}
