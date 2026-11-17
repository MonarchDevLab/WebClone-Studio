import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Folder,
  HardDrive,
  Monitor,
} from 'lucide-react';
import { SizeEstimate } from '@shared/types';
import { formatBytes } from '../../../lib/utils';

interface StepTargetLocationProps {
  outputPath: string;
  setOutputPath: (val: string) => void;
  projectName: string;
  setProjectName: (val: string) => void;
  estimateData: SizeEstimate | null;
  onSelectDirectory: () => void;
}

export const StepTargetLocation: React.FC<StepTargetLocationProps> = ({
  outputPath,
  setOutputPath,
  projectName,
  setProjectName,
  estimateData,
  onSelectDirectory,
}) => {
  return (
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
            type="button"
            onClick={onSelectDirectory}
            className="flex items-center gap-1.5 px-4 py-2 bg-surface-3 hover:bg-white/[0.08] border border-white/[0.1] hover:border-white/[0.16] rounded-lg text-xs font-medium text-text-primary transition-all cursor-pointer"
          >
            <Folder size={14} className="text-accent-hover" />
            <span>Gözat</span>
          </button>
        </div>
      </div>

      <div>
        <span className="block text-[11px] text-text-muted mb-2 font-mono">
          Hızlı Şablon Konum:
        </span>
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setOutputPath('downloads')}
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
            onClick={() => setOutputPath('documents')}
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
            onClick={() => setOutputPath('desktop')}
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

      <div className="p-3.5 bg-surface-2 border border-white/[0.08] rounded-xl flex items-center justify-between text-xs">
        <div className="flex flex-col gap-1 text-text-secondary">
          <div className="flex items-center gap-2.5">
            <HardDrive size={16} className="text-accent-hover" />
            <span>
              Tahmini Boyut:{' '}
              <strong className="text-text-primary font-mono font-bold">
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
        <span
          className={`text-[11px] font-medium font-mono flex items-center gap-1 ${
            estimateData?.hasSufficientDisk === false ? 'text-error-hover' : 'text-success-hover'
          }`}
        >
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

      {estimateData && estimateData.estimatedPages > 80 && (
        <div className="p-3 bg-warning/10 border border-warning/20 rounded-xl flex items-center gap-2.5 text-xs text-warning-hover">
          <AlertTriangle size={15} className="flex-shrink-0" />
          <span>
            Geniş site yapısı tespit edildi (~{estimateData.estimatedPages} sayfa). Klonlama süresini optimize etmek için derinliği 1 veya 2 tutmanız önerilir.
          </span>
        </div>
      )}
    </div>
  );
};
