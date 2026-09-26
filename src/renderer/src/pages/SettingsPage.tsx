import React, { useState, useEffect } from 'react';
import { Settings, Save, Folder, Globe, Zap, Filter, Check } from 'lucide-react';
import { toast } from 'sonner';

export const SettingsPage: React.FC = () => {
  const [defaultDir, setDefaultDir] = useState<string>('');
  const [userAgent, setUserAgent] = useState<string>('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 WebCloneStudio/1.0');
  const [defaultThreads, setDefaultThreads] = useState<number>(5);
  const [defaultRateLimit, setDefaultRateLimit] = useState<number>(200);
  const [downloadImages, setDownloadImages] = useState<boolean>(true);
  const [downloadFonts, setDownloadFonts] = useState<boolean>(true);
  const [downloadMedia, setDownloadMedia] = useState<boolean>(true);
  const [downloadDocuments, setDownloadDocuments] = useState<boolean>(true);
  const [downloadArchives, setDownloadArchives] = useState<boolean>(true);
  const [downloadData, setDownloadData] = useState<boolean>(true);
  const [crawlSubdomains, setCrawlSubdomains] = useState<boolean>(false);
  const [downloadExternalAssets, setDownloadExternalAssets] = useState<boolean>(true);
  const [reverseEngineering, setReverseEngineering] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadSettings = async () => {
      if (window.electronAPI?.getSettings) {
        try {
          const s = await window.electronAPI.getSettings();
          if (s) {
            if (s.defaultOutputDir) setDefaultDir(s.defaultOutputDir);
            if (s.userAgent) setUserAgent(s.userAgent);
            if (s.defaultThreads) setDefaultThreads(s.defaultThreads);
            if (s.defaultRateLimit !== undefined) setDefaultRateLimit(s.defaultRateLimit);
            if (s.defaultDownloadImages !== undefined) setDownloadImages(s.defaultDownloadImages);
            if (s.defaultDownloadFonts !== undefined) setDownloadFonts(s.defaultDownloadFonts);
            if (s.defaultDownloadMedia !== undefined) setDownloadMedia(s.defaultDownloadMedia);
            if (s.defaultDownloadDocuments !== undefined) setDownloadDocuments(s.defaultDownloadDocuments);
            if (s.defaultDownloadArchives !== undefined) setDownloadArchives(s.defaultDownloadArchives);
            if (s.defaultDownloadData !== undefined) setDownloadData(s.defaultDownloadData);
            if (s.defaultCrawlSubdomains !== undefined) setCrawlSubdomains(s.defaultCrawlSubdomains);
            if (s.defaultDownloadExternalAssets !== undefined) setDownloadExternalAssets(s.defaultDownloadExternalAssets);
            if (s.defaultReverseEngineering !== undefined) setReverseEngineering(s.defaultReverseEngineering);
          }
        } catch (e) {
          console.error('Ayarlar yüklenemedi:', e);
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSelectDir = async () => {
    if (window.electronAPI?.selectDirectory) {
      const dir = await window.electronAPI.selectDirectory();
      if (dir) setDefaultDir(dir);
    }
  };

  const handleSave = async () => {
    if (window.electronAPI?.saveSettings) {
      try {
        await window.electronAPI.saveSettings({
          defaultOutputDir: defaultDir,
          userAgent,
          defaultThreads,
          defaultRateLimit,
          defaultDownloadImages: downloadImages,
          defaultDownloadFonts: downloadFonts,
          defaultDownloadMedia: downloadMedia,
          defaultDownloadDocuments: downloadDocuments,
          defaultDownloadArchives: downloadArchives,
          defaultDownloadData: downloadData,
          defaultCrawlSubdomains: crawlSubdomains,
          defaultDownloadExternalAssets: downloadExternalAssets,
          defaultReverseEngineering: reverseEngineering,
        });
        toast.success('Ayarlar başarıyla kaydedildi!');
      } catch (err: any) {
        toast.error(err.message || 'Ayarlar kaydedilemedi.');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-4xl mx-auto animate-pulse">
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/[0.05] rounded-xl" />
            <div className="space-y-1.5">
              <div className="w-36 h-4 bg-white/[0.06] rounded" />
              <div className="w-48 h-3 bg-white/[0.03] rounded" />
            </div>
          </div>
          <div className="w-28 h-8 bg-white/[0.05] rounded-lg" />
        </div>
        <div className="space-y-5">
          <div className="h-28 bg-surface-2 border border-white/[0.07] rounded-xl" />
          <div className="h-28 bg-surface-2 border border-white/[0.07] rounded-xl" />
          <div className="h-44 bg-surface-2 border border-white/[0.07] rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto animate-in fade-in duration-200">
      
      {/* Üst Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-white/[0.07]">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-secondary/10 text-secondary-hover border border-secondary/20 rounded-xl">
            <Settings size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-text-primary">Sistem & Motor Ayarları</h2>
              <span className="px-2 py-0.5 text-[10px] font-mono uppercase bg-success/40 text-success-hover border border-success/30 rounded-full">
                Kalıcı Yapılandırma
              </span>
            </div>
            <p className="text-xs text-text-muted">Klonlama motoru varsayılanları ve indirme tercihleri</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-success hover:bg-success-hover text-black rounded-lg text-xs font-bold transition-all shadow-lg shadow-success/20 active:scale-95 cursor-pointer"
        >
          <Save size={14} />
          <span>Ayarları Kaydet</span>
        </button>
      </div>

      <div className="space-y-5">
        
        {/* Varsayılan Klasör */}
        <div className="bg-surface-2 border border-white/[0.07] rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs font-semibold text-text-primary uppercase tracking-wider">
              <Folder size={15} className="text-accent-hover" />
              <span>Varsayılan İndirme Klasörü</span>
            </label>
            <span className="text-[10px] text-text-dim font-mono">Tüm yeni projeler buraya kaydedilir</span>
          </div>
          
          <div className="flex gap-2">
            <input
              type="text"
              value={defaultDir}
              onChange={(e) => setDefaultDir(e.target.value)}
              placeholder="Varsayılan: Downloads/WebClone"
              className="flex-1 bg-surface-3 border border-white/[0.1] rounded-lg px-3.5 py-2.5 text-xs text-text-primary focus:outline-none focus:border-accent font-mono"
            />
            <button
              onClick={handleSelectDir}
              className="px-4 py-2.5 bg-surface-3 hover:bg-white/[0.08] border border-white/[0.1] hover:border-white/[0.16] rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Folder size={14} />
              <span>Gözat</span>
            </button>
          </div>
        </div>

        {/* User Agent */}
        <div className="bg-surface-2 border border-white/[0.07] rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs font-semibold text-text-primary uppercase tracking-wider">
              <Globe size={15} className="text-secondary-hover" />
              <span>HTTP User-Agent Başlığı</span>
            </label>
            <span className="text-[10px] text-success-hover bg-success/40 border border-success/20 px-2 py-0.5 rounded-full font-mono">
              Anti-Bot Uyumlu
            </span>
          </div>

          <input
            type="text"
            value={userAgent}
            onChange={(e) => setUserAgent(e.target.value)}
            className="w-full bg-surface-3 border border-white/[0.1] rounded-lg px-3.5 py-2.5 text-xs text-text-primary focus:outline-none focus:border-secondary font-mono"
          />
          <p className="text-[11px] text-text-dim">
            Web sitelerinin bot engelleyicilerine takılmamak için gerçek bir modern tarayıcı kimliği gönderilir.
          </p>
        </div>

        {/* Performans & Hız */}
        <div className="bg-surface-2 border border-white/[0.07] rounded-xl p-5 space-y-4">
          <label className="flex items-center gap-2 text-xs font-semibold text-text-primary uppercase tracking-wider">
            <Zap size={15} className="text-warning-hover" />
            <span>Varsayılan Ağ & Hız Limitleri</span>
          </label>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-surface-3 border border-white/[0.05] rounded-lg p-3.5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-text-secondary">Eşzamanlı İndirme (Threads):</span>
                <span className="font-mono text-accent-hover text-xs font-bold">{defaultThreads} Bağlantı</span>
              </div>
              <input
                type="range"
                min={1}
                max={15}
                value={defaultThreads}
                onChange={(e) => setDefaultThreads(Number(e.target.value))}
                aria-label="Eşzamanlı İndirme Sayısı"
                className="w-full accent-accent-hover"
              />
              <span className="text-[10px] text-text-dim block mt-1">Aynı anda havuzda çalışan indirme sayısı (1 - 15)</span>
            </div>

            <div className="bg-surface-3 border border-white/[0.05] rounded-lg p-3.5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-text-secondary">İstekler Arası Bekleme (Rate Limit):</span>
                <span className="font-mono text-warning-hover text-xs font-bold">{defaultRateLimit} ms</span>
              </div>
              <input
                type="range"
                min={0}
                max={1000}
                step={50}
                value={defaultRateLimit}
                onChange={(e) => setDefaultRateLimit(Number(e.target.value))}
                aria-label="İstekler Arası Bekleme Gecikmesi"
                className="w-full accent-warning-hover"
              />
              <span className="text-[10px] text-text-dim block mt-1">Hedef sunucuya yapılan istekler arası minimum gecikme</span>
            </div>
          </div>
        </div>

        {/* Varsayılan Varlık & Klonlama Tercihleri */}
        <div className="bg-surface-2 border border-white/[0.07] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs font-semibold text-text-primary uppercase tracking-wider">
              <Filter size={15} className="text-accent-hover" />
              <span>Varsayılan Varlık & Klonlama Tercihleri</span>
            </label>
            <span className="text-[10px] text-text-dim font-mono">Tüm yeni klonlamalarda bu seçenekler önceden seçili gelir</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { label: 'Resimler', desc: 'png, jpg, webp, svg, gif, ico, avif', state: downloadImages, set: setDownloadImages },
              { label: 'Fontlar', desc: 'woff2, woff, ttf, otf, eot', state: downloadFonts, set: setDownloadFonts },
              { label: 'Medya', desc: 'mp4, webm, mp3, wav, ogg, mov', state: downloadMedia, set: setDownloadMedia },
              { label: 'Belgeler & Ofis', desc: 'pdf, docx, xlsx, pptx, csv, txt', state: downloadDocuments, set: setDownloadDocuments },
              { label: 'Arşivler & Zip', desc: 'zip, rar, 7z, tar, gz, dmg, iso', state: downloadArchives, set: setDownloadArchives },
              { label: 'Veri Dosyaları', desc: 'json, xml, yaml, toml, sql', state: downloadData, set: setDownloadData },
            ].map(item => (
              <label 
                key={item.label}
                className={`flex items-start gap-2.5 p-3 border rounded-xl text-xs cursor-pointer transition-all ${
                  item.state 
                    ? 'bg-accent/20 border-accent/40 text-text-primary shadow-sm' 
                    : 'bg-surface-3 border-white/[0.06] text-text-muted hover:border-white/[0.12]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={item.state}
                  onChange={(e) => item.set(e.target.checked)}
                  className="rounded accent-accent-hover mt-0.5"
                />
                <div>
                  <div className="font-semibold text-text-primary">{item.label}</div>
                  <div className="text-[10px] text-text-dim font-mono mt-0.5">{item.desc}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="pt-3 border-t border-white/[0.06] space-y-2">
            <label className="flex items-center gap-2.5 text-xs text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={downloadExternalAssets}
                onChange={(e) => setDownloadExternalAssets(e.target.checked)}
                className="rounded accent-accent-hover"
              />
              <span>Harici domain varlıklarını varsayılan olarak indir (CDN, Google Fonts, jsDelivr)</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={crawlSubdomains}
                onChange={(e) => setCrawlSubdomains(e.target.checked)}
                className="rounded accent-accent-hover"
              />
              <span>Alt alan adlarını (subdomain) varsayılan olarak tara (Kapalı tutulması kırık linkleri önler)</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={reverseEngineering}
                onChange={(e) => setReverseEngineering(e.target.checked)}
                className="rounded accent-accent-hover"
              />
              <span>Gelişmiş Tersine Mühendislik (Kaynak Kod Kurtarma, SPA State & Dinamik API Mock Yakalama)</span>
            </label>
          </div>
        </div>

        {/* Hakkında & Geliştirici Bilgisi */}
        <div className="bg-surface-2 border border-white/[0.07] rounded-xl p-5 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-text-primary tracking-wide">WebClone Studio v1.0.0</div>
            <div className="text-[11px] text-text-dim mt-0.5">Yüksek Başarımlı Mimari Tasarım & Web Klonlama Motoru</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold text-accent-hover">Monolith Works / MonarchDevLab</div>
            <div className="text-[10px] text-text-dim mt-0.5">Tüm Hakları Saklıdır © 2026</div>
          </div>
        </div>

      </div>

    </div>
  );
};
