import { 
  Play, Pause, Square, FolderOpen, Activity, 
  CheckCircle2, Clock, HardDrive, ArrowDown, FileCode, Globe, AlertTriangle, RotateCcw
} from 'lucide-react';
import { useCloneStore } from '../stores/clone-store';
import { useUiStore } from '../stores/ui-store';
import { formatBytes, formatDuration, formatSpeed } from '../lib/utils';
import { toast } from 'sonner';

export const ClonePage: React.FC = () => {
  const { 
    isCloning, isPaused, progress, files, logs, errors,
    outputPath, pauseClone, resumeClone, cancelClone, reset
  } = useCloneStore();
  const { openCloneModal } = useUiStore();

  const handleOpenFolder = async () => {
    if (outputPath && window.electronAPI?.openFolder) {
      await window.electronAPI.openFolder(outputPath);
    } else {
      toast.info('Henüz çıktı klasörü belirlenmedi.');
    }
  };

  const handleOpenBrowser = async () => {
    if (outputPath) {
      if (window.electronAPI?.startPreviewServer) {
        const res = await window.electronAPI.startPreviewServer(outputPath);
        if (res?.success) {
          toast.success(`Yerel önizleme sunucusu açıldı: ${res.url || '127.0.0.1'}`);
        } else {
          toast.error(res?.error || 'Önizleme sunucusu başlatılamadı.');
        }
      } else if (window.electronAPI?.openBrowser) {
        const isWindows = outputPath.includes('\\');
        const sep = isWindows ? '\\' : '/';
        const indexPath = `${outputPath}${sep}site${sep}index.html`;
        await window.electronAPI.openBrowser(indexPath);
      }
    } else {
      toast.info('Henüz çıktı klasörü belirlenmedi.');
    }
  };

  const totalFiles = (progress?.downloaded || 0) + (progress?.queued || 0);
  const percentComplete = totalFiles > 0 ? Math.round(((progress?.downloaded || 0) / totalFiles) * 100) : 0;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto animate-in fade-in duration-200">
      
      {/* 1. Üst Kontrol & Durum Barı */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface-2 border border-white/[0.07] rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className={`p-3 rounded-xl border ${
            isCloning 
              ? 'bg-accent/10 text-accent-hover border-accent/30 animate-pulse' 
              : outputPath
                ? 'bg-success/15 text-success-hover border-success/30'
                : 'bg-surface-3 text-text-muted border-white/[0.06]'
          }`}>
            {outputPath && !isCloning ? <CheckCircle2 size={22} /> : <Activity size={22} />}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-bold text-text-primary" role="status" aria-live="polite">
                {isCloning
                  ? (isPaused ? 'Klonlama Duraklatıldı' : 'Klonlama Aktif & İndiriliyor')
                  : (outputPath ? 'Klonlama Başarıyla Tamamlandı' : 'Klonlama Kontrol Merkezi')}
              </h2>
              {isCloning && !isPaused && (
                <span className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono font-bold bg-success/15 text-success-hover border border-success/30 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-success-hover animate-ping" />
                  CANLI İŞLEM
                </span>
              )}
              {!isCloning && outputPath && (
                <span className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono font-bold bg-success/15 text-success-hover border border-success/30 rounded-full">
                  OFFLINE HAZIR
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted font-mono truncate max-w-md mt-0.5">
              {progress?.activeUrl || (outputPath ? `Çıktı Dizini: ${outputPath}` : 'Hazırda bekliyor...')}
            </p>
          </div>
        </div>

        {/* Aksiyon Butonları */}
        <div className="flex items-center gap-2.5">
          {isCloning ? (
            <>
              {isPaused ? (
                <button
                  onClick={resumeClone}
                  className="flex items-center gap-2 px-4 py-2 bg-success hover:bg-success-hover text-black rounded-xl text-xs font-bold transition-all shadow-md shadow-success/20 active:scale-95 cursor-pointer"
                >
                  <Play size={14} />
                  <span>Devam Et</span>
                </button>
              ) : (
                <button
                  onClick={pauseClone}
                  className="flex items-center gap-2 px-4 py-2 bg-warning hover:bg-warning-hover text-black rounded-xl text-xs font-bold transition-all shadow-md shadow-warning/20 active:scale-95 cursor-pointer"
                >
                  <Pause size={14} />
                  <span>Duraklat</span>
                </button>
              )}

              <button
                onClick={cancelClone}
                className="flex items-center gap-2 px-4 py-2 bg-error/10 hover:bg-error/20 text-error-hover border border-error/30 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
              >
                <Square size={14} />
                <span>İptal Et</span>
              </button>
            </>
          ) : (
            outputPath ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenBrowser}
                  className="flex items-center gap-2 px-3.5 py-2 bg-accent hover:bg-accent-hover text-black font-bold rounded-xl text-xs transition-all shadow-md active:scale-95 cursor-pointer"
                  title="Klonlanan siteyi yerel web sunucusunda aç"
                >
                  <Globe size={15} />
                  <span>Sitede Gezin (127.0.0.1)</span>
                </button>
                <button
                  onClick={handleOpenFolder}
                  className="flex items-center gap-2 px-3.5 py-2 bg-surface-3 hover:bg-white/[0.08] hover:border-white/[0.16] text-text-primary border border-white/[0.08] rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
                  title="Dosyaların indirildiği klasörü Explorer'da aç"
                >
                  <FolderOpen size={15} />
                  <span>Klasörü Aç</span>
                </button>
                <button
                  onClick={() => {
                    reset();
                    openCloneModal();
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-text-primary border border-white/[0.08] rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer"
                  title="Yeni bir klonlama işlemi başlat"
                >
                  <RotateCcw size={14} />
                  <span>Yeni Klon</span>
                </button>
              </div>
            ) : (
              <button
                onClick={openCloneModal}
                className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-black font-bold rounded-xl text-xs transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <Play size={14} />
                <span>Klon Sihirbazını Başlat</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Hata Bildirim Paneli (Eğer indirilemeyen varlıklar varsa) */}
      {errors && errors.length > 0 && (
        <div className="bg-error/10 border border-error/30 rounded-2xl p-4 text-xs font-mono text-error-hover space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm">
            <AlertTriangle size={16} />
            <span>{errors.length} Varlık İndirilemedi veya Atlandı:</span>
          </div>
          <div className="max-h-24 overflow-y-auto space-y-1 pr-2">
            {errors.slice(-10).map((err, i) => (
              <div key={i} className="truncate text-[11px] opacity-90">
                • {err.url} <span className="opacity-60">({err.message})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Operasyonel Metrik Kartları */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-2 border border-white/[0.07] rounded-2xl p-4.5 relative overflow-hidden">
          <div className="text-[11px] font-mono uppercase text-text-muted flex items-center gap-1.5 mb-2">
            <CheckCircle2 size={13} className="text-success-hover" />
            <span>İndirilen Dosyalar</span>
          </div>
          <div className="text-2xl font-bold font-mono text-text-primary">
            {progress?.downloaded || 0}
            <span className="text-xs text-text-dim font-normal ml-1.5">/ {totalFiles}</span>
          </div>
          <div className="absolute bottom-3 right-3 w-1.5 h-1.5 rounded-full bg-success-hover shadow-sm shadow-success-hover/80" />
        </div>

        <div className="bg-surface-2 border border-white/[0.07] rounded-2xl p-4.5 relative overflow-hidden">
          <div className="text-[11px] font-mono uppercase text-text-muted flex items-center gap-1.5 mb-2">
            <ArrowDown size={13} className="text-accent-hover" />
            <span>İndirme Hızı</span>
          </div>
          <div className="text-2xl font-bold font-mono text-accent-hover">
            {formatSpeed(progress?.speed || 0)}
          </div>
          <div className="absolute bottom-3 right-3 w-1.5 h-1.5 rounded-full bg-accent-hover shadow-sm shadow-accent-hover/80" />
        </div>

        <div className="bg-surface-2 border border-white/[0.07] rounded-2xl p-4.5 relative overflow-hidden">
          <div className="text-[11px] font-mono uppercase text-text-muted flex items-center gap-1.5 mb-2">
            <HardDrive size={13} className="text-secondary-hover" />
            <span>Toplam Veri</span>
          </div>
          <div className="text-2xl font-bold font-mono text-text-primary">
            {formatBytes(progress?.bytesTransferred || 0)}
          </div>
          <div className="absolute bottom-3 right-3 w-1.5 h-1.5 rounded-full bg-secondary-hover shadow-sm shadow-secondary-hover/80" />
        </div>

        <div className="bg-surface-2 border border-white/[0.07] rounded-2xl p-4.5 relative overflow-hidden">
          <div className="text-[11px] font-mono uppercase text-text-muted flex items-center gap-1.5 mb-2">
            <Clock size={13} className="text-warning-hover" />
            <span>Tahmini Süre</span>
          </div>
          <div className="text-2xl font-bold font-mono text-text-primary">
            {progress?.eta ? formatDuration(progress.eta) : '—'}
          </div>
          <div className="absolute bottom-3 right-3 w-1.5 h-1.5 rounded-full bg-warning-hover shadow-sm shadow-warning-hover/80" />
        </div>
      </div>

      {/* 3. Progress Bar */}
      <div className="bg-surface-2 border border-white/[0.07] rounded-2xl p-5 space-y-2.5 shadow-lg">
        <div className="flex justify-between items-center text-xs font-mono">
          <span className="text-text-secondary font-medium">Klonlama İlerleme Durumu</span>
          <span className="text-accent-hover font-bold bg-accent/40 px-2 py-0.5 rounded border border-accent/30">
            %{percentComplete}
          </span>
        </div>
        <div
          className="w-full h-3 bg-surface-3 rounded-full overflow-hidden p-0.5 border border-white/[0.06]"
          role="progressbar"
          aria-valuenow={percentComplete}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Klonlama ilerleme yüzdesi"
        >
          <div
            className="h-full bg-gradient-to-r from-accent via-success-hover to-accent-hover rounded-full transition-all duration-300 shadow-sm shadow-accent/50"
            style={{ width: `${percentComplete}%` }}
          />
        </div>
      </div>

      {/* 4. Canlı İndirilen Dosyalar & Log Akışı */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* İndirilen Dosyalar Listesi */}
        <div className="bg-surface-2 border border-white/[0.07] rounded-2xl p-5 flex flex-col h-84 shadow-xl">
          <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-white/[0.06]">
            <div className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
              <FileCode size={15} className="text-accent-hover" />
              <span>İndirilen Dosyalar</span>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-mono bg-accent/40 text-accent-hover border border-accent/30 rounded-md">
              {files.length} Dosya
            </span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 text-xs font-mono" role="list" aria-label="İndirilen dosyalar">
            {files.length === 0 ? (
              <div className="text-center py-16 text-text-dim">Henüz dosya indirilmedi.</div>
            ) : (
              files.slice(-60).reverse().map((f, i) => (
                <div key={i} role="listitem" className="flex items-center justify-between p-2 bg-overlay hover:bg-surface-3 rounded-lg border border-white/[0.04] text-[11px] transition-colors">
                  <span className="truncate max-w-[280px] text-text-primary">{f.path.split(/[\\/]/).pop()}</span>
                  <span className="text-success-hover font-bold">{formatBytes(f.size)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Günlük (Log) Akışı */}
        <div className="bg-surface-2 border border-white/[0.07] rounded-2xl p-5 flex flex-col h-84 shadow-xl">
          <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-white/[0.06]">
            <div className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
              <Activity size={15} className="text-secondary-hover" />
              <span>Canlı Log Akışı</span>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-mono bg-secondary/40 text-secondary-hover border border-secondary/30 rounded-md">
              {logs.length} Girdi
            </span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 font-mono text-[11px]" role="log" aria-live="off" aria-label="Klonlama log akışı">
            {logs.length === 0 ? (
              <div className="text-center py-16 text-text-dim">Log akışı bekleniyor...</div>
            ) : (
              logs.slice(-60).map((l, i) => (
                <div key={i} className="flex items-start gap-2 p-1.5 bg-overlay rounded-lg border border-white/[0.04]">
                  <span className="text-text-dim select-none text-[10px]">
                    {new Date(l.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`font-bold uppercase text-[9px] px-1.5 py-0.2 rounded select-none ${
                    l.level === 'error' ? 'bg-error/50 text-error-hover border border-error/30' :
                    l.level === 'warn' ? 'bg-warning/50 text-warning-hover border border-warning/30' :
                    'bg-accent/40 text-accent-hover border border-accent/30'
                  }`}>
                    {l.level}
                  </span>
                  <span className="text-text-secondary flex-1 break-all leading-tight">{l.message}</span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
