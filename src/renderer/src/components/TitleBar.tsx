import React from 'react';
import { APP_NAME } from '../lib/constants';
import logoUrl from '../assets/logo.png';
import { useUiStore } from '../stores/ui-store';

export const TitleBar: React.FC = () => {
  const { toggleCommandPalette } = useUiStore();

  return (
    <div className="h-9 bg-canvas flex items-center justify-between px-4 absolute top-0 left-0 right-0 z-50 select-none drag-region">
      {/* Sol: Uygulama Adı ve Logo */}
      <div className="flex items-center gap-2">
        <img src={logoUrl} alt="Logo" className="w-5 h-5 rounded-md no-drag" />
        <div className="text-xs font-medium text-text-muted">
          {APP_NAME}
        </div>
      </div>
      
      {/* Sağ: Command Palette Kısayolu (Windows pencere butonları için pr-36 emniyet payı) */}
      <div className="flex items-center gap-2 no-drag pr-36">
        <button 
          onClick={toggleCommandPalette}
          title="Komut Paletini Aç (Ctrl+K)"
          className="flex items-center gap-1 bg-surface-2 hover:bg-surface-3 border border-border-subtle hover:border-accent/40 rounded px-2 py-0.5 text-[10px] text-text-dim hover:text-text-primary transition-all cursor-pointer active:scale-95"
        >
          <span className="font-mono">Ctrl</span>
          <span>+</span>
          <span className="font-mono">K</span>
        </button>
      </div>
    </div>
  );
};
