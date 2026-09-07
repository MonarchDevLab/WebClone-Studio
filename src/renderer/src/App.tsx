import React from 'react';
import { Toaster } from 'sonner';
import { MainLayout } from './layouts/MainLayout';
import { UrlInput } from './components/UrlInput';
import { CloneSetupModal } from './components/modal/CloneSetupModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OverviewPage } from './pages/OverviewPage';
import { TechStackPage } from './pages/TechStackPage';
import { SiteMapPage } from './pages/SiteMapPage';
import { ClonePage } from './pages/ClonePage';
import { SettingsPage } from './pages/SettingsPage';
import { useUiStore, TabType } from './stores/ui-store';
import { useAnalyzeStore } from './stores/analyze-store';
import { useCloneStore } from './stores/clone-store';
import { useIpc } from './hooks/useIpc';
import { LayoutDashboard, Cpu, Network, CloudDownload, Settings } from 'lucide-react';

/** Sekme tanımları */
const TABS: Array<{ id: TabType; label: string; icon: React.FC<{ size?: number; className?: string }> }> = [
  { id: 'overview', label: 'Genel Bakış', icon: LayoutDashboard },
  { id: 'tech', label: 'Teknoloji Yığını', icon: Cpu },
  { id: 'sitemap', label: 'Site Haritası', icon: Network },
  { id: 'clone', label: 'Klonlama Paneli', icon: CloudDownload },
  { id: 'settings', label: 'Ayarlar', icon: Settings },
];

export default function App() {
  const { activeTab, setActiveTab, isCloneModalOpen, closeCloneModal, openCloneModal, toggleBottomPanel } = useUiStore();
  const { analyzeResult } = useAnalyzeStore();
  const { isCloning, progress } = useCloneStore();
  
  // IPC dinleyicilerini başlat
  useIpc();

  // Global Kısayol Dinleyicileri (Ctrl+1-5 sekmeler, Ctrl+N klonlama, Ctrl+` konsol, Ctrl+L URL çubuğu)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key >= '1' && e.key <= '5') {
          e.preventDefault();
          const tabMap: Record<string, TabType> = {
            '1': 'overview',
            '2': 'tech',
            '3': 'sitemap',
            '4': 'clone',
            '5': 'settings',
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

  const getTabBadge = (tabId: TabType) => {
    if (tabId === 'tech' && analyzeResult?.technologies?.length) {
      return `${analyzeResult.technologies.length}`;
    }
    if (tabId === 'sitemap' && analyzeResult?.siteMap) {
      let pageCount = 0;
      const walk = (node: any) => { pageCount++; (node.children || []).forEach(walk); };
      walk(analyzeResult.siteMap);
      return pageCount > 0 ? `${pageCount}` : null;
    }
    if (tabId === 'clone' && isCloning) {
      const total = (progress?.downloaded || 0) + (progress?.queued || 0);
      const pct = total > 0 ? Math.round(((progress?.downloaded || 0) / total) * 100) : 0;
      return `${pct}%`;
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
      case 'settings':
        return <SettingsPage />;
      default:
        return <OverviewPage />;
    }
  };

  return (
    <ErrorBoundary>
      <MainLayout>
        {/* Üst Kısım: URL Giriş Çubuğu ve Durum Paneli */}
        <div className="px-6 pt-4 pb-3 border-b border-white/[0.06] bg-canvas flex items-center justify-between flex-shrink-0">
          <UrlInput />
        </div>

        {/* Sekme Navigasyonu */}
        <div className="flex items-center gap-1.5 px-6 pt-2 pb-0 border-b border-white/[0.06] bg-canvas no-drag select-none flex-shrink-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const badge = getTabBadge(tab.id);

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-t-xl transition-all relative
                  ${isActive
                    ? 'text-white bg-surface-2 border-t border-x border-white/[0.08]'
                    : 'text-text-muted hover:text-text-secondary hover:bg-white/[0.03]'
                  }
                `}
              >
                <Icon size={14} className={isActive ? 'text-accent-hover' : 'text-text-dim'} />
                <span>{tab.label}</span>

                {/* Telemetri Sayı / Durum Rozeti */}
                {badge && (
                  <span className={`px-1.5 py-0.2 text-[10px] font-mono font-bold rounded-full transition-all ${
                    tab.id === 'clone' && isCloning
                      ? 'bg-success/20 text-success-hover border border-success/40 animate-pulse'
                      : isActive
                        ? 'bg-accent/20 text-accent-hover border border-accent/30'
                        : 'bg-surface-3 text-text-dim border border-white/[0.05]'
                  }`}>
                    {badge}
                  </span>
                )}

                {/* Aktif sekme altı neon çizgisi */}
                {isActive && (
                  <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-gradient-to-r from-accent-hover via-success-hover to-accent-hover shadow-sm shadow-accent-hover/50" />
                )}
              </button>
            );
          })}
        </div>

        {/* Aktif Sekme İçeriği */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-canvas">
          {renderTabContent()}
        </div>
      </MainLayout>

      {/* Klonlama Kurulum Sihirbazı Modalı */}
      <CloneSetupModal
        isOpen={isCloneModalOpen}
        onClose={closeCloneModal}
      />

      {/* Komut Konsolu Modalı (Ctrl+K) */}
      <CommandPaletteModal />

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
