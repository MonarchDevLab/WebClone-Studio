import React, { useState, useEffect, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { 
  Terminal, Trash2, ArrowDownCircle, ChevronDown, 
  AlertCircle, AlertTriangle, Info, CheckCircle2 
} from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { TitleBar } from '../components/TitleBar';
import { StatusBar } from '../components/StatusBar';
import { useUiStore } from '../stores/ui-store';
import { useCloneStore } from '../stores/clone-store';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { isBottomPanelOpen, toggleBottomPanel } = useUiStore();
  const { logs, clearLogs } = useCloneStore();
  const [filterLevel, setFilterLevel] = useState<'all' | 'error' | 'warn' | 'info'>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Otomatik kaydırma
  useEffect(() => {
    if (autoScroll && isBottomPanelOpen) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs.length, autoScroll, isBottomPanelOpen]);

  const errorCount = logs.filter(l => l.level === 'error').length;
  const warnCount = logs.filter(l => l.level === 'warn').length;

  const filteredLogs = logs.filter(log => {
    if (filterLevel === 'error') return log.level === 'error';
    if (filterLevel === 'warn') return log.level === 'warn';
    if (filterLevel === 'info') return log.level === 'info';
    return true;
  });

  return (
    <div className="flex flex-col h-screen w-full bg-canvas text-text-primary">
      {/* Özel başlık çubuğu */}
      <TitleBar />
      
      {/* Ana içerik alanı */}
      <div className="flex-1 flex overflow-hidden app-content">
        <PanelGroup direction="horizontal">
          {/* Sol Panel: Sidebar */}
          <Panel defaultSize={20} minSize={15} maxSize={30}>
            <Sidebar />
          </Panel>
          
          <PanelResizeHandle className="w-[1px] bg-border-subtle hover:bg-accent hover:w-[2px] transition-all cursor-col-resize z-10" />
          
          {/* Merkez ve Alt Panel */}
          <Panel className="flex flex-col min-h-0">
            <PanelGroup direction="vertical">
              {/* Merkez: Dinamik içerik */}
              <Panel className="flex flex-col bg-canvas overflow-hidden relative min-h-0">
                {children}
              </Panel>
              
              {isBottomPanelOpen && (
                <>
                  <PanelResizeHandle className="h-[1px] bg-border-subtle hover:bg-accent hover:h-[2px] transition-all cursor-row-resize z-10" />
                  {/* Alt: Geliştirici Konsol Paneli */}
                  <Panel defaultSize={22} minSize={12} maxSize={50} className="bg-surface-1 flex flex-col min-h-0">
                    {/* Konsol Üst Araç Çubuğu */}
                    <div className="flex items-center justify-between px-3 py-1.5 bg-surface-2/90 border-b border-white/[0.06] text-xs select-none flex-shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 font-bold font-mono text-[11px] text-text-primary">
                          <Terminal size={13} className="text-accent-hover" />
                          <span>GELİŞTİRİCİ KONSOLU</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-success-hover ml-0.5 animate-pulse" />
                        </div>

                        {/* Filtre Butonları */}
                        <div className="flex items-center gap-1 bg-surface-3 p-0.5 rounded-lg border border-white/[0.06] text-[10px] font-mono">
                          <button
                            onClick={() => setFilterLevel('all')}
                            className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                              filterLevel === 'all' ? 'bg-accent/20 text-accent-hover font-bold' : 'text-text-dim hover:text-text-primary'
                            }`}
                          >
                            Tümü ({logs.length})
                          </button>
                          <button
                            onClick={() => setFilterLevel('error')}
                            className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                              filterLevel === 'error' ? 'bg-error/30 text-error-hover font-bold' : 'text-text-dim hover:text-error-hover'
                            }`}
                          >
                            Hatalar ({errorCount})
                          </button>
                          <button
                            onClick={() => setFilterLevel('warn')}
                            className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                              filterLevel === 'warn' ? 'bg-warning/30 text-warning-hover font-bold' : 'text-text-dim hover:text-warning-hover'
                            }`}
                          >
                            Uyarılar ({warnCount})
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setAutoScroll(!autoScroll)}
                          title={`Otomatik kaydırma: ${autoScroll ? 'Açık' : 'Kapalı'}`}
                          className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono rounded border transition-all cursor-pointer ${
                            autoScroll 
                              ? 'bg-accent/15 text-accent-hover border-accent/30' 
                              : 'bg-surface-3 text-text-dim border-transparent'
                          }`}
                        >
                          <ArrowDownCircle size={11} />
                          <span>Oto-Kaydır</span>
                        </button>

                        <button
                          onClick={clearLogs}
                          title="Konsol geçmişini temizle"
                          className="p-1 hover:text-error-hover text-text-dim hover:bg-white/[0.05] rounded transition-colors cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>

                        <button
                          onClick={toggleBottomPanel}
                          title="Konsolu Gizle"
                          className="p-1 hover:text-text-primary text-text-dim hover:bg-white/[0.05] rounded transition-colors cursor-pointer ml-1"
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Konsol Akış Alanı */}
                    <div className="p-3 flex-1 overflow-auto font-mono text-[11px] leading-relaxed text-text-secondary flex flex-col gap-1.5 min-h-0 bg-canvas/60">
                      {filteredLogs.length === 0 ? (
                        <div className="text-text-dim py-4 text-center font-mono text-[11px]">
                          [SİSTEM] {filterLevel === 'all' ? 'Henüz konsol kaydı yok. Sistem hazır.' : 'Bu filtreye uygun kayıt bulunamadı.'}
                        </div>
                      ) : (
                        filteredLogs.map((log, i) => (
                          <div 
                            key={i} 
                            className={`flex items-start gap-2 ${
                              log.level === 'error' 
                                ? 'text-error-hover bg-error/10 px-2 py-0.5 rounded border border-error/20' 
                                : log.level === 'warn' 
                                  ? 'text-warning-hover bg-warning/10 px-2 py-0.5 rounded border border-warning/20' 
                                  : 'text-text-muted hover:text-text-primary'
                            }`}
                          >
                            <span className="text-text-dim text-[10px] select-none flex-shrink-0">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <span className={`text-[9px] font-bold px-1 rounded uppercase select-none flex-shrink-0 ${
                              log.level === 'error' ? 'bg-error text-black' : log.level === 'warn' ? 'bg-warning text-black' : 'bg-surface-3 text-accent-hover'
                            }`}>
                              {log.level}
                            </span>
                            <span className="break-all">{log.message}</span>
                          </div>
                        ))
                      )}
                      <div ref={logEndRef} />
                    </div>
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>
      
      {/* Alt durum çubuğu */}
      <StatusBar />
    </div>
  );
};
