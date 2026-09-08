import React, { useState } from 'react';
import { GitFork, ChevronRight, ChevronDown, FileCode, Loader2 } from 'lucide-react';
import { useAnalyzeStore } from '../stores/analyze-store';
import { SiteMapNode } from '@shared/types';
import { formatBytes } from '../lib/utils';

interface TreeNodeProps {
  node: SiteMapNode;
  level?: number;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, level = 0 }) => {
  // Derin dallar varsayılan olarak kapalı tutulur (DOM freeze engeli)
  const [isExpanded, setIsExpanded] = useState<boolean>(level < 2);
  const hasChildren = node.children && node.children.length > 0;

  const toggle = () => hasChildren && setIsExpanded(!isExpanded);

  return (
    <div className="select-none text-xs">
      <div
        role={hasChildren ? 'button' : undefined}
        tabIndex={hasChildren ? 0 : undefined}
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-label={hasChildren ? `${node.url} — ${isExpanded ? 'daralt' : 'genişlet'}` : undefined}
        className={`flex items-center gap-2.5 py-1.5 px-3 rounded-lg hover:bg-surface-3 group transition-colors ${hasChildren ? 'cursor-pointer' : ''}`}
        style={{ paddingLeft: `${level * 20 + 12}px` }}
        onClick={toggle}
        onKeyDown={(e) => {
          if (hasChildren && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            toggle();
          }
        }}
      >
        {hasChildren ? (
          <span className="text-text-dim group-hover:text-accent-hover p-0.5" aria-hidden="true">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        ) : (
          <span className="w-4" />
        )}

        <FileCode size={14} className="text-accent-hover flex-shrink-0" />
        
        <span className="text-text-primary font-mono truncate max-w-lg group-hover:text-accent-hover">
          {node.url}
        </span>

        {node.statusCode !== undefined && (
          <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
            node.statusCode === 200 
              ? 'bg-success/40 text-success-hover border border-success/30' 
              : 'bg-warning/40 text-warning-hover border border-warning/30'
          }`}>
            {node.statusCode}
          </span>
        )}

        {node.size !== undefined && node.size > 0 && (
          <span className="text-[10px] text-text-dim font-mono">
            {formatBytes(node.size)}
          </span>
        )}

        {node.depth !== undefined && (
          <span className="text-[10px] text-text-dim font-mono bg-overlay px-1.5 py-0.5 rounded border border-white/[0.04]">
            d:{node.depth}
          </span>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div className="border-l border-white/[0.06] ml-6 my-0.5">
          {node.children.map((child) => (
            <TreeNode key={child.url} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export const SiteMapPage: React.FC = () => {
  const { analyzeResult, isAnalyzing } = useAnalyzeStore();

  if (isAnalyzing) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[460px] text-center p-8 text-text-muted animate-in fade-in duration-200">
        <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-accent/30 flex items-center justify-center mb-3 text-accent-hover shadow-lg shadow-accent/10">
          <Loader2 size={28} className="animate-spin text-accent-hover" />
        </div>
        <h3 className="text-base font-bold text-text-primary mb-1">Site Haritası Çıkarılıyor</h3>
        <p className="text-xs text-text-muted max-w-sm font-mono">
          İç bağlantılar ve dizin hiyerarşisi taranıyor...
        </p>
      </div>
    );
  }

  if (!analyzeResult || !analyzeResult.siteMap) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[460px] text-center p-8 text-text-muted">
        <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-white/[0.08] flex items-center justify-center mb-3 text-accent-hover">
          <GitFork size={28} />
        </div>
        <h3 className="text-base font-bold text-text-primary mb-1">Site Haritası Çıkarılmadı</h3>
        <p className="text-xs text-text-muted max-w-sm">
          Sayfa ağacını görüntülemek için lütfen yukarıdaki çubuktan bir web sitesi analizi başlatın.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto flex flex-col h-full min-h-0 animate-in fade-in duration-200">
      <div className="flex items-center justify-between bg-surface-2 border border-white/[0.07] rounded-2xl p-4 shadow-lg flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-accent/10 text-accent-hover border border-accent/20 rounded-xl">
            <GitFork size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-text-primary">Site Haritası & Sayfa Ağacı</h2>
            <p className="text-xs text-text-muted">Hedef sitede keşfedilen bağlantı hiyerarşisi</p>
          </div>
        </div>
      </div>

      <div className="bg-surface-2 border border-white/[0.07] rounded-2xl p-4 overflow-auto flex-1 min-h-0 shadow-xl">
        <TreeNode node={analyzeResult.siteMap} />
      </div>
    </div>
  );
};
