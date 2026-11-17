import React from 'react';
import { CheckCircle2, Palette, Shield, Type, XCircle } from 'lucide-react';
import { DesignTokens, SecurityInfo } from '@shared/types';

interface OverviewSecurityPaletteSectionProps {
  security?: SecurityInfo;
  designTokens?: DesignTokens;
  onCopyHex: (hex: string) => void;
  onCopyAllTokens: () => void;
}

export const OverviewSecurityPaletteSection: React.FC<OverviewSecurityPaletteSectionProps> = ({
  security,
  designTokens,
  onCopyHex,
  onCopyAllTokens,
}) => {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-surface-2 border border-white/[0.07] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-text-primary uppercase tracking-wider">
              <Shield size={15} className="text-success-hover" />
              <span>Güvenlik & Protokol Durumu</span>
            </div>
            <span className="text-[10px] text-text-dim font-mono">Header Analizi</span>
          </div>

          <div className="space-y-2.5 text-xs font-mono">
            {[
              { label: 'HTTPS Şifreleme:', ok: Boolean(security?.https), activeText: 'Aktif', emptyText: 'Pasif', isErrorWhenOff: true },
              { label: 'HSTS Politikası:', ok: Boolean(security?.hsts), activeText: 'Tanımlı', emptyText: 'Yok' },
              { label: 'Content-Security-Policy (CSP):', ok: Boolean(security?.csp), activeText: 'Tanımlı', emptyText: 'Yok' },
              { label: 'robots.txt Dosyası:', ok: Boolean(security?.robotsTxt), activeText: 'Mevcut', emptyText: 'Yok' },
              { label: 'sitemap.xml Dosyası:', ok: Boolean(security?.sitemap), activeText: 'Mevcut', emptyText: 'Yok' },
            ].map((row) => (
              <div
                key={row.label}
                className="flex justify-between items-center py-2 px-3 bg-overlay rounded-xl border border-white/[0.04]"
              >
                <span className="text-text-secondary">{row.label}</span>
                <span
                  className={`flex items-center gap-1 font-bold ${
                    row.ok
                      ? 'text-success-hover'
                      : row.isErrorWhenOff
                        ? 'text-error-hover'
                        : 'text-text-dim'
                  }`}
                >
                  {row.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  {row.ok ? row.activeText : row.emptyText}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface-2 border border-white/[0.07] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-text-primary uppercase tracking-wider">
              <Palette size={15} className="text-warning-hover" />
              <span>Tasarım Renk Paleti</span>
            </div>
            <button
              type="button"
              onClick={onCopyAllTokens}
              title="Tüm renkleri :root CSS formatında panoya kopyala"
              className="text-[10px] text-accent-hover hover:underline font-mono cursor-pointer"
            >
              CSS Değişkeni Olarak Kopyala
            </button>
          </div>

          <div className="grid grid-cols-5 gap-2.5 pt-1">
            {(designTokens?.colors?.slice(0, 10) || []).map((color, i) => (
              <button
                key={`${color.hex}-${i}`}
                type="button"
                onClick={() => onCopyHex(color.hex)}
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
            <div
              key={`${typo.fontFamily}-${i}`}
              className="flex items-center justify-between p-3.5 bg-overlay border border-white/[0.05] rounded-xl"
            >
              <div className="min-w-0 flex-1 pr-3">
                <span className="text-[9px] uppercase font-mono font-bold text-secondary-hover tracking-wider block mb-0.5">
                  {typo.role}
                </span>
                <span
                  className="text-sm font-semibold text-text-primary truncate block"
                  style={{ fontFamily: typo.fontFamily }}
                >
                  {typo.fontFamily}
                </span>
              </div>
              <div className="text-right font-mono text-[11px] text-text-muted flex-shrink-0">
                <div className="text-accent-hover font-semibold">
                  {typo.fontSize} / {typo.lineHeight}
                </div>
                <div className="text-text-dim text-[10px]">Ağırlık: {typo.fontWeight}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
