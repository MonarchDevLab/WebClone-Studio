import React from 'react';
import { Archive, Cpu } from 'lucide-react';
import { CloneSettings } from '@shared/types';

interface StepFiltersProps {
  settings: CloneSettings;
  setSettings: React.Dispatch<React.SetStateAction<CloneSettings>>;
  excludePatternText: string;
  setExcludePatternText: (val: string) => void;
  includePatternText: string;
  setIncludePatternText: (val: string) => void;
}

export const StepFilters: React.FC<StepFiltersProps> = ({
  settings,
  setSettings,
  excludePatternText,
  setExcludePatternText,
  includePatternText,
  setIncludePatternText,
}) => {
  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <div>
        <label className="block text-xs font-semibold text-text-primary uppercase tracking-wider mb-2">
          İndirilecek Varlık Türleri
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { key: 'downloadImages', label: 'Resimler', desc: 'png, jpg, webp, svg, gif, ico, avif', state: settings.downloadImages },
            { key: 'downloadFonts', label: 'Fontlar', desc: 'woff2, woff, ttf, otf, eot', state: settings.downloadFonts },
            { key: 'downloadMedia', label: 'Medya (Video & Ses)', desc: 'mp4, webm, mp3, wav, ogg, vtt', state: settings.downloadMedia },
            { key: 'downloadDocuments', label: 'Belgeler & Ofis', desc: 'pdf, docx, xlsx, pptx, csv, txt', state: settings.downloadDocuments },
            { key: 'downloadArchives', label: 'Arşivler & Zip', desc: 'zip, rar, 7z, tar, gz, dmg, iso', state: settings.downloadArchives },
            { key: 'downloadData', label: 'Veri Dosyaları', desc: 'json, xml, yaml, toml, wasm', state: settings.downloadData },
          ].map((item) => (
            <label
              key={item.key}
              className={`flex items-start gap-2.5 p-3 border rounded-xl text-xs cursor-pointer transition-all ${
                item.state
                  ? 'bg-accent/20 border-accent/40 text-text-primary shadow-sm'
                  : 'bg-surface-2 border-white/[0.06] text-text-muted hover:border-white/[0.12]'
              }`}
            >
              <input
                type="checkbox"
                checked={item.state}
                onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
                className="rounded accent-accent-hover mt-0.5"
              />
              <div>
                <div className="font-semibold text-text-primary">{item.label}</div>
                <div className="text-[10px] text-text-dim font-mono mt-0.5">{item.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-text-primary uppercase tracking-wider mb-1.5">
          Hariç Tutulacak URL Desenleri (Virgülle ayırın)
        </label>
        <input
          type="text"
          value={excludePatternText}
          onChange={(e) => setExcludePatternText(e.target.value)}
          placeholder="/admin/*, /api/*, /cart, /login"
          className="w-full bg-surface-2 border border-white/[0.1] rounded-lg px-3.5 py-2 text-xs text-text-primary focus:outline-none focus:border-accent font-mono"
        />
        <span className="text-[10px] text-text-dim mt-1 block font-mono">
          Gereksiz sayfaların indirilmesini önler.
        </span>
      </div>

      <div>
        <label className="block text-xs font-semibold text-text-primary uppercase tracking-wider mb-1.5">
          Sadece Dahil Edilecek URL Desenleri (Opsiyonel)
        </label>
        <input
          type="text"
          value={includePatternText}
          onChange={(e) => setIncludePatternText(e.target.value)}
          placeholder="/blog/*, /docs/*, /urunler/*"
          className="w-full bg-surface-2 border border-white/[0.1] rounded-lg px-3.5 py-2 text-xs text-text-primary focus:outline-none focus:border-accent font-mono"
        />
      </div>

      <div className="pt-2 space-y-3">
        <label className="block text-xs font-semibold text-text-primary uppercase tracking-wider">
          Tersine Mühendislik ve Arşivleme
        </label>
        <label
          className={`flex items-start gap-3 p-3.5 border rounded-xl text-xs cursor-pointer transition-all ${
            settings.reverseEngineering
              ? 'bg-accent/20 border-accent/40 text-text-primary shadow-sm'
              : 'bg-surface-2 border-white/[0.06] text-text-muted hover:border-white/[0.12]'
          }`}
        >
          <input
            type="checkbox"
            checked={settings.reverseEngineering ?? true}
            onChange={(e) => setSettings({ ...settings, reverseEngineering: e.target.checked })}
            className="rounded accent-accent-hover mt-0.5"
          />
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-semibold text-text-primary">
              <Cpu size={14} className="text-accent-hover" />
              <span>Tersine Mühendislik Laboratuvarı (SourceMap, RSC, Token & API Mock)</span>
            </div>
            <div className="text-[11px] text-text-dim leading-relaxed">
              SourceMap ile kaynak ağacı, SSR/Next.js RSC state, Tailwind v4 @theme tokenları ve API uç noktalarını çıkarır.
            </div>
          </div>
        </label>

        <label
          className={`flex items-start gap-3 p-3.5 border rounded-xl text-xs cursor-pointer transition-all ${
            settings.exportWacz
              ? 'bg-secondary/20 border-secondary/40 text-text-primary shadow-sm'
              : 'bg-surface-2 border-white/[0.06] text-text-muted hover:border-white/[0.12]'
          }`}
        >
          <input
            type="checkbox"
            checked={Boolean(settings.exportWacz)}
            onChange={(e) => setSettings({ ...settings, exportWacz: e.target.checked })}
            className="rounded accent-secondary-hover mt-0.5"
          />
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-semibold text-text-primary">
              <Archive size={14} className="text-secondary-hover" />
              <span>Standart WACZ 1.1.1 Arşivi Oluştur (.wacz)</span>
            </div>
            <div className="text-[11px] text-text-dim leading-relaxed">
              Klonlama sonunda WARC/1.1, SURT CDXJ ve SHA-256 doğrulama özetini içeren taşınabilir web arşivi üretir.
            </div>
          </div>
        </label>
      </div>
    </div>
  );
};
