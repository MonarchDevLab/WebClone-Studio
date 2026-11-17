import React, { useState } from 'react';
import { Globe, FolderOpen, Play, Square, RotateCcw, CheckCircle2, FileText } from 'lucide-react';
import { ProjectArtifactSummary } from '@shared/types';
import { useProjectStore } from '../../stores/project-store';
import { useUiStore } from '../../stores/ui-store';
import { toast } from 'sonner';

interface ExplorerPreviewTabProps {
  summary: ProjectArtifactSummary;
}

export const ExplorerPreviewTab: React.FC<ExplorerPreviewTabProps> = ({ summary }) => {
  const { openProject, refreshActiveArtifacts } = useProjectStore();
  const { setActiveTab } = useUiStore();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleStartPreview = async () => {
    if (!window.electronAPI?.startPreviewServer) return;
    setBusy(true);
    try {
      const res = await window.electronAPI.startPreviewServer(summary.projectDir, {
        openExternal: true,
      });
      if (res.success && res.url) {
        setPreviewUrl(res.url);
        toast.success(`Yerel önizleme başlatıldı: ${res.url}`);
      } else {
        toast.error(res.error || 'Önizleme sunucusu başlatılamadı.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleStopPreview = async () => {
    if (!window.electronAPI?.stopPreviewServer) return;
    await window.electronAPI.stopPreviewServer();
    setPreviewUrl(null);
    toast.info('Yerel önizleme sunucusu durduruldu.');
  };

  const handleResumeCrawl = async () => {
    if (!window.electronAPI?.resumeIncompleteCrawl) return;
    setBusy(true);
    try {
      const started = await window.electronAPI.resumeIncompleteCrawl(summary.projectDir);
      if (started) {
        toast.success('Kaldığı yerden klonlama devam ettiriliyor.');
        setActiveTab('clone');
        await refreshActiveArtifacts();
      } else {
        toast.error('Kaldığı yerden devam ettirilemedi.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Kurtarma işlemi başarısız oldu.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-surface-2 border border-white/[0.07] rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-bold text-text-primary uppercase tracking-wider">
            Çevrimdışı Önizleme ve Servis Sunucusu
          </div>
          <p className="text-xs text-text-muted">
            Service Worker (/ _sw-replay.js), HTTP 206 medya akışı ve API mock yanıtları ile projeyi tarayıcıda görüntüleyin.
          </p>
          {previewUrl && (
            <div className="pt-1 text-xs font-mono text-accent-hover">
              Aktif Sunucu: {previewUrl}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!previewUrl ? (
            <button
              type="button"
              disabled={busy}
              onClick={handleStartPreview}
              className="flex items-center gap-1.5 px-4 py-2 bg-success hover:bg-success-hover text-black font-bold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              <Play size={14} />
              <span>Önizleme Sunucusunu Başlat</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStopPreview}
              className="flex items-center gap-1.5 px-4 py-2 bg-error/20 hover:bg-error/30 text-error-hover border border-error/40 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              <Square size={14} />
              <span>Sunucuyu Durdur</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => openProject(summary.projectDir)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-surface-3 hover:bg-white/[0.08] border border-white/[0.1] text-xs text-text-primary rounded-xl cursor-pointer"
          >
            <Globe size={14} className="text-accent-hover" />
            <span>Varsayılan Tarayıcıda Aç</span>
          </button>

          <button
            type="button"
            onClick={() => window.electronAPI?.openFolder?.(summary.projectDir)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-surface-3 hover:bg-white/[0.08] border border-white/[0.1] text-xs text-text-secondary hover:text-text-primary rounded-xl cursor-pointer"
          >
            <FolderOpen size={14} />
            <span>Klasörü Aç</span>
          </button>
        </div>
      </div>

      {summary.canResume && (
        <div className="bg-warning/10 border border-warning/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-warning-hover">
              Yarım Kalan Klonlama Tespit Edildi (SQLite WAL Checkpoint)
            </div>
            <p className="text-xs text-text-secondary">
              İndirilmiş sayfalar ve kuyruk durumu korundu. Klonlamayı sıfırlamadan kaldığı yerden sürdürebilirsiniz.
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={handleResumeCrawl}
            className="flex items-center gap-1.5 px-4 py-2 bg-warning hover:bg-warning-hover text-black font-bold text-xs rounded-xl cursor-pointer flex-shrink-0"
          >
            <RotateCcw size={14} />
            <span>Kaldığı Yerden Devam Et</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Tek Dosya HTML', active: summary.hasStandaloneHtml, hint: '_exports/index.standalone.html' },
          { label: 'MHTML Anlık Görüntü', active: summary.hasMhtml, hint: '_exports/index.mhtml' },
          { label: 'Mimari Sistem Haritası', active: summary.hasSystemMap, hint: '_meta/SYSTEM_MAP.md' },
          { label: 'Tailwind v4 @theme', active: summary.hasDesignTokensTheme, hint: '_meta/tokens.theme.css' },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-surface-2 border border-white/[0.07] rounded-xl p-4 space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-primary">{card.label}</span>
              {card.active ? (
                <CheckCircle2 size={14} className="text-success-hover" />
              ) : (
                <FileText size={14} className="text-text-dim" />
              )}
            </div>
            <div className="text-[10px] font-mono text-text-dim truncate">{card.hint}</div>
            <div className={`text-[11px] font-mono ${card.active ? 'text-success-hover' : 'text-text-dim'}`}>
              {card.active ? 'Hazır' : 'Oluşturulmadı'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
