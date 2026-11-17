import React, { useMemo, useRef, useState } from 'react';
import {
  Archive,
  Blocks,
  Code2,
  Eye,
  FolderOpen,
  Layers,
  Loader2,
  Palette,
  RefreshCw,
  Webhook,
} from 'lucide-react';
import { useProjectStore } from '../stores/project-store';
import { formatBytes } from '../lib/utils';
import { ExplorerPreviewTab } from '../components/explorer/ExplorerPreviewTab';
import { ExplorerCodeViewer } from '../components/explorer/ExplorerCodeViewer';
import { ExplorerArchiveDiffTab } from '../components/explorer/ExplorerArchiveDiffTab';

type ExplorerSubTab = 'preview' | 'api' | 'components' | 'source' | 'tokens' | 'archive';

export const ArtifactExplorerPage: React.FC = () => {
  const {
    projects,
    selectedProject,
    activeArtifactSummary,
    isArtifactLoading,
    selectAndHydrateProject,
    refreshActiveArtifacts,
  } = useProjectStore();

  const [subTab, setSubTab] = useState<ExplorerSubTab>('preview');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const apiFiles = useMemo(() => {
    if (!activeArtifactSummary) return [];
    const list: Array<{ label: string; relativePath: string }> = [];
    if (activeArtifactSummary.openApiEndpointCount > 0) {
      list.push(
        { label: 'openapi.json (OpenAPI 3.1)', relativePath: '_meta/openapi.json' },
        { label: 'api-types.d.ts (TypeScript)', relativePath: '_meta/api-types.d.ts' },
        { label: 'api-endpoints.json (Mock DB)', relativePath: '_meta/api-endpoints.json' }
      );
    }
    return list;
  }, [activeArtifactSummary]);

  const componentFiles = useMemo(() => {
    if (!activeArtifactSummary) return [];
    return activeArtifactSummary.exportedComponents.map((fileName) => ({
      label: fileName,
      relativePath: `_components/${fileName}`,
    }));
  }, [activeArtifactSummary]);

  const sourceFiles = useMemo(() => {
    if (!activeArtifactSummary) return [];
    return activeArtifactSummary.reconstructedSourceFiles.map((relPath) => ({
      label: relPath,
      relativePath: `site/_source-code/${relPath}`,
    }));
  }, [activeArtifactSummary]);

  const tokenFiles = useMemo(() => {
    if (!activeArtifactSummary) return [];
    const list: Array<{ label: string; relativePath: string }> = [];
    if (activeArtifactSummary.hasDesignTokensTheme) {
      list.push({ label: 'tokens.theme.css (Tailwind v4 @theme)', relativePath: '_meta/tokens.theme.css' });
    }
    list.push(
      { label: 'tailwind.config.js (Tailwind v3)', relativePath: '_meta/tailwind.config.js' },
      { label: 'design-tokens.json (Ham Tokenlar)', relativePath: '_meta/design-tokens.json' }
    );
    if (activeArtifactSummary.hasExtractedState) {
      list.push({ label: 'extracted-state.json (SSR / RSC State)', relativePath: '_meta/extracted-state.json' });
    }
    if (activeArtifactSummary.adaptiveEntityGroups > 0) {
      list.push({ label: 'adaptive-entities.json (Anlamsal Veri)', relativePath: '_meta/adaptive-entities.json' });
    }
    return list;
  }, [activeArtifactSummary]);

  if (!selectedProject && !activeArtifactSummary) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-5">
        <div className="bg-surface-2 border border-white/[0.07] rounded-2xl p-8 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-accent/10 border border-accent/25 flex items-center justify-center text-accent-hover">
            <Layers size={26} />
          </div>
          <h2 className="text-base font-bold text-text-primary">Tersine Mühendislik ve Artefakt Gezgini</h2>
          <p className="text-xs text-text-muted max-w-lg mx-auto leading-relaxed">
            Klonlanmış bir projenin önizleme sunucusunu yönetmek, OpenAPI sözleşmelerini, çıkarılan React bileşenlerini, SourceMap kaynak kodlarını, Tailwind tokenlarını ve WACZ arşivlerini incelemek için sol menüden veya aşağıdan bir proje seçin.
          </p>
        </div>

        {projects.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => void selectAndHydrateProject(p)}
                className="text-left p-4 bg-surface-2 hover:bg-surface-3 border border-white/[0.07] hover:border-accent/40 rounded-xl transition-all cursor-pointer space-y-1.5"
              >
                <div className="text-xs font-bold text-text-primary truncate">{p.name}</div>
                <div className="text-[11px] font-mono text-text-dim truncate">{p.domain}</div>
                <div className="text-[10px] font-mono text-accent-hover">
                  {p.totalFiles} dosya &bull; {formatBytes(p.totalSize)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (isArtifactLoading && !activeArtifactSummary) {
    return (
      <div className="flex items-center justify-center h-64 text-xs text-text-muted gap-2">
        <Loader2 size={18} className="animate-spin text-accent-hover" />
        <span>Proje artefaktları yükleniyor...</span>
      </div>
    );
  }

  if (!activeArtifactSummary) return null;

  const subTabs: Array<{
    id: ExplorerSubTab;
    label: string;
    icon: React.FC<{ size?: number; className?: string }>;
    badge?: number;
  }> = [
    { id: 'preview', label: 'Önizleme', icon: Eye },
    { id: 'api', label: 'API & Mock', icon: Webhook, badge: activeArtifactSummary.openApiEndpointCount },
    { id: 'components', label: 'Bileşenler', icon: Blocks, badge: activeArtifactSummary.exportedComponents.length },
    { id: 'source', label: 'Kaynak Kod', icon: Code2, badge: activeArtifactSummary.reconstructedSourceFiles.length },
    { id: 'tokens', label: 'Tokenlar & Veri', icon: Palette },
    { id: 'archive', label: 'Arşiv & Fark', icon: Archive },
  ];

  const handleSubTabKeyDown = (e: React.KeyboardEvent, idx: number) => {
    let nextIdx = -1;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % subTabs.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + subTabs.length) % subTabs.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = subTabs.length - 1;
    if (nextIdx !== -1) {
      e.preventDefault();
      setSubTab(subTabs[nextIdx].id);
      tabRefs.current[nextIdx]?.focus();
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto animate-in fade-in duration-200">
      <div className="bg-surface-2 border border-white/[0.07] rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-base font-bold text-text-primary truncate">
              {activeArtifactSummary.projectName}
            </h2>
            {activeArtifactSummary.hasWacz && (
              <span className="px-2 py-0.5 text-[10px] font-mono bg-accent/15 text-accent-hover border border-accent/30 rounded-full">
                WACZ 1.1.1
              </span>
            )}
            {activeArtifactSummary.canResume && (
              <span className="px-2 py-0.5 text-[10px] font-mono bg-warning/15 text-warning-hover border border-warning/30 rounded-full">
                Devam Ettirilebilir
              </span>
            )}
          </div>
          <div className="text-xs font-mono text-text-dim truncate">
            {activeArtifactSummary.sourceUrl || activeArtifactSummary.projectDir}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => void refreshActiveArtifacts()}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface-3 hover:bg-white/[0.08] border border-white/[0.08] rounded-xl text-xs text-text-secondary hover:text-text-primary cursor-pointer"
          >
            <RefreshCw size={13} className={isArtifactLoading ? 'animate-spin' : ''} />
            <span>Yenile</span>
          </button>
          <button
            type="button"
            onClick={() => window.electronAPI?.openFolder?.(activeArtifactSummary.projectDir)}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface-3 hover:bg-white/[0.08] border border-white/[0.08] rounded-xl text-xs text-text-secondary hover:text-text-primary cursor-pointer"
          >
            <FolderOpen size={13} />
            <span>Klasörü Aç</span>
          </button>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Artefakt Gezgini Bölümleri"
        className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-white/[0.07]"
      >
        {subTabs.map((tab, idx) => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[idx] = el;
              }}
              type="button"
              role="tab"
              id={`explorer-tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`explorer-panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setSubTab(tab.id)}
              onKeyDown={(e) => handleSubTabKeyDown(e, idx)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-t-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-surface-2 text-accent-hover border-t border-x border-white/[0.08]'
                  : 'text-text-muted hover:text-text-primary hover:bg-white/[0.03]'
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] font-mono rounded-full bg-surface-3 text-text-secondary border border-white/[0.06]">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`explorer-panel-${subTab}`}
        aria-labelledby={`explorer-tab-${subTab}`}
        tabIndex={0}
        className="focus:outline-none"
      >
        {subTab === 'preview' && <ExplorerPreviewTab summary={activeArtifactSummary} />}
        {subTab === 'api' && (
          <ExplorerCodeViewer
            projectDir={activeArtifactSummary.projectDir}
            files={apiFiles}
            emptyTitle="API / Mock Verisi Bulunamadı"
            emptyDescription="Dinamik klonlama ve Tersine Mühendislik açıkken yakalanan OpenAPI 3.1 ve API uç noktaları burada listelenir."
          />
        )}
        {subTab === 'components' && (
          <ExplorerCodeViewer
            projectDir={activeArtifactSummary.projectDir}
            files={componentFiles}
            emptyTitle="Çıkarılmış React (TSX) Bileşeni Yok"
            emptyDescription="Bu projede _components/*.tsx dosyası oluşturulmamış."
          />
        )}
        {subTab === 'source' && (
          <ExplorerCodeViewer
            projectDir={activeArtifactSummary.projectDir}
            files={sourceFiles}
            emptyTitle="Kaynak Haritası (SourceMap) Dosyası Bulunamadı"
            emptyDescription="Hedef sitede erişilebilir .map kaynak haritası bulunduğunda kurtarılan özgün kod ağacı burada görünür."
          />
        )}
        {subTab === 'tokens' && (
          <ExplorerCodeViewer
            projectDir={activeArtifactSummary.projectDir}
            files={tokenFiles}
            emptyTitle="Tasarım Tokenı Bulunamadı"
            emptyDescription="Bu projede Tailwind v4 @theme veya framework hydration state dosyası bulunmuyor."
          />
        )}
        {subTab === 'archive' && <ExplorerArchiveDiffTab summary={activeArtifactSummary} />}
      </div>
    </div>
  );
};
