import React, { useState, useEffect } from 'react';
import { 
  X, Folder, HardDrive, Shield, Zap, Filter, CheckCircle2, Check,
  ArrowRight, ArrowLeft, Download, FileText, Monitor, AlertTriangle, Cpu,
  FolderOpen, Globe
} from 'lucide-react';
import { CloneSettings } from '@shared/types';
import { useAnalyzeStore } from '../../stores/analyze-store';
import { useCloneStore } from '../../stores/clone-store';
import { useUiStore } from '../../stores/ui-store';
import { formatBytes } from '../../lib/utils';
import { toast } from 'sonner';

interface CloneSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CloneSetupModal: React.FC<CloneSetupModalProps> = ({ isOpen, onClose }) => {
  const { url, analyzeResult } = useAnalyzeStore();
  const { startClone } = useCloneStore();
  const { setActiveTab } = useUiStore();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [projectName, setProjectName] = useState<string>('');
  const [outputPath, setOutputPath] = useState<string>('');
  const [openFolderOnComplete, setOpenFolderOnComplete] = useState<boolean>(true);
  const [openBrowserOnComplete, setOpenBrowserOnComplete] = useState<boolean>(false);
  const [estimateData, setEstimateData] = useState<{
    estimatedPages: number;
    estimatedAssets: number;
    estimatedSizeBytes: number;
    freeSpaceBytes?: number;
    hasSufficientDisk?: boolean;
  } | null>(null);

  // Klonlama ayarları state
  const [settings, setSettings] = useState<CloneSettings>({
    mode: 'static',
    maxDepth: 3,
    concurrentDownloads: 6,
    rateLimit: 120,
    respectRobotsTxt: false,
    downloadImages: true,
    downloadFonts: true,
    downloadMedia: true,
    downloadExternalAssets: true,
    includedPatterns: [],
    excludedPatterns: ['/admin/*', '/api/*', '/login*'],
    maxFileSize: 100 * 1024 * 1024,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });

  const [includePatternText, setIncludePatternText] = useState<string>('');
  const [excludePatternText, setExcludePatternText] = useState<string>('/admin/*, /api/*, /login*');

  useEffect(() => {
    if (url) {
      try {
        const domain = new URL(url).hostname;
        setProjectName(domain);
        // Boyut tahmini al
        if (window.electronAPI?.getEstimate) {
          window.electronAPI.getEstimate(url, settings.maxDepth)
            .then(data => setEstimateData(data))
            .catch(() => {});
        }
      } catch {}
    }
  }, [url, settings.maxDepth]);

  // Ayarlar sayfasında kaydedilen varsayılanları modal açılışında yükle (Faz 4.2)
  useEffect(() => {
    if (isOpen && window.electronAPI?.getSettings) {
      window.electronAPI.getSettings()
        .then((s) => {
          if (!s) return;
          setSettings(prev => ({
            ...prev,
            userAgent: s.userAgent || prev.userAgent,
            concurrentDownloads: s.defaultThreads || prev.concurrentDownloads,
            rateLimit: s.defaultRateLimit ?? prev.rateLimit,
          }));
          if (s.defaultOutputDir) {
            setOutputPath(prev => prev ? prev : s.defaultOutputDir);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Escape tuşu ile modalı kapatma desteği
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Klasör seçici
  const handleSelectDirectory = async () => {
    if (window.electronAPI?.selectDirectory) {
      const selected = await window.electronAPI.selectDirectory();
      if (selected) {
        setOutputPath(selected);
      }
    }
  };

  // Hızlı konum seçimi
  const handleQuickLocation = (loc: 'downloads' | 'documents' | 'desktop') => {
    setOutputPath(loc);
  };

  // Klonlamayı başlat
  const handleStartClone = async () => {
    if (!url) {
      toast.error('Lütfen geçerli bir URL girin.');
      return;
    }

    const finalSettings: CloneSettings = {
      ...settings,
      includedPatterns: includePatternText.split(',').map(s => s.trim()).filter(Boolean),
      excludedPatterns: excludePatternText.split(',').map(s => s.trim()).filter(Boolean),
    };

    try {
      await startClone(url, finalSettings, outputPath, projectName, openFolderOnComplete, openBrowserOnComplete);
      toast.success('Klonlama motoru başlatıldı!');
      onClose();
      setActiveTab('clone');
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Klonlama başlatılamadı.';
      toast.error(errMsg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-surface-1 border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/80 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Başlık & Kapat */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-surface-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/10 text-accent-hover border border-accent/20 rounded-xl">
              <Download size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-text-primary">Klonlama Kurulum Sihirbazı</h2>
                <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-accent/50 text-accent-hover border border-accent/30 rounded-full">
                  Canlı Yapılandırma
                </span>
              </div>
              <p className="text-xs text-text-muted font-mono truncate max-w-md">{url || 'Hedef URL seçilmedi'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Sihirbazı kapat"
            className="text-text-muted hover:text-text-primary p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Adım Göstergesi (Step Indicator) */}
        <div className="grid grid-cols-4 border-b border-white/[0.06] bg-surface-1 text-xs text-center select-none font-mono">
          {[
            { num: 1, title: 'Hedef Konum' },
            { num: 2, title: 'Motor & Hız' },
            { num: 3, title: 'Filtreler' },
            { num: 4, title: 'Özet & Başlat' },
          ].map(step => (
            <button
              key={step.num}
              type="button"
              onClick={() => setCurrentStep(step.num)}
              aria-current={currentStep === step.num ? 'step' : undefined}
              aria-label={`Adım ${step.num}: ${step.title}${currentStep > step.num ? ' (tamamlandı)' : currentStep === step.num ? ' (şu an)' : ''}`}
              className={`py-3 px-2 flex items-center justify-center gap-2 cursor-pointer transition-all border-b-2 ${
                currentStep === step.num
                  ? 'border-accent-hover text-accent-hover font-bold bg-accent/20'
                  : currentStep > step.num
                    ? 'border-success-hover text-success-hover'
                    : 'border-transparent text-text-muted hover:text-text-secondary'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                currentStep === step.num
                  ? 'bg-accent text-black shadow-sm shadow-accent/50'
                  : currentStep > step.num
                    ? 'bg-success text-black'
                    : 'bg-surface-3 text-text-dim'
              }`} aria-hidden="true">
                {currentStep > step.num ? <Check size={12} strokeWidth={3} /> : step.num}
              </span>
              <span>{step.title}</span>
            </button>
          ))}
        </div>

        {/* Modal İçerik Gövdesi */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ADIM 1: HEDEF KONUM */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <label className="block text-xs font-semibold text-text-primary uppercase tracking-wider mb-2">
                  Kaydetme Konumu (Klasör)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={outputPath}
                    onChange={(e) => setOutputPath(e.target.value)}
                    placeholder="Varsayılan: Downloads/WebClone"
                    className="flex-1 bg-surface-2 border border-white/[0.1] rounded-lg px-3.5 py-2 text-xs text-text-primary focus:outline-none focus:border-accent font-mono"
                  />
                  <button
                    onClick={handleSelectDirectory}
                    className="flex items-center gap-1.5 px-4 py-2 bg-surface-3 hover:bg-white/[0.08] border border-white/[0.1] hover:border-white/[0.16] rounded-lg text-xs font-medium text-text-primary transition-all cursor-pointer"
                  >
                    <Folder size={14} className="text-accent-hover" />
                    <span>Gözat</span>
                  </button>
                </div>
              </div>

              {/* Hızlı Seçim Butonları */}
              <div>
                <span className="block text-[11px] text-text-muted mb-2 font-mono">Hızlı Şablon Konum:</span>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => handleQuickLocation('downloads')}
                    aria-pressed={outputPath === 'downloads'}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                      outputPath === 'downloads' 
                        ? 'bg-accent/30 border-accent/50 shadow-sm' 
                        : 'bg-surface-2 hover:bg-surface-3 border-white/[0.06]'
                    }`}
                  >
                    <Download size={16} className="text-accent-hover flex-shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-text-primary">İndirilenler</div>
                      <div className="text-[10px] text-text-dim font-mono">Downloads/WebClone</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickLocation('documents')}
                    aria-pressed={outputPath === 'documents'}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                      outputPath === 'documents' 
                        ? 'bg-success/30 border-success/50 shadow-sm' 
                        : 'bg-surface-2 hover:bg-surface-3 border-white/[0.06]'
                    }`}
                  >
                    <FileText size={16} className="text-success-hover flex-shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-text-primary">Belgeler</div>
                      <div className="text-[10px] text-text-dim font-mono">Documents/WebClone</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickLocation('desktop')}
                    aria-pressed={outputPath === 'desktop'}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                      outputPath === 'desktop' 
                        ? 'bg-secondary/30 border-secondary/50 shadow-sm' 
                        : 'bg-surface-2 hover:bg-surface-3 border-white/[0.06]'
                    }`}
                  >
                    <Monitor size={16} className="text-secondary-hover flex-shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-text-primary">Masaüstü</div>
                      <div className="text-[10px] text-text-dim font-mono">Desktop/WebClone</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Proje Adı */}
              <div>
                <label className="block text-xs font-semibold text-text-primary uppercase tracking-wider mb-2">
                  Proje / Klasör Adı
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="örn: react.dev"
                  className="w-full bg-surface-2 border border-white/[0.1] rounded-lg px-3.5 py-2 text-xs text-text-primary focus:outline-none focus:border-accent font-mono"
                />
                <p className="text-[11px] text-text-dim mt-1.5 font-mono">
                  Oluşturulacak klasör formatı: <code>{projectName || 'site'}_YYYY-MM-DD/</code>
                </p>
              </div>

              {/* Disk Alanı Bilgisi */}
              <div className="p-3.5 bg-surface-2 border border-white/[0.08] rounded-xl flex items-center justify-between text-xs">
                <div className="flex flex-col gap-1 text-text-secondary">
                  <div className="flex items-center gap-2.5">
                    <HardDrive size={16} className="text-accent-hover" />
                    <span>
                      Tahmini Boyut: <strong className="text-text-primary font-mono font-bold">
                        {estimateData ? `~${formatBytes(estimateData.estimatedSizeBytes)}` : '~25 - 50 MB'}
                      </strong>
                    </span>
                  </div>
                  {estimateData && (
                    <div className="text-[11px] ml-6 font-mono text-text-dim opacity-70">
                      Öngörülen: {estimateData.estimatedPages} sayfa, {estimateData.estimatedAssets} varlık
                    </div>
                  )}
                </div>
                <span className={`text-[11px] font-medium font-mono flex items-center gap-1 ${
                  estimateData?.hasSufficientDisk === false ? 'text-error-hover' : 'text-success-hover'
                }`}>
                  {estimateData?.hasSufficientDisk === false ? (
                    <>
                      <AlertTriangle size={13} /> Disk Alanı Yetersiz Olabilir
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={13} /> Yeterli Boş Alan Mevcut
                    </>
                  )}
                </span>
              </div>

              {/* Geniş Site Kapsam Uyarısı (Scope Guard) */}
              {estimateData && estimateData.estimatedPages > 80 && (
                <div className="p-3 bg-warning/10 border border-warning/20 rounded-xl flex items-center gap-2.5 text-xs text-warning-hover">
                  <AlertTriangle size={15} className="flex-shrink-0" />
                  <span>
                    Geniş site yapısı tespit edildi (~{estimateData.estimatedPages} sayfa). Klonlama süresini optimize etmek için derinliği 1 veya 2 tutmanız önerilir.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ADIM 2: AYARLAR */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Klonlama Modu */}
              <div>
                <label className="block text-xs font-semibold text-text-primary uppercase tracking-wider mb-2">
                  Klonlama Motoru Modu
                </label>
                <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Klonlama motoru modu">
                  <div
                    role="radio"
                    tabIndex={0}
                    aria-checked={settings.mode === 'static'}
                    onClick={() => setSettings({ ...settings, mode: 'static' })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSettings({ ...settings, mode: 'static' });
                      }
                    }}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      settings.mode === 'static'
                        ? 'bg-accent/20 border-accent/50 text-text-primary shadow-sm'
                        : 'bg-surface-2 border-white/[0.06] text-text-muted hover:border-white/[0.12]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-text-primary">Statik Mod (Ultra Hızlı)</span>
                      <span className="text-[9px] font-mono bg-accent text-accent-hover border border-accent/30 px-1.5 py-0.5 rounded">
                        got + cheerio
                      </span>
                    </div>
                    <p className="text-[11px] text-text-dim leading-relaxed">
                      Klasik siteler ve SSR için idealdir. JS çalıştırmadan doğrudan HTML/CSS ayrıştırır.
                    </p>
                  </div>

                  <div
                    role="radio"
                    tabIndex={0}
                    aria-checked={settings.mode === 'dynamic'}
                    onClick={() => setSettings({ ...settings, mode: 'dynamic' })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSettings({ ...settings, mode: 'dynamic' });
                      }
                    }}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      settings.mode === 'dynamic'
                        ? 'bg-secondary/20 border-secondary/50 text-text-primary shadow-sm'
                        : 'bg-surface-2 border-white/[0.06] text-text-muted hover:border-white/[0.12]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-text-primary">Dinamik Mod (SPA)</span>
                      <span className="text-[9px] font-mono bg-secondary text-secondary-hover border border-secondary/30 px-1.5 py-0.5 rounded">
                        Yerleşik Chromium
                      </span>
                    </div>
                    <p className="text-[11px] text-text-dim leading-relaxed">
                      React, Vue, Next.js gibi istemci tarafında render edilen modern SPA siteler için DOM çalıştırır.
                    </p>
                  </div>
                </div>
              </div>

              {/* Sayısal Kontroller */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface-2 border border-white/[0.06] rounded-xl p-3.5">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-medium text-text-secondary">Tarama Derinliği (Depth):</span>
                    <span className="font-mono text-accent-hover font-bold text-xs">{settings.maxDepth}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={settings.maxDepth}
                    onChange={(e) => setSettings({ ...settings, maxDepth: Number(e.target.value) })}
                    className="w-full accent-accent-hover"
                  />
                  <span className="text-[10px] text-text-dim block mt-1 font-mono">1 = tek sayfa, 3 = dengeli ağaç</span>
                </div>

                <div className="bg-surface-2 border border-white/[0.06] rounded-xl p-3.5">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-medium text-text-secondary">Eşzamanlı Havuz (Threads):</span>
                    <span className="font-mono text-success-hover font-bold text-xs">{settings.concurrentDownloads}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={15}
                    value={settings.concurrentDownloads}
                    onChange={(e) => setSettings({ ...settings, concurrentDownloads: Number(e.target.value) })}
                    className="w-full accent-success-hover"
                  />
                  <span className="text-[10px] text-text-dim block mt-1 font-mono">Aynı anda havuzda çalışan indirme</span>
                </div>
              </div>

              {/* Checkbox Seçenekleri */}
              <div className="space-y-2.5 pt-2 border-t border-white/[0.06]">
                <label className="flex items-center gap-2.5 text-xs text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.respectRobotsTxt}
                    onChange={(e) => setSettings({ ...settings, respectRobotsTxt: e.target.checked })}
                    className="rounded accent-accent-hover"
                  />
                  <span>robots.txt kurallarına uy (Etik crawling motoru)</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.downloadExternalAssets}
                    onChange={(e) => setSettings({ ...settings, downloadExternalAssets: e.target.checked })}
                    className="rounded accent-accent-hover"
                  />
                  <span>Harici domain varlıklarını indir (CDN, Google Fonts, jsDelivr, font dosyaları)</span>
                </label>
              </div>
            </div>
          )}

          {/* ADIM 3: FİLTRELER */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <label className="block text-xs font-semibold text-text-primary uppercase tracking-wider mb-2">
                  İndirilecek Varlık Türleri
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: 'downloadImages', label: 'Resimler (png, jpg, webp, svg)', state: settings.downloadImages },
                    { key: 'downloadFonts', label: 'Fontlar (woff2, ttf, otf)', state: settings.downloadFonts },
                    { key: 'downloadMedia', label: 'Medya (mp4, mp3)', state: settings.downloadMedia },
                  ].map(item => (
                    <label 
                      key={item.key} 
                      className={`flex items-center gap-2.5 p-3 border rounded-xl text-xs cursor-pointer transition-all ${
                        item.state 
                          ? 'bg-accent/20 border-accent/40 text-text-primary' 
                          : 'bg-surface-2 border-white/[0.06] text-text-muted hover:border-white/[0.12]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={item.state}
                        onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
                        className="rounded accent-accent-hover"
                      />
                      <span className="font-medium">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* URL Hariç Tutma Desenleri */}
              <div>
                <label className="block text-xs font-semibold text-text-primary uppercase tracking-wider mb-1.5">
                  Hariç Tutulacak URL Desenleri (Virgülle ayırın)
                </label>
                <input
                  type="text"
                  value={excludePatternText}
                  onChange={(e) => setExcludePatternText(e.target.value)}
                  placeholder="/admin/*, /api/*, /cart, /login"
                  className="w-full bg-surface-2 border border-white/[0.1] rounded-lg px-3.5 py-2 text-xs text-text-primary focus:outline-none focus:border-accent font-mono"
                />
                <span className="text-[10px] text-text-dim mt-1 block font-mono">Gereksiz sayfaların indirilmesini önler.</span>
              </div>

              {/* URL Dahil Etme */}
              <div>
                <label className="block text-xs font-semibold text-text-primary uppercase tracking-wider mb-1.5">
                  Sadece Dahil Edilecek URL Desenleri (Opsiyonel)
                </label>
                <input
                  type="text"
                  value={includePatternText}
                  onChange={(e) => setIncludePatternText(e.target.value)}
                  placeholder="/blog/*, /docs/*, /urunler/*"
                  className="w-full bg-surface-2 border border-white/[0.1] rounded-lg px-3.5 py-2 text-xs text-text-primary focus:outline-none focus:border-accent font-mono"
                />
              </div>
            </div>
          )}

          {/* ADIM 4: ÖZET & ONAY */}
          {currentStep === 4 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-surface-2 border border-white/[0.08] rounded-xl p-4 space-y-3 text-xs">
                <div className="flex justify-between pb-2 border-b border-white/[0.06]">
                  <span className="text-text-muted">Kaynak Hedef:</span>
                  <span className="text-text-primary font-mono font-medium truncate max-w-sm">{url}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-white/[0.06]">
                  <span className="text-text-muted">Proje Klasör Adı:</span>
                  <span className="text-accent-hover font-mono font-bold">{projectName || 'site'}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-white/[0.06]">
                  <span className="text-text-muted">Klonlama Modu:</span>
                  <span className="text-secondary-hover font-semibold font-mono">
                    {settings.mode === 'static' ? 'Statik got/cheerio' : 'Dinamik (Yerleşik Chromium SPA)'}
                  </span>
                </div>
                <div className="flex justify-between pb-2 border-b border-white/[0.06]">
                  <span className="text-text-muted">Derinlik & Eşzamanlılık:</span>
                  <span className="text-text-primary font-mono">{settings.maxDepth} Seviye / {settings.concurrentDownloads} Havuz İş Parçacığı</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-white/[0.06]">
                  <span className="text-text-muted">Varlık Tipleri:</span>
                  <span className="text-text-primary font-mono flex items-center gap-2 flex-wrap">
                    <span>HTML, CSS, JS</span>
                    {settings.downloadImages && (
                      <span className="inline-flex items-center gap-1 text-accent-hover text-xs">
                        <Check size={12} strokeWidth={2.5} /> Resimler
                      </span>
                    )}
                    {settings.downloadFonts && (
                      <span className="inline-flex items-center gap-1 text-accent-hover text-xs">
                        <Check size={12} strokeWidth={2.5} /> Fontlar
                      </span>
                    )}
                    {settings.downloadMedia && (
                      <span className="inline-flex items-center gap-1 text-accent-hover text-xs">
                        <Check size={12} strokeWidth={2.5} /> Medya
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Çıktı & Raporlama:</span>
                  <span className="text-success-hover font-medium font-mono">manifest.json + _meta/ + _screenshots/ + site/</span>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-3">
                <label className="flex items-center gap-2.5 text-xs text-text-secondary cursor-pointer hover:text-text-primary transition-colors">
                  <input
                    type="checkbox"
                    checked={openFolderOnComplete}
                    onChange={(e) => setOpenFolderOnComplete(e.target.checked)}
                    className="rounded accent-accent-hover w-3.5 h-3.5 cursor-pointer"
                  />
                  <FolderOpen size={15} className="text-accent-hover" />
                  <span>Klonlama tamamlandığında klasörü <strong>Dosya Gezgini'nde</strong> aç</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-text-secondary cursor-pointer hover:text-text-primary transition-colors">
                  <input
                    type="checkbox"
                    checked={openBrowserOnComplete}
                    onChange={(e) => setOpenBrowserOnComplete(e.target.checked)}
                    className="rounded accent-accent-hover w-3.5 h-3.5 cursor-pointer"
                  />
                  <Globe size={15} className="text-secondary-hover" />
                  <span>Klonlama tamamlandığında siteyi <strong>Varsayılan Tarayıcıda</strong> aç</span>
                </label>
              </div>
            </div>
          )}

        </div>

        {/* Alt Butonlar Barı */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.08] bg-surface-2">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep(currentStep - 1)}
              className="flex items-center gap-1.5 px-4 py-2 bg-surface-3 hover:bg-white/[0.08] border border-white/[0.1] hover:border-white/[0.16] rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary transition-all cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Geri</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 hover:bg-white/[0.05] text-xs text-text-muted hover:text-text-primary rounded-lg transition-colors"
            >
              İptal
            </button>

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep + 1)}
                className="flex items-center gap-1.5 px-5 py-2 bg-accent hover:bg-accent-hover text-xs font-bold text-black rounded-lg transition-all shadow-lg shadow-accent/20 active:scale-95"
              >
                <span>İleri</span>
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartClone}
                className="flex items-center gap-2 px-6 py-2.5 bg-success hover:bg-success-hover text-xs font-bold text-black rounded-lg transition-all shadow-lg shadow-success/30 active:scale-95"
              >
                <Zap size={15} />
                <span>Klonlamayı Başlat</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
