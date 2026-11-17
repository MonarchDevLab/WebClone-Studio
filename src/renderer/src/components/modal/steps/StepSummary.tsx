import React from 'react';
import { Check, FolderOpen, Globe } from 'lucide-react';
import { CloneSettings } from '@shared/types';

interface StepSummaryProps {
  url: string;
  projectName: string;
  settings: CloneSettings;
  openFolderOnComplete: boolean;
  setOpenFolderOnComplete: (val: boolean) => void;
  openBrowserOnComplete: boolean;
  setOpenBrowserOnComplete: (val: boolean) => void;
}

export const StepSummary: React.FC<StepSummaryProps> = ({
  url,
  projectName,
  settings,
  openFolderOnComplete,
  setOpenFolderOnComplete,
  openBrowserOnComplete,
  setOpenBrowserOnComplete,
}) => {
  return (
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
            {settings.mode === 'static'
              ? 'Statik (Chromium session.fetch + cheerio)'
              : 'Dinamik (Yerleşik Chromium SPA)'}
          </span>
        </div>
        <div className="flex justify-between pb-2 border-b border-white/[0.06]">
          <span className="text-text-muted">Derinlik & Eşzamanlılık:</span>
          <span className="text-text-primary font-mono">
            {settings.maxDepth} Seviye / {settings.concurrentDownloads} Havuz İş Parçacığı
          </span>
        </div>
        <div className="flex justify-between pb-2 border-b border-white/[0.06]">
          <span className="text-text-muted">Varlık Tipleri:</span>
          <span className="text-text-primary font-mono flex items-center gap-2 flex-wrap justify-end">
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
            {settings.downloadDocuments && (
              <span className="inline-flex items-center gap-1 text-accent-hover text-xs">
                <Check size={12} strokeWidth={2.5} /> Belgeler
              </span>
            )}
            {settings.downloadArchives && (
              <span className="inline-flex items-center gap-1 text-accent-hover text-xs">
                <Check size={12} strokeWidth={2.5} /> Arşivler
              </span>
            )}
            {settings.downloadData && (
              <span className="inline-flex items-center gap-1 text-accent-hover text-xs">
                <Check size={12} strokeWidth={2.5} /> Veriler
              </span>
            )}
          </span>
        </div>
        <div className="flex justify-between pb-2 border-b border-white/[0.06]">
          <span className="text-text-muted">Tersine Mühendislik & WACZ:</span>
          <span
            className={`font-mono font-medium ${
              settings.reverseEngineering ? 'text-accent-hover' : 'text-text-dim'
            }`}
          >
            {settings.reverseEngineering ? 'Aktif' : 'Kapalı'}
            {settings.exportWacz ? ' + WACZ 1.1.1' : ''}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Çıktı & Raporlama:</span>
          <span className="text-success-hover font-medium font-mono">
            manifest.json + _meta/ + _exports/ + site/
          </span>
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
          <span>
            Klonlama tamamlandığında klasörü <strong>Dosya Gezgini&apos;nde</strong> aç
          </span>
        </label>
        <label className="flex items-center gap-2.5 text-xs text-text-secondary cursor-pointer hover:text-text-primary transition-colors">
          <input
            type="checkbox"
            checked={openBrowserOnComplete}
            onChange={(e) => setOpenBrowserOnComplete(e.target.checked)}
            className="rounded accent-accent-hover w-3.5 h-3.5 cursor-pointer"
          />
          <Globe size={15} className="text-secondary-hover" />
          <span>
            Klonlama tamamlandığında siteyi <strong>Varsayılan Tarayıcıda</strong> aç
          </span>
        </label>
      </div>
    </div>
  );
};
