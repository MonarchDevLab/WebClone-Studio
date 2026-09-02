import React from 'react';
import { useAnalyzeStore } from '../stores/analyze-store';
import { useCloneStore } from '../stores/clone-store';
import { formatSpeed, formatDuration } from '../lib/utils';

export const StatusBar: React.FC = () => {
  const { isAnalyzing } = useAnalyzeStore();
  const { isCloning, isPaused, progress } = useCloneStore();

  // Durum belirleme
  const isBusy = isAnalyzing || (isCloning && !isPaused);
  const statusText = isAnalyzing 
    ? "Analiz yapılıyor..." 
    : isCloning 
      ? (isPaused ? "Klonlama duraklatıldı" : "Klonlama aktif") 
      : "Sistem Hazır";
  const totalFiles = (progress?.downloaded || 0) + (progress?.queued || 0);

  const dotColor = isAnalyzing 
    ? 'bg-accent-hover' 
    : isCloning 
      ? (isPaused ? 'bg-warning-hover' : 'bg-success-hover') 
      : 'bg-success-hover';

  return (
    <div className="h-7 bg-surface-1 border-t border-white/[0.06] flex items-center justify-between px-3 text-[11px] select-none z-50 relative">
      {/* Sol: Bağlantı Durumu */}
      <div className="flex items-center gap-2">
        <div className="relative flex items-center justify-center">
          <div className={`w-2 h-2 rounded-full ${dotColor}`} />
          {isBusy && (
            <div className={`absolute w-2 h-2 rounded-full ${dotColor} animate-ping opacity-75`} />
          )}
        </div>
        <span className="text-text-secondary font-medium" role="status" aria-live="polite">{statusText}</span>
      </div>

      {/* Orta: Hız ve Dosya Sayısı */}
      {isCloning && progress && (
        <div className="flex items-center gap-5 font-mono text-[11px]">
          <div className="text-text-dim">
            Hız: <span className="text-accent-hover font-semibold">{formatSpeed(progress.speed || 0)}</span>
          </div>
          <div className="text-text-dim">
            Dosya: <span className="text-text-primary">{progress.downloaded}</span>
            <span className="text-text-dim"> / {totalFiles}</span>
          </div>
        </div>
      )}

      {/* Sağ: ETA & Durum */}
      <div className="flex items-center justify-end min-w-[120px]">
        {isCloning && progress ? (
          <span className="text-warning-hover font-mono text-[11px]">
            Kalan: {progress.eta ? formatDuration(progress.eta) : 'Hesaplanıyor...'}
          </span>
        ) : (
          <span className="text-text-dim text-[10px] uppercase font-mono tracking-wider">
            v1.0.0 &bull; Portable
          </span>
        )}
      </div>
    </div>
  );
};
