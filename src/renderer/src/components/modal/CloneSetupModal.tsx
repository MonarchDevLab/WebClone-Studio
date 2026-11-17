import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Download, X, Zap } from 'lucide-react';
import { CloneSettings } from '@shared/types';
import { buildDefaultUserAgent } from '@shared/version';
import { useAnalyzeStore } from '../../stores/analyze-store';
import { useCloneStore } from '../../stores/clone-store';
import { useUiStore } from '../../stores/ui-store';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { StepTargetLocation } from './steps/StepTargetLocation';
import { StepEngineSpeed } from './steps/StepEngineSpeed';
import { StepFilters } from './steps/StepFilters';
import { StepSummary } from './steps/StepSummary';
import { toast } from 'sonner';

interface CloneSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CloneSetupModal: React.FC<CloneSetupModalProps> = ({ isOpen, onClose }) => {
  const { url } = useAnalyzeStore();
  const { startClone } = useCloneStore();
  const { setActiveTab } = useUiStore();
  const modalRef = useRef<HTMLDivElement>(null);

  useFocusTrap(isOpen, modalRef, onClose);

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

  const [settings, setSettings] = useState<CloneSettings>({
    mode: 'static',
    maxDepth: 3,
    concurrentDownloads: 6,
    rateLimit: 120,
    respectRobotsTxt: false,
    downloadImages: true,
    downloadFonts: true,
    downloadMedia: true,
    downloadDocuments: true,
    downloadArchives: true,
    downloadData: true,
    downloadExternalAssets: true,
    crawlSubdomains: false,
    includedPatterns: [],
    excludedPatterns: ['/admin/*', '/api/*', '/login*'],
    maxFileSize: 100 * 1024 * 1024,
    userAgent: buildDefaultUserAgent(),
    reverseEngineering: true,
    ignoreSslErrors: false,
    exportWacz: false,
  });

  const [includePatternText, setIncludePatternText] = useState<string>('');
  const [excludePatternText, setExcludePatternText] = useState<string>('/admin/*, /api/*, /login*');
  const [authCookieCount, setAuthCookieCount] = useState<number>(0);
  const [isAuthOpening, setIsAuthOpening] = useState<boolean>(false);

  const handleOpenAuthSession = async () => {
    if (!url || !window.electronAPI?.openAuthSession) return;
    setIsAuthOpening(true);
    try {
      const res = await window.electronAPI.openAuthSession(url);
      setAuthCookieCount(res.cookieCount || 0);
      if (res.cookieCount > 0) {
        toast.success(`${res.cookieCount} adet oturum çerezi yakalandı ve klonlama motoruna bağlandı.`);
      } else {
        toast.info('Oturum penceresi kapatıldı.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Oturum penceresi açılamadı.');
    } finally {
      setIsAuthOpening(false);
    }
  };

  useEffect(() => {
    if (url) {
      try {
        const domain = new URL(url).hostname;
        setProjectName(domain);
        if (window.electronAPI?.getEstimate) {
          window.electronAPI
            .getEstimate(url, settings.maxDepth)
            .then((data) => setEstimateData(data))
            .catch(() => {});
        }
      } catch {}
    }
  }, [url, settings.maxDepth]);

  useEffect(() => {
    if (isOpen && window.electronAPI?.getSettings) {
      window.electronAPI
        .getSettings()
        .then((s) => {
          if (!s) return;
          setSettings((prev) => ({
            ...prev,
            userAgent: s.userAgent || prev.userAgent,
            concurrentDownloads: s.defaultThreads || prev.concurrentDownloads,
            rateLimit: s.defaultRateLimit ?? prev.rateLimit,
            downloadImages: s.defaultDownloadImages ?? prev.downloadImages,
            downloadFonts: s.defaultDownloadFonts ?? prev.downloadFonts,
            downloadMedia: s.defaultDownloadMedia ?? prev.downloadMedia,
            downloadDocuments: s.defaultDownloadDocuments ?? prev.downloadDocuments,
            downloadArchives: s.defaultDownloadArchives ?? prev.downloadArchives,
            downloadData: s.defaultDownloadData ?? prev.downloadData,
            crawlSubdomains: s.defaultCrawlSubdomains ?? prev.crawlSubdomains,
            downloadExternalAssets: s.defaultDownloadExternalAssets ?? prev.downloadExternalAssets,
            reverseEngineering: s.defaultReverseEngineering ?? prev.reverseEngineering,
            exportWacz: s.defaultExportWacz ?? prev.exportWacz,
          }));
          if (s.defaultOutputDir) {
            setOutputPath((prev) => prev || s.defaultOutputDir);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectDirectory = async () => {
    if (window.electronAPI?.selectDirectory) {
      const selected = await window.electronAPI.selectDirectory();
      if (selected) setOutputPath(selected);
    }
  };

  const handleStartClone = async () => {
    if (!url) {
      toast.error('Lütfen geçerli bir URL girin.');
      return;
    }

    const finalSettings: CloneSettings = {
      ...settings,
      includedPatterns: includePatternText.split(',').map((s) => s.trim()).filter(Boolean),
      excludedPatterns: excludePatternText.split(',').map((s) => s.trim()).filter(Boolean),
    };

    try {
      await startClone(
        url,
        finalSettings,
        outputPath,
        projectName,
        openFolderOnComplete,
        openBrowserOnComplete
      );
      toast.success('Klonlama motoru başlatıldı!');
      onClose();
      setActiveTab('clone');
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Klonlama başlatılamadı.';
      toast.error(errMsg);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="clone-modal-title"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-surface-1 border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/80 overflow-hidden flex flex-col max-h-[90vh] focus:outline-none"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-surface-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/10 text-accent-hover border border-accent/20 rounded-xl">
              <Download size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="clone-modal-title" className="text-sm font-bold text-text-primary">
                  Klonlama Kurulum Sihirbazı
                </h2>
                <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-accent/50 text-accent-hover border border-accent/30 rounded-full">
                  Canlı Yapılandırma
                </span>
              </div>
              <p className="text-xs text-text-muted font-mono truncate max-w-md">
                {url || 'Hedef URL seçilmedi'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Sihirbazı kapat"
            className="text-text-muted hover:text-text-primary p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-4 border-b border-white/[0.06] bg-surface-1 text-xs text-center select-none font-mono">
          {[
            { num: 1, title: 'Hedef Konum' },
            { num: 2, title: 'Motor & Hız' },
            { num: 3, title: 'Filtreler' },
            { num: 4, title: 'Özet & Başlat' },
          ].map((step) => (
            <button
              key={step.num}
              type="button"
              onClick={() => setCurrentStep(step.num)}
              aria-current={currentStep === step.num ? 'step' : undefined}
              aria-label={`Adım ${step.num}: ${step.title}${
                currentStep > step.num ? ' (tamamlandı)' : currentStep === step.num ? ' (şu an)' : ''
              }`}
              className={`py-3 px-2 flex items-center justify-center gap-2 cursor-pointer transition-all border-b-2 ${
                currentStep === step.num
                  ? 'border-accent-hover text-accent-hover font-bold bg-accent/20'
                  : currentStep > step.num
                    ? 'border-success-hover text-success-hover'
                    : 'border-transparent text-text-muted hover:text-text-secondary'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  currentStep === step.num
                    ? 'bg-accent text-black shadow-sm shadow-accent/50'
                    : currentStep > step.num
                      ? 'bg-success text-black'
                      : 'bg-surface-3 text-text-dim'
                }`}
                aria-hidden="true"
              >
                {currentStep > step.num ? <Check size={12} strokeWidth={3} /> : step.num}
              </span>
              <span>{step.title}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {currentStep === 1 && (
            <StepTargetLocation
              outputPath={outputPath}
              setOutputPath={setOutputPath}
              projectName={projectName}
              setProjectName={setProjectName}
              estimateData={estimateData}
              onSelectDirectory={handleSelectDirectory}
            />
          )}
          {currentStep === 2 && (
            <StepEngineSpeed
              url={url}
              settings={settings}
              setSettings={setSettings}
              authCookieCount={authCookieCount}
              isAuthOpening={isAuthOpening}
              onOpenAuthSession={handleOpenAuthSession}
            />
          )}
          {currentStep === 3 && (
            <StepFilters
              settings={settings}
              setSettings={setSettings}
              excludePatternText={excludePatternText}
              setExcludePatternText={setExcludePatternText}
              includePatternText={includePatternText}
              setIncludePatternText={setIncludePatternText}
            />
          )}
          {currentStep === 4 && (
            <StepSummary
              url={url}
              projectName={projectName}
              settings={settings}
              openFolderOnComplete={openFolderOnComplete}
              setOpenFolderOnComplete={setOpenFolderOnComplete}
              openBrowserOnComplete={openBrowserOnComplete}
              setOpenBrowserOnComplete={setOpenBrowserOnComplete}
            />
          )}
        </div>

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
              className="px-4 py-2 hover:bg-white/[0.05] text-xs text-text-muted hover:text-text-primary rounded-lg transition-colors cursor-pointer"
            >
              İptal
            </button>

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep + 1)}
                className="flex items-center gap-1.5 px-5 py-2 bg-accent hover:bg-accent-hover text-xs font-bold text-black rounded-lg transition-all shadow-lg shadow-accent/20 active:scale-95 cursor-pointer"
              >
                <span>İleri</span>
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartClone}
                className="flex items-center gap-2 px-6 py-2.5 bg-success hover:bg-success-hover text-xs font-bold text-black rounded-lg transition-all shadow-lg shadow-success/30 active:scale-95 cursor-pointer"
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
