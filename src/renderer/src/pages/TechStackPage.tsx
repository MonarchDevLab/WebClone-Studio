import React, { useState, useMemo } from 'react';
import { Search, Layers, ShieldCheck, Tag, Loader2 } from 'lucide-react';
import { useAnalyzeStore } from '../stores/analyze-store';

export const TechStackPage: React.FC = () => {
  const { analyzeResult, isAnalyzing } = useAnalyzeStore();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  if (isAnalyzing) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[460px] text-center p-8 text-text-muted animate-in fade-in duration-200">
        <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-accent/30 flex items-center justify-center mb-3 text-accent-hover shadow-lg shadow-accent/10">
          <Loader2 size={28} className="animate-spin text-accent-hover" />
        </div>
        <h3 className="text-base font-bold text-text-primary mb-1">Teknolojiler Taranıyor</h3>
        <p className="text-xs text-text-muted max-w-sm font-mono">
          Hedef sitenin script, meta ve ağ yanıt imzaları çözümleniyor...
        </p>
      </div>
    );
  }

  if (!analyzeResult || !analyzeResult.technologies || analyzeResult.technologies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[460px] text-center p-8 text-text-muted">
        <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-white/[0.08] flex items-center justify-center mb-3 text-accent-hover">
          <Layers size={28} />
        </div>
        <h3 className="text-base font-bold text-text-primary mb-1">Teknoloji Verisi Bulunamadı</h3>
        <p className="text-xs text-text-muted max-w-sm">
          Teknolojileri listelemek için lütfen yukarıdan bir web sitesi analizi başlatın.
        </p>
      </div>
    );
  }

  const { technologies } = analyzeResult;

  // Kategorileri topla (memoized)
  const categories = useMemo(() => {
    return ['ALL', ...Array.from(new Set(technologies.map(t => t.category)))];
  }, [technologies]);

  // Filtreleme (memoized)
  const filtered = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return technologies.filter(tech => {
      const matchesSearch = tech.name.toLowerCase().includes(query) ||
                            tech.category.toLowerCase().includes(query);
      const matchesCat = selectedCategory === 'ALL' || tech.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [technologies, searchQuery, selectedCategory]);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto animate-in fade-in duration-200">
      
      {/* Üst Bar: Arama & Kategori Hapları */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-surface-2 border border-white/[0.07] rounded-2xl p-4 shadow-lg">
        
        {/* Arama Input */}
        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Teknoloji veya kategori ara"
            placeholder="Teknoloji veya kategori ara (örn: React)..."
            className="w-full bg-surface-3 border border-white/[0.08] rounded-xl pl-9 pr-3.5 py-2 text-xs text-text-primary focus:outline-none focus:border-accent/70 font-mono placeholder:text-text-dim"
          />
        </div>

        {/* Kategori Filtre Butonları */}
        <div className="flex flex-wrap gap-1.5">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                selectedCategory === cat
                  ? 'bg-accent text-black font-bold shadow-md shadow-accent/20'
                  : 'bg-surface-3 text-text-muted hover:bg-white/[0.08] hover:border-white/[0.16] hover:text-text-secondary border border-white/[0.06]'
              }`}
            >
              {cat === 'ALL' ? 'Tümü' : cat}
            </button>
          ))}
        </div>

      </div>

      {/* Teknoloji Kartları Grid (Command Center Style) */}
      {filtered.length === 0 ? (
        <div className="bg-surface-2 border border-white/[0.07] rounded-2xl p-12 text-center text-text-muted space-y-2">
          <Layers size={32} className="mx-auto text-text-dim mb-2 opacity-50" />
          <div className="text-sm font-semibold text-text-primary">Eşleşen Teknoloji Bulunamadı</div>
          <div className="text-xs text-text-dim">Arama filtrenizi temizleyerek veya farklı bir kategori seçerek tekrar deneyin.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(tech => (
            <div 
              key={tech.name}
              className="bg-surface-2 border border-white/[0.07] hover:border-accent/30 rounded-2xl p-4.5 space-y-3.5 transition-all hover:shadow-xl relative overflow-hidden group"
            >
            {/* Kart Üst */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-text-primary group-hover:text-accent-hover transition-colors">
                  {tech.name}
                </h3>
                <span className="text-[11px] font-mono text-secondary-hover">{tech.category}</span>
              </div>
              <div className="flex items-center gap-1 bg-accent/40 border border-accent/30 text-accent-hover px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold">
                <ShieldCheck size={13} />
                <span>%{tech.confidence}</span>
              </div>
            </div>

            {/* Sürüm (Varsa) */}
            {tech.version && (
              <div className="text-xs text-text-secondary flex items-center gap-2 bg-surface-3 p-2 rounded-lg border border-white/[0.04]">
                <span className="text-text-dim text-[11px] font-mono">Tespit Edilen Sürüm:</span>
                <span className="font-mono font-bold bg-success/40 text-success-hover border border-success/30 px-1.5 py-0.5 rounded text-[11px]">
                  v{tech.version}
                </span>
              </div>
            )}

            {/* Eşleşen İmzalar / Sinyaller */}
            <div>
              <span className="text-[10px] uppercase font-mono font-bold text-text-dim tracking-wider block mb-1.5">
                Eşleşen Sinyaller ({tech.signals?.length || 0})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(tech.signals || []).map((sig, i) => (
                  <span 
                    key={i}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-3 text-[10px] text-text-secondary rounded-md border border-white/[0.06] font-mono"
                  >
                    <Tag size={10} className="text-accent-hover" />
                    <span>{sig}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Glowing dot */}
            <div className="absolute bottom-2 right-2 w-1.5 h-1.5 rounded-full bg-accent-hover opacity-60" />
          </div>
        ))}
      </div>
      )}

    </div>
  );
};
