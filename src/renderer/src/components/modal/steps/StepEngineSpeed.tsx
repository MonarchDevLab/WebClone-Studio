import React from 'react';
import { Shield } from 'lucide-react';
import { CloneSettings } from '@shared/types';

interface StepEngineSpeedProps {
  url: string;
  settings: CloneSettings;
  setSettings: React.Dispatch<React.SetStateAction<CloneSettings>>;
  authCookieCount: number;
  isAuthOpening: boolean;
  onOpenAuthSession: () => void;
}

export const StepEngineSpeed: React.FC<StepEngineSpeedProps> = ({
  url,
  settings,
  setSettings,
  authCookieCount,
  isAuthOpening,
  onOpenAuthSession,
}) => {
  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <div>
        <label className="block text-xs font-semibold text-text-primary uppercase tracking-wider mb-2">
          Klonlama Motoru Modu
        </label>
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Klonlama motoru modu">
          <div
            role="radio"
            tabIndex={0}
            aria-checked={settings.mode === 'static'}
            onClick={() => setSettings({ ...settings, mode: 'static' })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSettings({ ...settings, mode: 'static' });
              }
            }}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              settings.mode === 'static'
                ? 'bg-accent/20 border-accent/50 text-text-primary shadow-sm'
                : 'bg-surface-2 border-white/[0.06] text-text-muted hover:border-white/[0.12]'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-text-primary">Statik Mod (Ultra Hızlı)</span>
              <span className="text-[9px] font-mono bg-accent/20 text-accent-hover border border-accent/30 px-1.5 py-0.5 rounded">
                session.fetch
              </span>
            </div>
            <p className="text-[11px] text-text-dim leading-relaxed">
              Klasik siteler ve SSR için idealdir. JS çalıştırmadan BoringSSL TLS parmak izi ile doğrudan HTML/CSS ayrıştırır.
            </p>
          </div>

          <div
            role="radio"
            tabIndex={0}
            aria-checked={settings.mode === 'dynamic'}
            onClick={() => setSettings({ ...settings, mode: 'dynamic' })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSettings({ ...settings, mode: 'dynamic' });
              }
            }}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              settings.mode === 'dynamic'
                ? 'bg-secondary/20 border-secondary/50 text-text-primary shadow-sm'
                : 'bg-surface-2 border-white/[0.06] text-text-muted hover:border-white/[0.12]'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-text-primary">Dinamik Mod (SPA)</span>
              <span className="text-[9px] font-mono bg-secondary/20 text-secondary-hover border border-secondary/30 px-1.5 py-0.5 rounded">
                Yerleşik Chromium
              </span>
            </div>
            <p className="text-[11px] text-text-dim leading-relaxed">
              React, Vue, Next.js gibi istemci tarafında render edilen modern SPA siteler için DOM ve Shadow DOM çalıştırır.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface-2 border border-white/[0.06] rounded-xl p-3.5">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs font-medium text-text-secondary">Tarama Derinliği (Depth):</span>
            <span className="font-mono text-accent-hover font-bold text-xs">{settings.maxDepth}</span>
          </div>
          <input
            type="range"
            min={1}
            max={5}
            value={settings.maxDepth}
            onChange={(e) => setSettings({ ...settings, maxDepth: Number(e.target.value) })}
            className="w-full accent-accent-hover"
          />
          <span className="text-[10px] text-text-dim block mt-1 font-mono">
            1 = tek sayfa, 3 = dengeli ağaç
          </span>
        </div>

        <div className="bg-surface-2 border border-white/[0.06] rounded-xl p-3.5">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs font-medium text-text-secondary">Eşzamanlı Havuz (Threads):</span>
            <span className="font-mono text-success-hover font-bold text-xs">
              {settings.concurrentDownloads}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={15}
            value={settings.concurrentDownloads}
            onChange={(e) =>
              setSettings({ ...settings, concurrentDownloads: Number(e.target.value) })
            }
            className="w-full accent-success-hover"
          />
          <span className="text-[10px] text-text-dim block mt-1 font-mono">
            Aynı anda havuzda çalışan indirme
          </span>
        </div>
      </div>

      <div className="bg-surface-2 border border-white/[0.08] rounded-xl p-3.5 flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
            <Shield size={14} className="text-accent-hover" />
            <span>Kilitli İçerik / Oturum Aç (Auth Session)</span>
            {authCookieCount > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-success/20 text-success-hover border border-success/30 rounded-full">
                {authCookieCount} Çerez Aktif
              </span>
            )}
          </div>
          <p className="text-[11px] text-text-dim leading-relaxed">
            Giriş gerektiren panel veya korumalı sayfalar için yerleşik oturum penceresinde giriş yapıp kapatın; çerezler otomatik devralınır.
          </p>
        </div>
        <button
          type="button"
          disabled={!url || isAuthOpening}
          onClick={onOpenAuthSession}
          className="px-3.5 py-2 bg-surface-3 hover:bg-white/[0.08] disabled:opacity-50 border border-white/[0.12] rounded-lg text-xs font-mono font-semibold text-accent-hover transition-all flex-shrink-0 cursor-pointer"
        >
          {isAuthOpening
            ? 'Oturum Açık...'
            : authCookieCount > 0
              ? 'Oturumu Yenile'
              : 'Tarayıcıda Giriş Yap'}
        </button>
      </div>

      <div className="space-y-2.5 pt-2 border-t border-white/[0.06]">
        <label className="flex items-center gap-2.5 text-xs text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={settings.respectRobotsTxt}
            onChange={(e) => setSettings({ ...settings, respectRobotsTxt: e.target.checked })}
            className="rounded accent-accent-hover"
          />
          <span>robots.txt kurallarına uy (Etik crawling motoru)</span>
        </label>

        <label className="flex items-center gap-2.5 text-xs text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={settings.downloadExternalAssets}
            onChange={(e) => setSettings({ ...settings, downloadExternalAssets: e.target.checked })}
            className="rounded accent-accent-hover"
          />
          <span>Harici domain varlıklarını indir (CDN, Google Fonts, jsDelivr, font dosyaları)</span>
        </label>

        <label className="flex items-center gap-2.5 text-xs text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={settings.crawlSubdomains}
            onChange={(e) => setSettings({ ...settings, crawlSubdomains: e.target.checked })}
            className="rounded accent-accent-hover"
          />
          <span>Alt alan adlarını (subdomain) sayfa olarak tara</span>
        </label>

        <label className="flex items-center gap-2.5 text-xs text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(settings.ignoreSslErrors)}
            onChange={(e) => setSettings({ ...settings, ignoreSslErrors: e.target.checked })}
            className="rounded accent-warning-hover"
          />
          <span>Kendinden imzalı TLS/SSL sertifikalarına izin ver (Yalnızca güvenilen yerel/test hedeflerinde)</span>
        </label>
      </div>
    </div>
  );
};
