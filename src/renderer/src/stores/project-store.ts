import { create } from 'zustand';
import { ProjectArtifactSummary, ProjectInfo } from '@shared/types';

interface ProjectState {
  projects: ProjectInfo[];
  activeProjectId: string | null;
  selectedProject: ProjectInfo | null;
  activeArtifactSummary: ProjectArtifactSummary | null;
  isArtifactLoading: boolean;
  isLoading: boolean;

  fetchProjects: () => Promise<void>;
  openProject: (projectPath: string) => Promise<boolean>;
  deleteProject: (projectPath: string) => Promise<boolean>;
  setActiveProject: (id: string) => void;
  selectAndHydrateProject: (project: ProjectInfo) => Promise<void>;
  refreshActiveArtifacts: () => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  selectedProject: null,
  activeArtifactSummary: null,
  isArtifactLoading: false,
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
          const { selectedProject } = get();
          if (selectedProject?.outputPath === projectPath) {
            set({ activeProjectId: null, selectedProject: null, activeArtifactSummary: null });
          }
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

  selectAndHydrateProject: async (project: ProjectInfo) => {
    set({
      activeProjectId: project.id,
      selectedProject: project,
      isArtifactLoading: true,
    });

    if (window.electronAPI?.getArtifactSummary) {
      try {
        const summary = await window.electronAPI.getArtifactSummary(project.outputPath);
        if (get().activeProjectId === project.id) {
          set({ activeArtifactSummary: summary, isArtifactLoading: false });
        }
      } catch (err) {
        console.error('Artefakt özeti yüklenemedi:', err);
        if (get().activeProjectId === project.id) {
          set({ activeArtifactSummary: null, isArtifactLoading: false });
        }
      }
    } else {
      set({ isArtifactLoading: false });
    }
  },

  refreshActiveArtifacts: async () => {
    const current = get().selectedProject;
    if (!current) return;
    await get().selectAndHydrateProject(current);
  },
}));
