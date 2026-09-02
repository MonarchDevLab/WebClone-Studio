import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, LayoutDashboard, Cpu, Network, CloudDownload, Settings, 
  Terminal, Download, CornerDownLeft, Globe, FileDown, Copy
} from 'lucide-react';
import { useUiStore } from '../stores/ui-store';
import { useAnalyzeStore } from '../stores/analyze-store';
import { toast } from 'sonner';

interface CommandItem {
  id: string;
  title: string;
  category: 'Sayfalar' | 'Aksiyonlar' | 'Sistem' | 'Raporlama';
  icon: React.FC<{ size?: number; className?: string }>;
  action: () => void;
  shortcut?: string;
}

export const CommandPaletteModal: React.FC = () => {
  const { 
    isCommandPaletteOpen, closeCommandPalette, toggleCommandPalette, 
    setActiveTab, openCloneModal, toggleBottomPanel 
  } = useUiStore();
  const { url } = useAnalyzeStore();

  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global Ctrl+K / Cmd+K dinleyici
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleCommandPalette();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleCommandPalette]);

  // Açıldığında input'a otomatik odaklan
  useEffect(() => {
    if (isCommandPaletteOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isCommandPaletteOpen]);

  const commands: CommandItem[] = [
    {
      id: 'tab-overview',
      title: 'Genel Bakış Sayfasına Git',
      category: 'Sayfalar',
      icon: LayoutDashboard,
      action: () => { setActiveTab('overview'); closeCommandPalette(); },
      shortcut: 'Tab 1',
    },
    {
      id: 'tab-tech',
      title: 'Teknoloji Yığını Sayfasına Git',
      category: 'Sayfalar',
      icon: Cpu,
      action: () => { setActiveTab('tech'); closeCommandPalette(); },
      shortcut: 'Tab 2',
    },
    {
      id: 'tab-sitemap',
      title: 'Site Haritası Sayfasına Git',
      category: 'Sayfalar',
      icon: Network,
      action: () => { setActiveTab('sitemap'); closeCommandPalette(); },
      shortcut: 'Tab 3',
    },
    {
      id: 'tab-clone',
      title: 'Klonlama Kontrol Paneline Git',
      category: 'Sayfalar',
      icon: CloudDownload,
      action: () => { setActiveTab('clone'); closeCommandPalette(); },
      shortcut: 'Tab 4',
    },
    {
      id: 'tab-settings',
      title: 'Ayarlar Sayfasına Git',
      category: 'Sayfalar',
      icon: Settings,
      action: () => { setActiveTab('settings'); closeCommandPalette(); },
      shortcut: 'Tab 5',
    },
    {
      id: 'act-clone-wizard',
      title: 'Klonlama Kurulum Sihirbazını Aç',
      category: 'Aksiyonlar',
      icon: Download,
      action: () => { openCloneModal(); closeCommandPalette(); },
      shortcut: 'Ctrl+N',
    },
    {
      id: 'act-focus-url',
      title: 'Adres Çubuğuna Odaklan',
      category: 'Aksiyonlar',
      icon: Globe,
      action: () => {
        closeCommandPalette();
        const el = document.querySelector('input[placeholder*="Web"]') as HTMLInputElement;
        if (el) { el.focus(); el.select(); }
      },
      shortcut: 'Ctrl+L',
    },
    {
      id: 'act-toggle-logs',
      title: 'Alt Konsol / Canlı Log Panelini Aç / Kapat',
      category: 'Sistem',
      icon: Terminal,
      action: () => { toggleBottomPanel(); closeCommandPalette(); },
      shortcut: 'Ctrl+`',
    },
    {
      id: 'act-download-system-map',
      title: 'Mimari Sistem Haritasını İndir (.md)',
      category: 'Raporlama',
      icon: FileDown,
      action: async () => {
        closeCommandPalette();
        const analyzeResult = useAnalyzeStore.getState().analyzeResult;
        const currentUrl = useAnalyzeStore.getState().url;
        if (!analyzeResult) {
          toast.error('Önce bir web sitesini analiz etmelisiniz.');
          return;
        }
        if (window.electronAPI?.exportSystemMap && window.electronAPI?.saveSystemMapFile) {
          const md = await window.electronAPI.exportSystemMap(analyzeResult);
          let domain = 'site';
          try { domain = new URL(currentUrl).hostname.replace(/\./g, '_'); } catch {}
          const res = await window.electronAPI.saveSystemMapFile(md, `SYSTEM_MAP_${domain}.md`);
          if (res.success && res.filePath) {
            toast.success(`Sistem Haritası kaydedildi: ${res.filePath.split(/[\\/]/).pop()}`);
          }
        }
      },
      shortcut: 'Ctrl+Shift+S',
    },
    {
      id: 'act-copy-system-map',
      title: 'Mimari Sistem Haritasını Panoya Kopyala (.md)',
      category: 'Raporlama',
      icon: Copy,
      action: async () => {
        closeCommandPalette();
        const analyzeResult = useAnalyzeStore.getState().analyzeResult;
        if (!analyzeResult) {
          toast.error('Önce bir web sitesini analiz etmelisiniz.');
          return;
        }
        if (window.electronAPI?.exportSystemMap) {
          const md = await window.electronAPI.exportSystemMap(analyzeResult);
          await navigator.clipboard.writeText(md);
          toast.success('Sistem Haritası panoya kopyalandı!');
        }
      },
    },
  ];

  const filteredCommands = commands.filter(cmd => 
    cmd.title.toLowerCase().includes(search.toLowerCase()) ||
    cmd.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredCommands.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + (filteredCommands.length || 1)) % (filteredCommands.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      closeCommandPalette();
    }
  };

  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector<HTMLElement>('[data-selected="true"]');
      activeEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isCommandPaletteOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/75 backdrop-blur-md animate-in fade-in duration-100"
      onClick={closeCommandPalette}
      role="dialog"
      aria-modal="true"
      aria-label="Komut Paleti"
    >
      <div 
        className="w-full max-w-xl bg-surface-2/95 border border-white/[0.12] rounded-2xl shadow-2xl shadow-black/80 overflow-hidden text-text-primary"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Arama Alanı */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.08] bg-canvas/40">
          <Search size={16} className="text-text-muted flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Bir komut veya sayfa arayın..."
            className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-dim outline-none font-sans"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-text-muted bg-surface-3 rounded border border-white/[0.08]">
            ESC
          </kbd>
        </div>

        {/* Sonuç Listesi */}
        <div ref={listRef} className="max-h-72 overflow-y-auto p-2 space-y-1" role="listbox" aria-label="Komutlar">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-dim">
              Eşleşen komut bulunamadı.
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = selectedIndex === idx;
              return (
                <div
                  key={cmd.id}
                  role="option"
                  aria-selected={isSelected}
                  data-selected={isSelected ? "true" : "false"}
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-xs transition-colors ${
                    isSelected 
                      ? 'bg-accent/15 text-white border border-accent/30' 
                      : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.04] border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-accent/20 text-accent-hover' : 'bg-surface-3 text-text-dim'}`}>
                      <Icon size={14} />
                    </div>
                    <span className="font-medium truncate">{cmd.title}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase text-text-dim">
                      {cmd.category}
                    </span>
                    {cmd.shortcut && (
                      <kbd className="px-1.5 py-0.5 text-[9px] font-mono text-text-muted bg-surface-3 rounded border border-white/[0.08]">
                        {cmd.shortcut}
                      </kbd>
                    )}
                    {isSelected && (
                      <CornerDownLeft size={12} className="text-accent-hover ml-1" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Alt Kısayol İpuçları */}
        <div className="px-4 py-2 border-t border-white/[0.06] bg-canvas/60 flex items-center justify-between text-[11px] text-text-dim font-mono">
          <div className="flex items-center gap-3">
            <span>&uarr;&darr; Gezin</span>
            <span>&crarr; Çalıştır</span>
          </div>
          <span className="text-accent-hover font-semibold">WebClone Studio Komut Konsolu</span>
        </div>
      </div>
    </div>
  );
};
