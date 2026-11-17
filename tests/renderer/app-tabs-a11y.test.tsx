// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest';
import React, { useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '@/App';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useCloneStore } from '@/stores/clone-store';
import { useUiStore } from '@/stores/ui-store';
import { StatusBar } from '@/components/StatusBar';

const FocusTrapHarness: React.FC = () => {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, dialogRef, () => setOpen(false));

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open Dialog
      </button>
      {open && (
        <div ref={dialogRef} role="dialog" aria-modal="true" tabIndex={-1}>
          <button type="button">First</button>
          <button type="button" onClick={() => setOpen(false)}>
            Last
          </button>
        </div>
      )}
    </div>
  );
};

describe('Phase 6 Renderer A11y, Lazy Tabs & Batched Telemetry', () => {
  beforeEach(() => {
    useUiStore.setState({ activeTab: 'overview', isCommandPaletteOpen: false, isCloneModalOpen: false });
    useCloneStore.getState().reset();
    window.electronAPI = {
      listProjects: vi.fn().mockResolvedValue([]),
      getSettings: vi.fn().mockResolvedValue({
        defaultOutputDir: '',
        userAgent: 'TestAgent',
        defaultThreads: 4,
        defaultRateLimit: 100,
      }),
      getAppVersion: vi.fn().mockResolvedValue('2.0.0'),
      onProgress: vi.fn().mockReturnValue(() => {}),
      onFileAdded: vi.fn().mockReturnValue(() => {}),
      onLog: vi.fn().mockReturnValue(() => {}),
      onComplete: vi.fn().mockReturnValue(() => {}),
      onError: vi.fn().mockReturnValue(() => {}),
    } as any;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('supports WCAG 2.2 AA WAI-ARIA tablist keyboard navigation across all 6 main tabs', async () => {
    render(<App />);

    const tablist = screen.getByRole('tablist', { name: /Ana Çalışma Sekmeleri/i });
    expect(tablist).toBeInTheDocument();

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(6);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

    tabs[0].focus();
    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });

    await waitFor(() => {
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
      expect(document.activeElement).toBe(tabs[1]);
    });

    fireEvent.keyDown(tabs[1], { key: 'End' });
    await waitFor(() => {
      expect(tabs[5]).toHaveAttribute('aria-selected', 'true');
      expect(document.activeElement).toBe(tabs[5]);
    });

    fireEvent.keyDown(tabs[5], { key: 'Home' });
    await waitFor(() => {
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('traps Tab/Shift+Tab inside dialogs and restores focus on Escape', async () => {
    render(<FocusTrapHarness />);
    const trigger = screen.getByRole('button', { name: 'Open Dialog' });
    trigger.focus();
    fireEvent.click(trigger);

    const firstBtn = await screen.findByRole('button', { name: 'First' });
    const lastBtn = await screen.findByRole('button', { name: 'Last' });

    await waitFor(() => {
      expect(document.activeElement).toBe(firstBtn);
    });

    lastBtn.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(firstBtn);

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(lastBtn);

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(document.activeElement).toBe(trigger);
    });
  });

  it('applies 100ms batched telemetry updates and shows warning counter in StatusBar', () => {
    useCloneStore.getState().applyTelemetryBatch({
      progress: {
        downloaded: 12,
        queued: 3,
        failed: 1,
        speed: 4096,
        activeUrl: 'https://example.com/app.js',
        eta: 5,
        bytesTransferred: 20480,
        totalEstimatedBytes: 40960,
      },
      addedFiles: [
        { path: 'index.html', size: 1200, mimeType: 'text/html', httpStatus: 200, depth: 0 },
      ],
      logs: [{ level: 'info', message: 'Saved index.html', timestamp: Date.now() }],
      warningCountDelta: 3,
    });

    const state = useCloneStore.getState();
    expect(state.files).toHaveLength(1);
    expect(state.logs).toHaveLength(1);
    expect(state.warningCount).toBe(3);

    render(<StatusBar />);
    expect(screen.getByText('Uyarı: 3')).toBeInTheDocument();
  });
});
