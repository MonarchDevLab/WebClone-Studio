// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ArtifactExplorerPage } from '@/pages/ArtifactExplorerPage';
import { useProjectStore } from '@/stores/project-store';
import { ProjectArtifactSummary, ProjectInfo } from '@shared/types';

describe('ArtifactExplorerPage (6-Tab Inspector, WACZ Export & Incremental Diff)', () => {
  const sampleProject: ProjectInfo = {
    id: 'proj-1',
    name: 'example-site',
    slug: 'example-site',
    url: 'https://example.com',
    domain: 'example.com',
    createdAt: Date.now(),
    totalFiles: 14,
    totalSize: 512000,
    outputPath: 'E:/MockClones/example-site',
    hasIncompleteCheckpoint: true,
    hasWacz: false,
  };

  const sampleSummary: ProjectArtifactSummary = {
    projectDir: sampleProject.outputPath,
    projectName: 'example-site',
    sourceUrl: 'https://example.com',
    hasWacz: false,
    hasStandaloneHtml: true,
    standalonePath: '_exports/index.standalone.html',
    hasMhtml: true,
    hasSystemMap: true,
    canResume: true,
    openApiEndpointCount: 2,
    exportedComponents: ['PageSection01.tsx'],
    reconstructedSourceFiles: ['webpack/src/App.tsx'],
    adaptiveEntityGroups: 1,
    hasDesignTokensTheme: true,
    hasExtractedState: true,
  };

  beforeEach(() => {
    useProjectStore.setState({
      projects: [sampleProject],
      activeProjectId: null,
      selectedProject: null,
      activeArtifactSummary: null,
      isArtifactLoading: false,
    });

    window.electronAPI = {
      listProjects: vi.fn().mockResolvedValue([sampleProject]),
      getArtifactSummary: vi.fn().mockResolvedValue(sampleSummary),
      readProjectArtifact: vi.fn().mockResolvedValue({
        content: '@theme { --color-primary: oklch(0.65 0.15 240); }',
        mimeType: 'text/css',
        truncated: false,
        sizeBytes: 51,
      }),
      exportWacz: vi.fn().mockResolvedValue({
        filePath: 'E:/MockClones/example-site/_exports/example-site.wacz',
        sizeBytes: 8420,
        sha256: 'abc123def456',
      }),
      runIncrementalDiff: vi.fn().mockResolvedValue({
        projectDir: sampleProject.outputPath,
        comparedAt: new Date().toISOString(),
        added: 1,
        modified: 2,
        removed: 0,
        unchanged: 5,
        items: [
          { url: 'https://example.com/pricing', changeType: 'MODIFIED' },
        ],
      }),
      startPreviewServer: vi.fn().mockResolvedValue({ success: true, url: 'http://127.0.0.1:4444/' }),
      stopPreviewServer: vi.fn().mockResolvedValue({ success: true }),
      resumeIncompleteCrawl: vi.fn().mockResolvedValue(true),
      openProject: vi.fn().mockResolvedValue(true),
      openFolder: vi.fn().mockResolvedValue(true),
    } as any;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('hydrates project artifacts, switches across 6 sub-tabs, exports WACZ, and runs incremental diff', async () => {
    render(<ArtifactExplorerPage />);

    // Select project from empty-state cards
    const projectCard = screen.getByRole('button', { name: /example-site/i });
    fireEvent.click(projectCard);

    await waitFor(() => {
      expect(window.electronAPI?.getArtifactSummary).toHaveBeenCalledWith(sampleProject.outputPath);
      expect(screen.getByText('Yarım Kalan Klonlama Tespit Edildi (SQLite WAL Checkpoint)')).toBeInTheDocument();
    });

    // Switch to Tokenlar & Veri sub-tab and inspect readProjectArtifact output
    fireEvent.click(screen.getByRole('tab', { name: /Tokenlar & Veri/i }));
    await waitFor(() => {
      expect(window.electronAPI?.readProjectArtifact).toHaveBeenCalledWith(
        sampleProject.outputPath,
        '_meta/tokens.theme.css'
      );
      expect(screen.getByText(/oklch\(0\.65 0\.15 240\)/)).toBeInTheDocument();
    });

    // Switch to Arşiv & Fark and run WACZ export + incremental diff
    fireEvent.click(screen.getByRole('tab', { name: /Arşiv & Fark/i }));

    fireEvent.click(screen.getByRole('button', { name: /WACZ 1\.1\.1 Oluştur/i }));
    await waitFor(() => {
      expect(window.electronAPI?.exportWacz).toHaveBeenCalledWith(sampleProject.outputPath);
      expect(screen.getByText(/abc123def456/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Fark Analizini Çalıştır/i }));
    await waitFor(() => {
      expect(window.electronAPI?.runIncrementalDiff).toHaveBeenCalledWith(sampleProject.outputPath);
      expect(screen.getByText('https://example.com/pricing')).toBeInTheDocument();
      expect(screen.getByText('MODIFIED')).toBeInTheDocument();
    });
  });
});
