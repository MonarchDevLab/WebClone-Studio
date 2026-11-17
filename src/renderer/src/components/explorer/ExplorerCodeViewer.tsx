import React, { useEffect, useState } from 'react';
import { Copy, FileCode2, Loader2 } from 'lucide-react';
import { ArtifactReadResult } from '@shared/types';
import { formatBytes } from '../../lib/utils';
import { toast } from 'sonner';

interface ExplorerCodeViewerProps {
  projectDir: string;
  files: Array<{ label: string; relativePath: string }>;
  emptyTitle: string;
  emptyDescription: string;
}

export const ExplorerCodeViewer: React.FC<ExplorerCodeViewerProps> = ({
  projectDir,
  files,
  emptyTitle,
  emptyDescription,
}) => {
  const [selectedPath, setSelectedPath] = useState<string>(files[0]?.relativePath || '');
  const [artifact, setArtifact] = useState<ArtifactReadResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSelectedPath(files[0]?.relativePath || '');
    setArtifact(null);
  }, [projectDir, files]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedPath || !window.electronAPI?.readProjectArtifact) {
      setArtifact(null);
      return;
    }

    setLoading(true);
    window.electronAPI
      .readProjectArtifact(projectDir, selectedPath)
      .then((res) => {
        if (!cancelled) {
          setArtifact(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setArtifact(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectDir, selectedPath]);

  if (files.length === 0) {
    return (
      <div className="bg-surface-2 border border-white/[0.07] rounded-2xl p-8 text-center">
        <FileCode2 size={28} className="mx-auto mb-3 text-text-dim" />
        <div className="text-sm font-semibold text-text-primary">{emptyTitle}</div>
        <p className="text-xs text-text-muted mt-1 max-w-md mx-auto">{emptyDescription}</p>
      </div>
    );
  }

  const handleCopy = async () => {
    if (!artifact?.content) return;
    await navigator.clipboard.writeText(artifact.content);
    toast.success('İçerik panoya kopyalandı.');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div className="lg:col-span-4 bg-surface-2 border border-white/[0.07] rounded-2xl p-3 space-y-1 max-h-[520px] overflow-y-auto">
        <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-text-dim">
          Dosyalar ({files.length})
        </div>
        {files.map((item) => {
          const isSelected = item.relativePath === selectedPath;
          return (
            <button
              key={item.relativePath}
              type="button"
              onClick={() => setSelectedPath(item.relativePath)}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-mono truncate transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-accent/20 text-accent-hover border border-accent/30 font-semibold'
                  : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary border border-transparent'
              }`}
              title={item.relativePath}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="lg:col-span-8 bg-surface-2 border border-white/[0.07] rounded-2xl flex flex-col overflow-hidden max-h-[520px]">
        <div className="px-4 py-2.5 border-b border-white/[0.07] bg-surface-3/60 flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2 text-xs font-mono text-text-primary">
            <span className="truncate">{selectedPath}</span>
            {artifact && (
              <span className="text-[10px] text-text-dim flex-shrink-0">
                ({formatBytes(artifact.sizeBytes)}
                {artifact.truncated ? ' - kısmi okuma' : ''})
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!artifact?.content}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-surface-1 hover:bg-white/[0.08] border border-white/[0.08] text-text-secondary hover:text-text-primary disabled:opacity-40 cursor-pointer"
          >
            <Copy size={12} />
            <span>Kopyala</span>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 bg-canvas/70">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-xs text-text-muted gap-2">
              <Loader2 size={16} className="animate-spin text-accent-hover" />
              <span>Dosya içeriği okunuyor...</span>
            </div>
          ) : artifact ? (
            <pre className="text-[11px] leading-relaxed font-mono text-text-secondary whitespace-pre-wrap break-words">
              {artifact.content}
            </pre>
          ) : (
            <div className="py-12 text-center text-xs text-text-dim">
              Dosya okunamadı veya mevcut değil.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
