import React, { useEffect } from 'react';
import { Plus, FolderOpen, Trash2, HardDrive, Files, AppWindow, Globe } from 'lucide-react';
import { useUiStore } from '../stores/ui-store';
import { useProjectStore } from '../stores/project-store';
import { formatBytes } from '../lib/utils';
import { toast } from 'sonner';

export const Sidebar: React.FC = () => {
  const { setActiveTab } = useUiStore();
  const { projects, activeProjectId, fetchProjects, openProject, deleteProject, setActiveProject } = useProjectStore();

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const totalSize = projects.reduce((acc, p) => acc + (p.totalSize || 0), 0);

  const handleOpenBrowser = async (projectPath: string, name: string) => {
    const ok = await openProject(projectPath);
    if (ok) {
      toast.success(`${name} tarayıcıda açıldı.`);
    } else {
      toast.error('Site tarayıcıda açılamadı.');
    }
  };

  const handleOpenFolder = async (e: React.MouseEvent, projectPath: string) => {
    e.stopPropagation();
    if (window.electronAPI?.openFolder) {
      await window.electronAPI.openFolder(projectPath);
      toast.info('Klasör açıldı.');
    }
  };

  const handleDelete = async (e: React.MouseEvent, projectPath: string, name: string) => {
    e.stopPropagation();
    if (confirm(`"${name}" projesini ve tüm dosyalarını silmek istediğinize emin misiniz?`)) {
      const ok = await deleteProject(projectPath);
      if (ok) {
        toast.success(`${name} silindi.`);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface-1 border-r border-white/[0.06] select-none">
      {/* Üst Kısım: Projeler Başlığı ve Buton */}
      <div className="p-3.5 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider font-mono">
            Klonlanan Siteler
          </span>
          <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-accent/40 text-accent-hover border border-accent/30 rounded-md">
            {projects.length}
          </span>
        </div>

        <button 
          onClick={() => {
            const inputEl = document.querySelector('input[type="text"]') as HTMLInputElement;
            if (inputEl) inputEl.focus();
          }}
          className="flex items-center justify-center gap-1.5 text-xs font-semibold text-text-primary w-full py-2 px-3 rounded-lg bg-overlay hover:bg-surface-3 border border-white/[0.08] hover:border-accent/40 transition-all shadow-sm"
        >
          <Plus size={14} className="text-accent-hover" />
          <span>Yeni Site Analiz Et</span>
        </button>
      </div>

      {/* Projeler Listesi */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 no-drag">
        {projects.length === 0 ? (
          <div className="text-center py-10 px-3">
            <div className="w-9 h-9 rounded-full bg-surface-1 border border-white/[0.06] flex items-center justify-center mx-auto mb-2 text-text-dim">
              <AppWindow size={16} />
            </div>
            <div className="text-xs font-medium text-text-secondary">Henüz proje yok</div>
            <div className="text-[11px] text-text-dim mt-1">Klonlanan siteler burada listelenir.</div>
          </div>
        ) : (
          projects.map((project) => (
            <div
              key={project.id}
              role="button"
              tabIndex={0}
              onClick={() => setActiveProject(project.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActiveProject(project.id);
                }
              }}
              aria-label={`${project.name} projesini seç — ${project.totalFiles} dosya, ${formatBytes(project.totalSize)}`}
              className={`group flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all border ${
                activeProjectId === project.id
                  ? 'bg-accent/20 border-accent/30 text-white'
                  : 'bg-surface-2/60 hover:bg-surface-3 border-transparent hover:border-white/[0.07] text-text-secondary hover:text-text-primary'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-2 h-2 rounded-full bg-success-hover shadow-sm shadow-success-hover/50 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-text-primary group-hover:text-accent-hover transition-colors">
                    {project.name}
                  </div>
                  <div className="text-[10px] text-text-dim font-mono">
                    {project.totalFiles} dosya &bull; {formatBytes(project.totalSize)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                <button
                  title="Varsayılan tarayıcıda aç"
                  aria-label={`${project.name} sitesini tarayıcıda aç`}
                  className="p-1 hover:text-accent-hover text-text-muted transition-colors rounded hover:bg-white/[0.05]"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenBrowser(project.outputPath, project.name);
                  }}
                >
                  <Globe size={13} />
                </button>
                <button
                  title="Dosya klasörünü Explorer'da aç"
                  aria-label={`${project.name} klasörünü Explorer'da aç`}
                  className="p-1 hover:text-accent-hover text-text-muted transition-colors rounded hover:bg-white/[0.05]"
                  onClick={(e) => handleOpenFolder(e, project.outputPath)}
                >
                  <FolderOpen size={13} />
                </button>
                <button
                  title="Projeyi sil"
                  aria-label={`${project.name} projesini sil`}
                  className="p-1 hover:text-error-hover text-text-muted transition-colors rounded hover:bg-white/[0.05]"
                  onClick={(e) => handleDelete(e, project.outputPath, project.name)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Alt Kısım: İstatistikler ve Geliştirici İmzası */}
      <div className="p-3 border-t border-white/[0.06] bg-surface-1 space-y-2">
        <div className="flex justify-between items-center text-[11px] text-text-secondary">
          <span className="flex items-center gap-1.5">
            <Files size={13} className="text-secondary-hover" />
            <span>Toplam Site:</span>
          </span>
          <span className="font-mono font-bold text-text-primary">{projects.length}</span>
        </div>
        <div className="flex justify-between items-center text-[11px] text-text-secondary">
          <span className="flex items-center gap-1.5">
            <HardDrive size={13} className="text-accent-hover" />
            <span>Kullanılan Alan:</span>
          </span>
          <span className="font-mono font-bold text-success-hover">{formatBytes(totalSize)}</span>
        </div>
        <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between text-[10px] text-text-dim">
          <span>WebClone Studio v1.0</span>
          <span className="font-medium text-text-muted hover:text-accent-hover transition-colors">Monolith Works</span>
        </div>
      </div>
    </div>
  );
};
