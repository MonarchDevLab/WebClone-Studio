import { create } from 'zustand';

export type TabType = 'overview' | 'tech' | 'sitemap' | 'clone' | 'settings';

interface UiState {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  
  isBottomPanelOpen: boolean;
  toggleBottomPanel: () => void;
  
  isCommandPaletteOpen: boolean;
  toggleCommandPalette: () => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;

  isCloneModalOpen: boolean;
  openCloneModal: () => void;
  closeCloneModal: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeTab: 'overview',
  setActiveTab: (tab) => set({ activeTab: tab }),
  
  isBottomPanelOpen: true,
  toggleBottomPanel: () => set((state) => ({ isBottomPanelOpen: !state.isBottomPanelOpen })),
  
  isCommandPaletteOpen: false,
  toggleCommandPalette: () => set((state) => ({ isCommandPaletteOpen: !state.isCommandPaletteOpen })),
  openCommandPalette: () => set({ isCommandPaletteOpen: true }),
  closeCommandPalette: () => set({ isCommandPaletteOpen: false }),

  isCloneModalOpen: false,
  openCloneModal: () => set({ isCloneModalOpen: true }),
  closeCloneModal: () => set({ isCloneModalOpen: false }),
}));
