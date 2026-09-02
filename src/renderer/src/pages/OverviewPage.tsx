import React from 'react';
import {
  Globe, Shield, CheckCircle2, XCircle, Layers, Palette,
  Type, ExternalLink, Cpu, Download, ArrowRight, Activity, Zap, Smartphone,
  FileText, Copy, FileDown
} from 'lucide-react';
import { useAnalyzeStore } from '../stores/analyze-store';
import { useUiStore } from '../stores/ui-store';
import { toast } from 'sonner';

const DEMO_SITES = [
  { name: 'React.dev', url: 'https://react.dev', desc: 'Modern React Docs' },
  { name: 'Tailwind CSS', url: 'https://tailwindcss.com', desc: 'Tasarım Sistemi & Utility' },
  { name: 'Vite', url: 'https://vite.dev', desc: 'Frontend Build Motoru' },
  { name: 'GitHub', url: 'https://github.com', desc: 'Platform Mimarisi' },
];

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
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-center p-8 animate-in fade-in duration-300">
        {/* Canlı Radar / Sinyal İkonu */}
        <div className="relative mb-5">
          <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-white/[0.1] flex items-center justify-center text-accent-hover shadow-2xl shadow-accent/10 relative z-10">
            <Globe size={32} className="animate-pulse" />
          </div>
          <div className="absolute inset-0 rounded-2xl bg-accent/20 blur-xl animate-ping opacity-25" />
        </div>

        <h3 className="text-base font-bold text-text-primary mb-1.5">Web Sitesi Analizi Bekleniyor</h3>
        <p className="text-xs text-text-muted max-w-lg leading-relaxed mb-6">
          Yukarıdaki adres çubuğuna hedef web sitesini girin veya aşağıdaki hazır platformlardan birini seçerek analizi anında başlatın.
        </p>

        {/* Hızlı Demo Seçenekleri (Quick Launchpad) */}
        <div className="w-full max-w-lg mb-8">
          <div className="text-[10px] uppercase font-mono text-text-dim tracking-wider mb-2.5">
            Örnek Sitelerle Hemen Test Edin
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {DEMO_SITES.map((demo) => (
              <button
                key={demo.url}
                onClick={() => handleDemoClick(demo.url)}
                className="flex flex-col items-start p-3 bg-surface-2 hover:bg-surface-3 border border-white/[0.07] hover:border-accent/40 rounded-xl text-left transition-all cursor-pointer group shadow-sm active:scale-95"
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-xs font-bold text-text-primary group-hover:text-accent-hover transition-colors">
                    {demo.name}
                  </span>
                  <Zap size={12} className="text-accent-hover opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <span className="text-[10px] text-text-dim font-mono truncate w-full">
                  {demo.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Sistem Yetenekleri Hapları */}
        <div className="flex items-center gap-2.5 flex-wrap justify-center">
          <span className="px-3 py-1 text-[11px] font-mono bg-accent/10 text-accent-hover border border-accent/20 rounded-lg">
            6 Katmanlı Tespit
          </span>
          <span className="px-3 py-1 text-[11px] font-mono bg-secondary/10 text-secondary-hover border border-secondary/20 rounded-lg">
            Computed CSS Tokens
          </span>
          <span className="px-3 py-1 text-[11px] font-mono bg-success/10 text-success-hover border border-success/20 rounded-lg">
            XML Sitemap Desteği
          </span>
          <span className="px-3 py-1 text-[11px] font-mono bg-warning/10 text-warning-hover border border-warning/20 rounded-lg">
            Offline Klonlama
          </span>
        </div>
      </div>
    );
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
    } catch (e: any) {
      toast.error(`Dışa aktarma hatası: ${e.message}`);
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
    } catch (e: any) {
      toast.error(`Kopyalama hatası: ${e.message}`);
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
          aria-label={`Teknoloji Yığını sekmesine git — ${technologies.length} teknoloji tespit edildi`}
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

      {/* 3. İki Sütunlu Detay Kartları */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* Güvenlik Detayları */}
        <div className="bg-surface-2 border border-white/[0.07] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-text-primary uppercase tracking-wider">
              <Shield size={15} className="text-success-hover" />
              <span>Güvenlik & Protokol Durumu</span>
            </div>
            <span className="text-[10px] text-text-dim font-mono">Header Analizi</span>
          </div>

          <div className="space-y-2.5 text-xs font-mono">
            <div className="flex justify-between items-center py-2 px-3 bg-overlay rounded-xl border border-white/[0.04]">
              <span className="text-text-secondary">HTTPS Şifreleme:</span>
              <span className={`flex items-center gap-1 font-bold ${security?.https ? 'text-success-hover' : 'text-error-hover'}`}>
                {security?.https ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                {security?.https ? 'Aktif' : 'Pasif'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 px-3 bg-overlay rounded-xl border border-white/[0.04]">
              <span className="text-text-secondary">HSTS Politikası:</span>
              <span className={`flex items-center gap-1 font-bold ${security?.hsts ? 'text-success-hover' : 'text-text-dim'}`}>
                {security?.hsts ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                {security?.hsts ? 'Tanımlı' : 'Yok'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 px-3 bg-overlay rounded-xl border border-white/[0.04]">
              <span className="text-text-secondary">Content-Security-Policy (CSP):</span>
              <span className={`flex items-center gap-1 font-bold ${security?.csp ? 'text-success-hover' : 'text-text-dim'}`}>
                {security?.csp ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                {security?.csp ? 'Tanımlı' : 'Yok'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 px-3 bg-overlay rounded-xl border border-white/[0.04]">
              <span className="text-text-secondary">robots.txt Dosyası:</span>
              <span className={`flex items-center gap-1 font-bold ${security?.robotsTxt ? 'text-success-hover' : 'text-text-dim'}`}>
                {security?.robotsTxt ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                {security?.robotsTxt ? 'Mevcut' : 'Yok'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 px-3 bg-overlay rounded-xl border border-white/[0.04]">
              <span className="text-text-secondary">sitemap.xml Dosyası:</span>
              <span className={`flex items-center gap-1 font-bold ${security?.sitemap ? 'text-success-hover' : 'text-text-dim'}`}>
                {security?.sitemap ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                {security?.sitemap ? 'Mevcut' : 'Yok'}
              </span>
            </div>
          </div>
        </div>

        {/* Renk Paleti Detayı */}
        <div className="bg-surface-2 border border-white/[0.07] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-text-primary uppercase tracking-wider">
              <Palette size={15} className="text-warning-hover" />
              <span>Tasarım Renk Paleti</span>
            </div>
            <button
              onClick={copyAllTokensAsCss}
              title="Tüm renkleri :root CSS formatında panoya kopyala"
              className="text-[10px] text-accent-hover hover:underline font-mono cursor-pointer"
            >
              CSS Değişkeni Olarak Kopyala
            </button>
          </div>

          <div className="grid grid-cols-5 gap-2.5 pt-1">
            {(designTokens?.colors?.slice(0, 10) || []).map((color, i) => (
              <button
                key={i}
                type="button"
                onClick={() => copyToClipboard(color.hex)}
                aria-label={`${color.hex} (${color.role || 'renk'}) rengini panoya kopyala`}
                className="group relative flex flex-col items-center cursor-pointer p-2 bg-overlay hover:bg-surface-3 border border-white/[0.05] rounded-xl transition-all hover:scale-105"
                title={`${color.hex} (${color.role || 'renk'})`}
              >
                <div
                  className="w-full h-8 rounded-lg border border-white/[0.1] shadow-inner mb-1.5"
                  style={{ backgroundColor: color.hex }}
                />
                <span className="text-[10px] font-mono text-text-secondary group-hover:text-accent-hover truncate w-full text-center">
                  {color.hex}
                </span>
                <span className="text-[9px] text-text-dim uppercase font-mono">
                  {color.role}
                </span>
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* 4. Tipografi Skalası */}
      <div className="bg-surface-2 border border-white/[0.07] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-text-primary uppercase tracking-wider">
            <Type size={15} className="text-secondary-hover" />
            <span>Tipografi Skalası & Font Aileleri</span>
          </div>
          <span className="text-[10px] text-text-dim font-mono">Computed Typography</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
          {(designTokens?.typography || []).map((typo, i) => (
            <div key={i} className="flex items-center justify-between p-3.5 bg-overlay border border-white/[0.05] rounded-xl">
              <div className="min-w-0 flex-1 pr-3">
                <span className="text-[9px] uppercase font-mono font-bold text-secondary-hover tracking-wider block mb-0.5">
                  {typo.role}
                </span>
                <span className="text-sm font-semibold text-text-primary truncate block" style={{ fontFamily: typo.fontFamily }}>
                  {typo.fontFamily}
                </span>
              </div>
              <div className="text-right font-mono text-[11px] text-text-muted flex-shrink-0">
                <div className="text-accent-hover font-semibold">{typo.fontSize} / {typo.lineHeight}</div>
                <div className="text-text-dim text-[10px]">Ağırlık: {typo.fontWeight}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
