import React, { useState, useEffect, useRef } from 'react';
import { 
  Globe, Loader2, Download, Sparkles, Lock, LockOpen, 
  Clipboard, History, X, CornerDownLeft 
} from 'lucide-react';
import { useAnalyzeStore } from '../stores/analyze-store';
import { useUiStore } from '../stores/ui-store';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

const STORAGE_KEY = 'webclone_recent_urls';

export const UrlInput: React.FC = () => {
  const { url, setUrl, isAnalyzing, startAnalysis } = useAnalyzeStore();
  const { openCloneModal } = useUiStore();
  const [inputValue, setInputValue] = useState(url);
  const [showHistory, setShowHistory] = useState(false);
  const [recentUrls, setRecentUrls] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Yerel geçmişi yükle
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setRecentUrls(JSON.parse(stored));
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (url && !inputValue) {
      setInputValue(url);
    }
  }, [url]);

  // Dışarı tıklandığında geçmişi kapat
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const saveToHistory = (savedUrl: string) => {
    try {
      const updated = [savedUrl, ...recentUrls.filter(u => u !== savedUrl)].slice(0, 6);
      setRecentUrls(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  const handleAnalyze = async (overrideUrl?: string) => {
    const targetUrl = overrideUrl || inputValue;
    if (!targetUrl.trim()) {
      toast.error('Lütfen geçerli bir web sitesi adresi girin.');
      return;
    }
    
    let formattedUrl = targetUrl.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
      setInputValue(formattedUrl);
    }

    setUrl(formattedUrl);
    setShowHistory(false);
    saveToHistory(formattedUrl);

    try {
      await startAnalysis(formattedUrl);
      toast.success('Site analizi tamamlandı!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Analiz sırasında hata oluştu.';
      toast.error(msg);
    }
  };

  const handleCloneClick = () => {
    if (!inputValue.trim()) {
      toast.error('Lütfen önce bir web sitesi adresi girin.');
      return;
    }
    let formattedUrl = inputValue.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
      setInputValue(formattedUrl);
    }
    setUrl(formattedUrl);
    setShowHistory(false);
    saveToHistory(formattedUrl);
    openCloneModal();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowHistory(false);
      return;
    }
    if (e.key === 'Enter') {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        handleCloneClick();
      } else {
        e.preventDefault();
        handleAnalyze();
      }
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        let clean = text.trim();
        setInputValue(clean);
        toast.info('Panodan yapıştırıldı');
      }
    } catch {
      toast.error('Pano okunamadı');
    }
  };

  const lowerInput = inputValue.trim().toLowerCase();
  const isHttps = lowerInput.startsWith('https://');
  const isHttp = lowerInput.startsWith('http://') && !isHttps;

  return (
    <div ref={containerRef} className="relative flex items-center gap-2.5 w-full max-w-5xl no-drag">
      <div className="relative flex-1 flex items-center">
        {/* Sol Protokol Rozeti */}
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {isHttps ? (
            <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-success-hover bg-success/15 border border-success/30 px-1.5 py-0.5 rounded">
              <Lock size={10} />
              <span>HTTPS</span>
            </span>
          ) : isHttp ? (
            <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-warning-hover bg-warning/15 border border-warning/30 px-1.5 py-0.5 rounded">
              <LockOpen size={10} />
              <span>HTTP</span>
            </span>
          ) : (
            <div className="text-text-dim">
              <Globe size={15} />
            </div>
          )}
        </div>

        {/* Ana URL Girdisi */}
        <input
          id="url-input-field"
          aria-label="Web sitesi URL adresi"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (recentUrls.length > 0) setShowHistory(true); }}
          placeholder="Web sitesi URL'si girin (örn: react.dev)..."
          className={cn(
            "w-full bg-surface-2 border border-white/[0.09] text-text-primary text-xs rounded-xl pr-24 py-2.5 focus:outline-none focus:border-accent/70 focus:ring-1 focus:ring-accent/30 transition-all font-mono placeholder:text-text-dim",
            isHttps || isHttp ? "pl-20" : "pl-9"
          )}
        />

        {/* Giriş İçi Hızlı Araçlar: Pano & Geçmiş */}
        <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
          {inputValue && (
            <button
              onClick={() => setInputValue('')}
              title="Temizle"
              className="p-1 text-text-dim hover:text-text-primary rounded transition-colors"
            >
              <X size={13} />
            </button>
          )}

          <button
            onClick={handlePasteClipboard}
            title="Panodan Yapıştır"
            className="p-1.5 text-text-muted hover:text-accent-hover hover:bg-white/[0.05] rounded transition-colors cursor-pointer"
          >
            <Clipboard size={13} />
          </button>

          {recentUrls.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              title="Son Taranan Siteler"
              className={cn(
                "p-1.5 rounded transition-colors cursor-pointer",
                showHistory ? "text-accent-hover bg-accent/20" : "text-text-muted hover:text-text-primary hover:bg-white/[0.05]"
              )}
            >
              <History size={13} />
            </button>
          )}
        </div>

        {/* Geçmiş Dropdown Menüsü */}
        {showHistory && recentUrls.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-surface-2/95 border border-white/[0.12] rounded-xl shadow-2xl backdrop-blur-md z-40 overflow-hidden py-1">
            <div className="px-3 py-1 text-[10px] uppercase font-mono text-text-dim border-b border-white/[0.05] flex justify-between items-center">
              <span>Son Taranan Siteler</span>
              <span className="text-[9px]">Seçmek için tıkla</span>
            </div>
            {recentUrls.map((hUrl, i) => (
              <button
                type="button"
                key={hUrl || i}
                onClick={() => {
                  setInputValue(hUrl);
                  setShowHistory(false);
                  handleAnalyze(hUrl);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setInputValue(hUrl);
                    setShowHistory(false);
                    handleAnalyze(hUrl);
                  }
                }}
                className="w-full text-left flex items-center justify-between px-3 py-2 text-xs font-mono text-text-secondary hover:text-text-primary hover:bg-white/[0.06] cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2 truncate">
                  <Globe size={12} className="text-accent-hover flex-shrink-0" />
                  <span className="truncate">{hUrl}</span>
                </div>
                <CornerDownLeft size={11} className="text-text-dim flex-shrink-0 ml-2" />
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Analiz Et Butonu */}
      <button
        onClick={() => handleAnalyze()}
        disabled={isAnalyzing || !inputValue.trim()}
        title="Web sitesini 6 katmanlı derinlemesine tara (Enter)"
        className={cn(
          "flex items-center justify-center gap-1.5 min-w-[105px] bg-accent text-black text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-accent/20 active:scale-95",
          !isAnalyzing && inputValue.trim() ? "hover:bg-accent-hover cursor-pointer" : "opacity-50 cursor-not-allowed"
        )}
      >
        {isAnalyzing ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            <span>Taranıyor</span>
          </>
        ) : (
          <>
            <Sparkles size={14} />
            <span>Analiz Et</span>
          </>
        )}
      </button>
      
      {/* Klon Sihirbazı Butonu */}
      <button 
        onClick={handleCloneClick}
        disabled={!inputValue.trim()}
        title="Klonlama Ayarları ve Kurulum Sihirbazı (Ctrl+Enter)"
        className={cn(
          "flex items-center gap-1.5 bg-success/10 text-success-hover border border-success/30 hover:bg-success/20 text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm",
          inputValue.trim() ? "active:scale-95 cursor-pointer" : "opacity-50 cursor-not-allowed"
        )}
      >
        <Download size={14} />
        <span>Klon Sihirbazı</span>
      </button>
    </div>
  );
};
