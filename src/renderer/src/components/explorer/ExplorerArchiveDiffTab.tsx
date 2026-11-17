import React, { useState } from 'react';
import { Archive, GitCompare, Loader2, CheckCircle2 } from 'lucide-react';
import { DiffSummary, ProjectArtifactSummary } from '@shared/types';
import { formatBytes } from '../../lib/utils';
import { useProjectStore } from '../../stores/project-store';
import { toast } from 'sonner';

interface ExplorerArchiveDiffTabProps {
  summary: ProjectArtifactSummary;
}

export const ExplorerArchiveDiffTab: React.FC<ExplorerArchiveDiffTabProps> = ({ summary }) => {
  const { refreshActiveArtifacts } = useProjectStore();
  const [waczBusy, setWaczBusy] = useState(false);
  const [diffBusy, setDiffBusy] = useState(false);
  const [waczOutput, setWaczOutput] = useState<{
    filePath: string;
    sizeBytes: number;
    sha256: string;
  } | null>(null);
  const [diffResult, setDiffResult] = useState<DiffSummary | undefined>(summary.lastDiffSummary);

  const handleExportWacz = async () => {
    if (!window.electronAPI?.exportWacz) return;
    setWaczBusy(true);
    try {
      const res = await window.electronAPI.exportWacz(summary.projectDir);
      setWaczOutput(res);
      toast.success('WACZ 1.1.1 arşivi başarıyla oluşturuldu.');
      await refreshActiveArtifacts();
    } catch (err: any) {
      toast.error(err?.message || 'WACZ arşivi oluşturulamadı.');
    } finally {
      setWaczBusy(false);
    }
  };

  const handleRunDiff = async () => {
    if (!window.electronAPI?.runIncrementalDiff) return;
    setDiffBusy(true);
    try {
      const res = await window.electronAPI.runIncrementalDiff(summary.projectDir);
      setDiffResult(res);
      toast.success('Artımlı ETag/SHA-256 fark analizi tamamlandı.');
      await refreshActiveArtifacts();
    } catch (err: any) {
      toast.error(err?.message || 'Fark analizi sırasında hata oluştu.');
    } finally {
      setDiffBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-surface-2 border border-white/[0.07] rounded-2xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-text-primary uppercase tracking-wider">
              <Archive size={15} className="text-accent-hover" />
              <span>WACZ 1.1.1 Web Arşiv Paketi (.wacz)</span>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Tüm sayfaları, varlıkları, SURT CDXJ dizinini ve SHA-256 doğrulama özetini standart WACZ arşivinde paketler.
            </p>
          </div>
          <button
            type="button"
            disabled={waczBusy}
            onClick={handleExportWacz}
            className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-black font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50 flex-shrink-0"
          >
            {waczBusy ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
            <span>{waczBusy ? 'Paket Oluşturuluyor...' : 'WACZ 1.1.1 Oluştur'}</span>
          </button>
        </div>

        {(waczOutput || summary.hasWacz) && (
          <div className="bg-overlay border border-white/[0.06] rounded-xl p-3.5 text-xs font-mono space-y-1">
            <div className="flex items-center gap-2 text-success-hover font-semibold">
              <CheckCircle2 size={14} />
              <span>{waczOutput ? waczOutput.filePath : summary.waczPath}</span>
            </div>
            {waczOutput && (
              <>
                <div className="text-text-secondary">Boyut: {formatBytes(waczOutput.sizeBytes)}</div>
                <div className="text-text-dim break-all">SHA-256: {waczOutput.sha256}</div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="bg-surface-2 border border-white/[0.07] rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-text-primary uppercase tracking-wider">
              <GitCompare size={15} className="text-secondary-hover" />
              <span>Artımlı Güncelleme & ETag / SHA-256 Fark Denetimi</span>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Son kayıtlı sayfa karmalarını hedef sunucu ile karşılaştırır ve eklenen/değişen URL kayıtlarını raporlar.
            </p>
          </div>
          <button
            type="button"
            disabled={diffBusy}
            onClick={handleRunDiff}
            className="flex items-center gap-1.5 px-4 py-2 bg-secondary/20 hover:bg-secondary/30 text-secondary-hover border border-secondary/40 font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50 flex-shrink-0"
          >
            {diffBusy ? <Loader2 size={14} className="animate-spin" /> : <GitCompare size={14} />}
            <span>{diffBusy ? 'Denetleniyor...' : 'Fark Analizini Çalıştır'}</span>
          </button>
        </div>

        {diffResult ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center font-mono">
              <div className="bg-overlay border border-white/[0.05] rounded-xl p-3">
                <div className="text-lg font-bold text-success-hover">{diffResult.added}</div>
                <div className="text-[10px] uppercase text-text-dim">Eklendi</div>
              </div>
              <div className="bg-overlay border border-white/[0.05] rounded-xl p-3">
                <div className="text-lg font-bold text-warning-hover">{diffResult.modified}</div>
                <div className="text-[10px] uppercase text-text-dim">Değişti</div>
              </div>
              <div className="bg-overlay border border-white/[0.05] rounded-xl p-3">
                <div className="text-lg font-bold text-error-hover">{diffResult.removed}</div>
                <div className="text-[10px] uppercase text-text-dim">Kaldırıldı</div>
              </div>
              <div className="bg-overlay border border-white/[0.05] rounded-xl p-3">
                <div className="text-lg font-bold text-text-primary">{diffResult.unchanged}</div>
                <div className="text-[10px] uppercase text-text-dim">Değişmedi</div>
              </div>
            </div>

            {diffResult.items.length > 0 && (
              <div className="max-h-56 overflow-y-auto border border-white/[0.06] rounded-xl divide-y divide-white/[0.05] text-xs font-mono">
                {diffResult.items.map((item, idx) => (
                  <div key={`${item.url}-${idx}`} className="px-3 py-2 flex items-center justify-between gap-3">
                    <span className="truncate text-text-secondary">{item.url}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0 ${
                        item.changeType === 'ADDED'
                          ? 'bg-success/20 text-success-hover'
                          : item.changeType === 'MODIFIED'
                            ? 'bg-warning/20 text-warning-hover'
                            : 'bg-error/20 text-error-hover'
                      }`}
                    >
                      {item.changeType}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-text-dim py-4 text-center bg-overlay/50 rounded-xl border border-white/[0.04]">
            Henüz karşılaştırma raporu çalıştırılmadı.
          </div>
        )}
      </div>
    </div>
  );
};
