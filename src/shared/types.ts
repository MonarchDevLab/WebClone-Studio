/**
 * Ortak TypeScript tipleri.
 */

/** Teknoloji kategorileri */
export type TechCategory = 
  | 'CMS' 
  | 'Framework' 
  | 'CSS Framework' 
  | 'Analytics' 
  | 'CDN' 
  | 'Hosting' 
  | 'Server' 
  | 'Language' 
  | 'JavaScript Library' 
  | 'Font Service' 
  | 'Tag Manager' 
  | 'A/B Testing' 
  | 'Payment' 
  | 'Chat Widget';

/** Analiz sırasında algılanan teknolojinin imzası */
export interface TechSignature {
  name: string;
  category: TechCategory;
  confidence: number;
  version?: string;
  signals: string[];
}

/** Renk token'ı (Design token) */
export interface ColorToken {
  hex: string;
  name?: string;
  frequency: number;
  role: 'background' | 'foreground' | 'accent' | 'border' | 'muted';
}

/** Tipografi token'ı (Design token) */
export interface TypoToken {
  fontFamily: string;
  fontSize: string;
  fontWeight: string | number;
  lineHeight: string;
  letterSpacing?: string;
  role: 'heading' | 'body' | 'caption' | 'mono';
}

/** Gölge / Derinlik token'ı */
export interface ShadowToken {
  name: string;
  value: string;
}

/** Kenar yuvarlaklığı token'ı */
export interface RadiusToken {
  name: string;
  value: string;
}

/** Sayfada tespit edilen ana bileşen mimarisi */
export interface ComponentBlueprint {
  name: string;
  tag: string;
  classes?: string[];
  layout?: string;
  height?: string;
  minHeight?: string;
  background?: string;
  border?: string;
  backdropFilter?: string;
  color?: string;
  h1?: string;
  subhead?: string;
  links?: Array<{ text: string; href?: string }>;
  ctas?: string[];
}

/** Tasarım token'ları grubu (Kapsamlı $10K Sistem) */
export interface DesignTokens {
  colors: ColorToken[];
  typography: TypoToken[];
  spacing: number[];
  cssVariables?: Record<string, string>;
  shadows?: ShadowToken[];
  radii?: RadiusToken[];
  gradients?: string[];
  backdropBlurs?: string[];
  containerWidths?: string[];
  components?: ComponentBlueprint[];
  assets?: {
    logo?: string;
    favicon?: string;
    svgCount?: number;
    externalFonts?: string[];
  };
}

/** Site haritası düğümü */
export interface SiteMapNode {
  url: string;
  title?: string;
  depth: number;
  statusCode?: number;
  children: SiteMapNode[];
  mimeType?: string;
  size?: number;
  assetCount?: number;
}

/** Güvenlik bilgileri */
export interface SecurityInfo {
  https: boolean;
  hsts: boolean;
  csp: boolean;
  robotsTxt: boolean;
  sitemap: boolean;
  headers: Record<string, string>;
}

/** Meta bilgileri */
export interface SiteMeta {
  title?: string;
  description?: string;
  ogImage?: string;
  canonical?: string;
  language?: string;
  encoding?: string;
  viewport?: string;
  favicon?: string;
}

/** Kapsamlı analiz sonucu */
export interface AnalyzeResult {
  technologies: TechSignature[];
  designTokens: DesignTokens;
  siteMap: SiteMapNode;
  security: SecurityInfo;
  meta: SiteMeta;
  screenshotPath?: string;
}

/** Klonlama ayarları */
export interface CloneSettings {
  mode: 'static' | 'dynamic';
  maxDepth: number;
  concurrentDownloads: number;
  rateLimit: number;
  respectRobotsTxt: boolean;
  downloadImages: boolean;
  downloadFonts: boolean;
  downloadMedia: boolean;
  downloadDocuments: boolean;
  downloadArchives: boolean;
  downloadData: boolean;
  downloadExternalAssets: boolean;
  crawlSubdomains: boolean;
  includedPatterns: string[];
  excludedPatterns: string[];
  maxFileSize: number;
  userAgent: string;
}

/** Klonlama süreci ilerleme durumu */
export interface CloneProgress {
  downloaded: number;
  queued: number;
  failed: number;
  speed: number;
  activeUrl: string;
  eta: number;
  bytesTransferred: number;
  totalEstimatedBytes: number;
}

/** Dosya eklendi etkinliği */
export interface FileAddedEvent {
  path: string;
  size: number;
  mimeType: string;
  httpStatus: number;
  depth: number;
}

/** Klonlama günlük girdisi */
export interface CloneLogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: number;
  url?: string;
}

/** Klonlama tamamlama etkinliği */
export interface CloneCompleteEvent {
  totalFiles: number;
  totalSize: number;
  duration: number;
  outputPath: string;
  manifestPath: string;
}

/** Klonlama hata etkinliği */
export interface CloneErrorEvent {
  url: string;
  message: string;
  code: string;
  retryCount: number;
}

/** Proje manifestosu — indirilen her sitenin kimlik kartı (manifest.json) */
export interface ProjectManifest {
  version: string;
  generator: string;

  project: {
    name: string;
    slug: string;
    createdAt: string;
    completedAt?: string;
  };

  source: {
    url: string;
    domain: string;
    protocol: string;
    title?: string;
    description?: string;
    language?: string;
    encoding?: string;
  };

  settings: CloneSettings;

  statistics: {
    totalPages: number;
    totalAssets: number;
    totalFiles: number;
    totalSizeBytes: number;
    totalSizeHuman: string;
    failedUrls: number;
    durationSeconds: number;
    durationHuman: string;
    averageSpeedBps: number;
    averageSpeedHuman: string;
  };

  fileIndex: {
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

  technologies: TechSignature[];
  entryPoint: string;
  screenshotPath?: string;
}

/** Proje gösterim bilgisi (liste vb. için) */
export interface ProjectInfo {
  id: string;
  name: string;
  slug: string;
  url: string;
  domain: string;
  createdAt: number;
  completedAt?: number;
  totalFiles: number;
  totalSize: number;
  screenshotPath?: string;
  outputPath: string;
}

/** Disk alan bilgisi */
export interface DiskInfo {
  path: string;
  freeSpace: number;
  totalSpace: number;
}

/** Tahmin bilgisi */
export interface SizeEstimate {
  estimatedPages: number;
  estimatedAssets: number;
  estimatedSizeBytes: number;
  freeSpaceBytes?: number;
  hasSufficientDisk?: boolean;
}

/** Uygulama yapılandırma ve kullanıcı tercihleri */
export interface AppSettings {
  defaultOutputDir: string;
  userAgent: string;
  defaultThreads: number;
  defaultRateLimit: number;
  defaultDownloadImages?: boolean;
  defaultDownloadFonts?: boolean;
  defaultDownloadMedia?: boolean;
  defaultDownloadDocuments?: boolean;
  defaultDownloadArchives?: boolean;
  defaultDownloadData?: boolean;
  defaultCrawlSubdomains?: boolean;
  defaultDownloadExternalAssets?: boolean;
}
