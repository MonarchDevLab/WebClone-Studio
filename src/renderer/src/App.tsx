import React, { Suspense, useRef } from 'react';
import { Toaster } from 'sonner';
import { MainLayout } from './layouts/MainLayout';
import { UrlInput } from './components/UrlInput';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useUiStore, TabType } from './stores/ui-store';
import { useAnalyzeStore } from './stores/analyze-store';
import { useCloneStore } from './stores/clone-store';
import { useProjectStore } from './stores/project-store';
import { useIpc } from './hooks/useIpc';
import { SiteMapNode } from '@shared/types';
import {
  CloudDownload,
  Cpu,
  Layers,
  LayoutDashboard,
  Loader2,
  Network,
  Settings,
} from 'lucide-react';

const OverviewPage = React.lazy(() =>
  import('./pages/OverviewPage').then((m) => ({ default: m.OverviewPage }))
);
const TechStackPage = React.lazy(() =>
  import('./pages/TechStackPage').then((m) => ({ default: m.TechStackPage }))
);
const SiteMapPage = React.lazy(() =>
  import('./pages/SiteMapPage').then((m) => ({ default: m.SiteMapPage }))
);
const ClonePage = React.lazy(() =>
  import('./pages/ClonePage').then((m) => ({ default: m.ClonePage }))
);
const ArtifactExplorerPage = React.lazy(() =>
  import('./pages/ArtifactExplorerPage').then((m) => ({ default: m.ArtifactExplorerPage }))
);
const SettingsPage = React.lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);
const CloneSetupModal = React.lazy(() =>
  import('./components/modal/CloneSetupModal').then((m) => ({ default: m.CloneSetupModal }))
);
const CommandPaletteModal = React.lazy(() =>
  import('./components/CommandPaletteModal').then((m) => ({ default: m.CommandPaletteModal }))
);

/** Sekme tanımları */
const TABS: Array<{
  id: TabType;
  label: string;
  icon: React.FC<{ size?: number; className?: string }>;
}> = [
  { id: 'overview', label: 'Genel Bakış', icon: LayoutDashboard },
  { id: 'tech', label: 'Teknoloji Yığını', icon: Cpu },
  { id: 'sitemap', label: 'Site Haritası', icon: Network },
  { id: 'clone', label: 'Klonlama Paneli', icon: CloudDownload },
  { id: 'explorer', label: 'Artefakt Gezgini', icon: Layers },
  { id: 'settings', label: 'Ayarlar', icon: Settings },
];

const TabFallback: React.FC = () => (
  <div className="flex items-center justify-center h-64 text-xs text-text-muted gap-2">
    <Loader2 size={16} className="animate-spin text-accent-hover" />
    <span>Modül yükleniyor...</span>
  </div>
);

export default function App() {
  const {
    activeTab,
    setActiveTab,
    isCloneModalOpen,
    closeCloneModal,
    openCloneModal,
    toggleBottomPanel,
  } = useUiStore();
  const { analyzeResult } = useAnalyzeStore();
  const { isCloning, progress } = useCloneStore();
  const { projects } = useProjectStore();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useIpc();

  // Global Kısayollar: Ctrl+1..6 sekmeler, Ctrl+N klonlama, Ctrl+` konsol, Ctrl+L URL çubuğu
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key >= '1' && e.key <= '6') {
          e.preventDefault();
          const tabMap: Record<string, TabType> = {
            '1': 'overview',
            '2': 'tech',
            '3': 'sitemap',
            '4': 'clone',
            '5': 'explorer',
            '6': 'settings',
          };
          if (tabMap[e.key]) setActiveTab(tabMap[e.key]);
        } else if (e.key.toLowerCase() === 'n') {
          e.preventDefault();
          openCloneModal();
        } else if (e.key === '`') {
          e.preventDefault();
          toggleBottomPanel();
        } else if (e.key.toLowerCase() === 'l') {
          e.preventDefault();
          const urlInput = document.getElementById('url-input-field') as HTMLInputElement | null;
          urlInput?.focus();
          urlInput?.select();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab, openCloneModal, toggleBottomPanel]);

  const handleTabKeyDown = (e: React.KeyboardEvent, idx: number) => {
    let nextIdx = -1;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = TABS.length - 1;

    if (nextIdx !== -1) {
      e.preventDefault();
      setActiveTab(TABS[nextIdx].id);
      tabRefs.current[nextIdx]?.focus();
    }
  };

  const getTabBadge = (tabId: TabType) => {
    if (tabId === 'tech' && analyzeResult?.technologies?.length) {
      return `${analyzeResult.technologies.length}`;
    }
    if (tabId === 'sitemap' && analyzeResult?.siteMap) {
      let pageCount = 0;
      const walk = (node: SiteMapNode) => {
        pageCount++;
        (node.children || []).forEach(walk);
      };
      walk(analyzeResult.siteMap);
      return pageCount > 0 ? `${pageCount}` : null;
    }
    if (tabId === 'clone' && isCloning) {
      const total = (progress?.downloaded || 0) + (progress?.queued || 0);
      const pct = total > 0 ? Math.round(((progress?.downloaded || 0) / total) * 100) : 0;
      return `${pct}%`;
    }
    if (tabId === 'explorer' && projects.length > 0) {
      return `${projects.length}`;
    }
    return null;
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewPage />;
      case 'tech':
        return <TechStackPage />;
      case 'sitemap':
        return <SiteMapPage />;
      case 'clone':
        return <ClonePage />;
      case 'explorer':
        return <ArtifactExplorerPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <OverviewPage />;
    }
  };

  return (
    <ErrorBoundary>
      <MainLayout>
        <div className="px-6 pt-4 pb-3 border-b border-white/[0.06] bg-canvas flex items-center justify-between flex-shrink-0">
          <UrlInput />
        </div>

        <div
          role="tablist"
          aria-label="Ana Çalışma Sekmeleri"
          className="flex items-center gap-1.5 px-6 pt-2 pb-0 border-b border-white/[0.06] bg-canvas no-drag select-none flex-shrink-0"
        >
          {TABS.map((tab, idx) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const badge = getTabBadge(tab.id);

            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[idx] = el;
                }}
                type="button"
                role="tab"
                id={`main-tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`main-tabpanel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                className={`
                  flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-t-xl transition-all relative cursor-pointer
                  ${isActive
                    ? 'text-white bg-surface-2 border-t border-x border-white/[0.08]'
                    : 'text-text-muted hover:text-text-secondary hover:bg-white/[0.03]'
                  }
                `}
              >
                <Icon size={14} className={isActive ? 'text-accent-hover' : 'text-text-dim'} />
                <span>{tab.label}</span>

                {badge && (
                  <span
                    className={`px-1.5 py-0.2 text-[10px] font-mono font-bold rounded-full transition-all ${
                      tab.id === 'clone' && isCloning
                        ? 'bg-success/20 text-success-hover border border-success/40 animate-pulse'
                        : isActive
                          ? 'bg-accent/20 text-accent-hover border border-accent/30'
                          : 'bg-surface-3 text-text-dim border border-white/[0.05]'
                    }`}
                  >
                    {badge}
                  </span>
                )}

                {isActive && (
                  <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-gradient-to-r from-accent-hover via-success-hover to-accent-hover shadow-sm shadow-accent-hover/50" />
                )}
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={`main-tabpanel-${activeTab}`}
          aria-labelledby={`main-tab-${activeTab}`}
          className="flex-1 min-h-0 overflow-y-auto bg-canvas"
        >
          <Suspense fallback={<TabFallback />}>{renderTabContent()}</Suspense>
        </div>
      </MainLayout>

      <Suspense fallback={null}>
        {isCloneModalOpen && <CloneSetupModal isOpen={isCloneModalOpen} onClose={closeCloneModal} />}
        <CommandPaletteModal />
      </Suspense>

      <Toaster
        theme="dark"
        position="bottom-right"
        offset={36}
        toastOptions={{
          className: 'bg-surface-2 border border-white/[0.12] text-text-primary text-xs shadow-2xl rounded-xl',
        }}
      />
    </ErrorBoundary>
  );
}
