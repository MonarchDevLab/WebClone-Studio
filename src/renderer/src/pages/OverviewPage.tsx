import React from 'react';
import {
  Globe, Shield, Palette, Type, ExternalLink, Cpu, Download, Activity, Smartphone,
  FileText, Copy, FileDown, XCircle
} from 'lucide-react';
import { useAnalyzeStore } from '../stores/analyze-store';
import { useUiStore } from '../stores/ui-store';
import { OverviewEmptyState } from '../components/overview/OverviewEmptyState';
import { OverviewSecurityPaletteSection } from '../components/overview/OverviewSecurityPaletteSection';
import { toast } from 'sonner';

export const OverviewPage: React.FC = () => {
  const { analyzeResult, url, setUrl, startAnalysis, isAnalyzing, error } = useAnalyzeStore();
  const { openCloneModal, setActiveTab } = useUiStore();

  const getDomain = (rawUrl: string): string => {
    try {
      return new URL(rawUrl).hostname;
    } catch {
      return rawUrl.replace(/^https?:\/\//, '').split('/')[0] || rawUrl;
    }
  };

  const handleDemoClick = (demoUrl: string) => {
    setUrl(demoUrl);
    startAnalysis(demoUrl);
    toast.info(`${demoUrl} analizi başlatıldı...`);
  };

  // 1. Analiz Devam Ediyor (Loading Skeleton / Radar State)
  if (isAnalyzing) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-center p-8 animate-in fade-in duration-300">
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-2xl bg-surface-2 border border-accent/40 flex items-center justify-center text-accent-hover shadow-2xl shadow-accent/20 relative z-10">
            <Activity size={36} className="animate-spin text-accent-hover" style={{ animationDuration: '3s' }} />
          </div>
          <div className="absolute inset-0 rounded-2xl bg-accent/30 blur-2xl animate-pulse" />
        </div>

        <h3 className="text-base font-bold text-text-primary mb-1.5 flex items-center gap-2">
          <span>{getDomain(url) || 'Hedef Site'} Analiz Ediliyor</span>
          <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
        </h3>
        <p className="text-xs text-text-muted max-w-md leading-relaxed mb-6">
          Chromium render motoru başlatıldı; CSS tasarım tokenları, teknoloji imzaları, güvenlik başlıkları ve sayfa topolojisi taranıyor...
        </p>

        <div className="w-full max-w-md bg-surface-2 border border-white/[0.07] rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-text-secondary">Tarama Katmanı:</span>
            <span className="text-accent-hover font-semibold">Offscreen Chromium + Cheerio</span>
          </div>
          <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-accent via-secondary to-accent-hover w-2/3 animate-pulse rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  // 2. Analiz Hatası (Error State)
  if (error && !analyzeResult) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-center p-8 animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-2xl bg-error/15 border border-error/30 flex items-center justify-center text-error-hover mb-4 shadow-xl shadow-error/10">
          <XCircle size={32} />
        </div>
        <h3 className="text-base font-bold text-text-primary mb-1.5">Site Analizi Başarısız Oldu</h3>
        <p className="text-xs text-text-muted max-w-md leading-relaxed mb-6 font-mono bg-surface-2 border border-white/[0.07] p-3 rounded-xl text-error-hover">
          {error}
        </p>
        <button
          onClick={() => url && startAnalysis(url)}
          className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-black font-bold text-xs rounded-xl shadow-lg shadow-accent/20 transition-all active:scale-95 cursor-pointer"
        >
          Yeniden Dene
        </button>
      </div>
    );
  }

  if (!analyzeResult) {
    return <OverviewEmptyState onSelectDemo={handleDemoClick} />;
  }

  const { technologies, designTokens, security, meta } = analyzeResult;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Kopyalandı: ${text}`);
  };

  const copyAllTokensAsCss = () => {
    if (!designTokens?.colors?.length) return;
    const cssVars = designTokens.colors.map((c, i) => `  --color-${c.role || `token-${i + 1}`}: ${c.hex};`).join('\n');
    const fullBlock = `:root {\n${cssVars}\n}`;
    navigator.clipboard.writeText(fullBlock);
    toast.success('Tüm renk tokenları CSS değişkeni olarak kopyalandı!');
  };

  const handleDownloadSystemMap = async () => {
    try {
      if (!window.electronAPI?.exportSystemMap || !window.electronAPI?.saveSystemMapFile) {
        toast.error('Dışa aktarma API\'si mevcut değil.');
        return;
      }
      const md = await window.electronAPI.exportSystemMap(analyzeResult);
      let domain = 'site';
      try { domain = new URL(url).hostname.replace(/\./g, '_'); } catch {}
      const res = await window.electronAPI.saveSystemMapFile(md, `SYSTEM_MAP_${domain}.md`);
      if (res.success && res.filePath) {
        toast.success(`Sistem Haritası kaydedildi: ${res.filePath.split(/[\\/]/).pop()}`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Dışa aktarma başarısız';
      toast.error(`Dışa aktarma hatası: ${msg}`);
    }
  };

  const handleCopySystemMap = async () => {
    try {
      if (!window.electronAPI?.exportSystemMap) {
        toast.error('Dışa aktarma API\'si mevcut değil.');
        return;
      }
      const md = await window.electronAPI.exportSystemMap(analyzeResult);
      await navigator.clipboard.writeText(md);
      toast.success('Ultra Detaylı Sistem Haritası (.md) panoya kopyalandı!');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Kopyalama başarısız';
      toast.error(`Kopyalama hatası: ${msg}`);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto animate-in fade-in duration-200">
      
      {/* 1. Header & Operasyonel Durum Paneli */}
      <div className="bg-surface-2 border border-white/[0.07] rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-lg font-bold text-text-primary truncate">{meta?.title || url}</h1>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-mono font-bold bg-success/15 text-success-hover border border-success/30 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-success-hover animate-pulse" />
              ANALİZ TAMAMLANDI
            </span>
            {meta?.language && (
              <span className="px-2 py-0.5 text-[10px] uppercase font-mono font-semibold bg-surface-3 border border-white/[0.06] text-text-secondary rounded">
                {meta.language}
              </span>
            )}
          </div>
          <p className="text-xs text-text-secondary max-w-3xl line-clamp-2 leading-relaxed">
            {meta?.description || 'Meta açıklama etiketi bulunamadı.'}
          </p>
          <div className="flex items-center gap-4 pt-1 text-xs text-text-dim font-mono">
            <span className="flex items-center gap-1"><Globe size={11} /> {getDomain(url)}</span>
            <span className="flex items-center gap-1"><Type size={11} /> {meta?.encoding || 'UTF-8'}</span>
            <span className="flex items-center gap-1"><Smartphone size={11} /> {meta?.viewport ? 'Mobil Uyumlu' : 'Standart'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-shrink-0">
          <button
            onClick={openCloneModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-success hover:bg-success-hover text-black rounded-xl text-xs font-bold transition-all shadow-lg shadow-success/20 active:scale-95 cursor-pointer"
          >
            <Download size={14} />
            <span>Klon Sihirbazını Aç</span>
          </button>
          
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-surface-3 hover:bg-white/[0.08] hover:border-white/[0.16] border border-white/[0.08] rounded-xl text-xs text-text-secondary hover:text-text-primary transition-all"
          >
            <span>Ziyaret Et</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {/* Mimari Sistem Haritası (.md) Dışa Aktarım Bannerı */}
      <div className="bg-gradient-to-r from-accent/10 via-surface-2 to-secondary/10 border border-accent/20 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-accent/20 text-accent-hover border border-accent/30 flex-shrink-0">
            <FileText size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-text-primary uppercase tracking-wider">
                MİMARİ SİSTEM HARİTASI & ŞARTNAME (.MD)
              </span>
              <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-accent/20 text-accent-hover border border-accent/30 rounded">
                MİMARİ ŞARTNAME
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              Tüm siteyi indirmeden; mimariyi, CSS tokenlarını, sayfa topolojisini ve teknik kod şablonlarını ultra detaylı Markdown olarak alın.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 w-full md:w-auto">
          <button
            onClick={handleDownloadSystemMap}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-accent hover:bg-accent-hover text-black font-bold rounded-xl text-xs transition-all shadow-md shadow-accent/20 active:scale-95 cursor-pointer"
            title="Sistem haritasını .md dosyası olarak bilgisayarına kaydet"
          >
            <FileDown size={14} />
            <span>Sistem Haritasını İndir (.md)</span>
          </button>
          <button
            onClick={handleCopySystemMap}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-surface-3 hover:bg-white/[0.08] hover:border-white/[0.16] text-text-primary border border-white/[0.08] rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
            title="Markdown içeriğini panoya kopyala"
          >
            <Copy size={13} />
            <span className="hidden sm:inline">Kopyala</span>
          </button>
        </div>
      </div>

      {/* 2. Operasyonel Metrik Kartları Grid (Command Center Bento) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Teknoloji Sayısı */}
        <button
          type="button"
          onClick={() => setActiveTab('tech')}
          aria-label={`Teknoloji Yığını sekmesine git: ${technologies.length} teknoloji tespit edildi`}
          className="text-left w-full bg-surface-2 border border-white/[0.07] hover:border-accent/40 rounded-2xl p-4.5 cursor-pointer transition-all hover:shadow-lg relative overflow-hidden group"
        >
          <div className="flex justify-between items-start mb-3">
            <div className="p-2 bg-accent/10 text-accent-hover rounded-xl border border-accent/20">
              <Cpu size={18} />
            </div>
            <span className="px-2 py-0.5 text-[9px] font-mono bg-accent/40 text-accent-hover border border-accent/30 rounded-md">
              6 Katman
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-text-primary tracking-tight">
            {technologies.length}
          </div>
          <div className="text-[10px] uppercase font-mono text-text-muted mt-1 tracking-wider">
            Tespit Edilen Teknoloji
          </div>
          <div className="absolute bottom-3 right-3 w-1.5 h-1.5 rounded-full bg-accent-hover shadow-sm shadow-accent-hover/80" />
        </button>

        {/* Renk Token Sayısı */}
        <div className="bg-surface-2 border border-white/[0.07] rounded-2xl p-4.5 relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <div className="p-2 bg-warning/10 text-warning-hover rounded-xl border border-warning/20">
              <Palette size={18} />
            </div>
            <span className="px-2 py-0.5 text-[9px] font-mono bg-warning/40 text-warning-hover border border-warning/30 rounded-md">
              Computed
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-text-primary tracking-tight">
            {designTokens?.colors?.length || 0}
          </div>
          <div className="text-[10px] uppercase font-mono text-text-muted mt-1 tracking-wider">
            Tasarım Renk Tokenı
          </div>
          <div className="absolute bottom-3 right-3 w-1.5 h-1.5 rounded-full bg-warning-hover shadow-sm shadow-warning-hover/80" />
        </div>

        {/* Güvenlik Puanı */}
        <div className="bg-surface-2 border border-white/[0.07] rounded-2xl p-4.5 relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <div className="p-2 bg-success/10 text-success-hover rounded-xl border border-success/20">
              <Shield size={18} />
            </div>
            <span className={`px-2 py-0.5 text-[9px] font-mono rounded-md border ${
              security?.https ? 'bg-success/40 text-success-hover border-success/30' : 'bg-error/40 text-error-hover border-error/30'
            }`}>
              {security?.https ? 'HTTPS Aktif' : 'HTTP Güvensiz'}
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-success-hover tracking-tight">
            {[security?.https, security?.hsts, security?.csp, security?.robotsTxt, security?.sitemap].filter(Boolean).length} / 5
          </div>
          <div className="text-[10px] uppercase font-mono text-text-muted mt-1 tracking-wider">
            Güvenlik Kriteri
          </div>
          <div className="absolute bottom-3 right-3 w-1.5 h-1.5 rounded-full bg-success-hover shadow-sm shadow-success-hover/80" />
        </div>

        {/* Tipografi Skalası */}
        <div className="bg-surface-2 border border-white/[0.07] rounded-2xl p-4.5 relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <div className="p-2 bg-secondary/10 text-secondary-hover rounded-xl border border-secondary/20">
              <Type size={18} />
            </div>
            <span className="px-2 py-0.5 text-[9px] font-mono bg-secondary/40 text-secondary-hover border border-secondary/30 rounded-md">
              Font Skalası
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-text-primary tracking-tight">
            {designTokens?.typography?.length || 0}
          </div>
          <div className="text-[10px] uppercase font-mono text-text-muted mt-1 tracking-wider">
            Tipografi Düzeyi
          </div>
          <div className="absolute bottom-3 right-3 w-1.5 h-1.5 rounded-full bg-secondary-hover shadow-sm shadow-secondary-hover/80" />
        </div>

      </div>

      <OverviewSecurityPaletteSection
        security={security}
        designTokens={designTokens}
        onCopyHex={copyToClipboard}
        onCopyAllTokens={copyAllTokensAsCss}
      />

    </div>
  );
};
