import { create } from 'zustand';
import { ProjectInfo } from '@shared/types';

interface ProjectState {
  projects: ProjectInfo[];
  activeProjectId: string | null;
  isLoading: boolean;
  
  fetchProjects: () => Promise<void>;
  openProject: (projectPath: string) => Promise<boolean>;
  deleteProject: (projectPath: string) => Promise<boolean>;
  setActiveProject: (id: string) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  isLoading: false,

  fetchProjects: async () => {
    if (window.electronAPI?.listProjects) {
      set({ isLoading: true });
      try {
        const list = await window.electronAPI.listProjects();
        set({ projects: list || [], isLoading: false });
      } catch (err) {
        console.error('Proje listesi yüklenemedi:', err);
        set({ isLoading: false });
      }
    }
  },

  openProject: async (projectPath: string) => {
    if (window.electronAPI?.openProject) {
      try {
        const success = await window.electronAPI.openProject(projectPath);
        return success;
      } catch (err) {
        console.error('Proje açılamadı:', err);
        return false;
      }
    }
    return false;
  },

  deleteProject: async (projectPath: string) => {
    if (window.electronAPI?.deleteProject) {
      try {
        const success = await window.electronAPI.deleteProject(projectPath);
        if (success) {
          await get().fetchProjects();
        }
        return success;
      } catch (err) {
        console.error('Proje silinemedi:', err);
        return false;
      }
    }
    return false;
  },

  setActiveProject: (id: string) => set({ activeProjectId: id }),
}));
