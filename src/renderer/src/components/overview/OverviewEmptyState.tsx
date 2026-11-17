import React from 'react';
import { Globe, Zap } from 'lucide-react';

const DEMO_SITES = [
  { name: 'React.dev', url: 'https://react.dev', desc: 'Modern React Docs' },
  { name: 'Tailwind CSS', url: 'https://tailwindcss.com', desc: 'Tasarım Sistemi & Utility' },
  { name: 'Vite', url: 'https://vite.dev', desc: 'Frontend Build Motoru' },
  { name: 'GitHub', url: 'https://github.com', desc: 'Platform Mimarisi' },
];

interface OverviewEmptyStateProps {
  onSelectDemo: (url: string) => void;
}

export const OverviewEmptyState: React.FC<OverviewEmptyStateProps> = ({ onSelectDemo }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-center p-8 animate-in fade-in duration-300">
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

      <div className="w-full max-w-lg mb-8">
        <div className="text-[10px] uppercase font-mono text-text-dim tracking-wider mb-2.5">
          Örnek Sitelerle Hemen Test Edin
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {DEMO_SITES.map((demo) => (
            <button
              key={demo.url}
              type="button"
              onClick={() => onSelectDemo(demo.url)}
              className="flex flex-col items-start p-3 bg-surface-2 hover:bg-surface-3 border border-white/[0.07] hover:border-accent/40 rounded-xl text-left transition-all cursor-pointer group shadow-sm active:scale-95"
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-xs font-bold text-text-primary group-hover:text-accent-hover transition-colors">
                  {demo.name}
                </span>
                <Zap
                  size={12}
                  className="text-accent-hover opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </div>
              <span className="text-[10px] text-text-dim font-mono truncate w-full">
                {demo.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2.5 flex-wrap justify-center">
        <span className="px-3 py-1 text-[11px] font-mono bg-accent/10 text-accent-hover border border-accent/20 rounded-lg">
          6 Katmanlı Tespit
        </span>
        <span className="px-3 py-1 text-[11px] font-mono bg-secondary/10 text-secondary-hover border border-secondary/20 rounded-lg">
          CSS Color 4 & @theme
        </span>
        <span className="px-3 py-1 text-[11px] font-mono bg-success/10 text-success-hover border border-success/20 rounded-lg">
          XML Sitemap Desteği
        </span>
        <span className="px-3 py-1 text-[11px] font-mono bg-warning/10 text-warning-hover border border-warning/20 rounded-lg">
          Offline Klonlama & WACZ
        </span>
      </div>
    </div>
  );
};
