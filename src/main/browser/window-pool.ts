import { BrowserWindow } from 'electron';
import { SessionManager } from './session-manager';

interface PooledWindow {
  win: BrowserWindow;
  partition: string;
  busy: boolean;
  lastUsedAt: number;
}

/**
 * Maintains a small bounded pool of reusable hidden offscreen BrowserWindows
 * to avoid per-page Chromium renderer startup overhead and cleanly reap windows on app exit.
 */
export class WindowPool {
  private static instance: WindowPool;
  private pool: PooledWindow[] = [];
  private readonly maxSize: number = 3;

  public static getInstance(): WindowPool {
    if (!WindowPool.instance) {
      WindowPool.instance = new WindowPool();
    }
    return WindowPool.instance;
  }

  public async acquire(
    partition: string,
    viewport: { width: number; height: number }
  ): Promise<BrowserWindow> {
    SessionManager.configurePartition(partition);

    // Prune any destroyed entries first
    this.pool = this.pool.filter((entry) => !entry.win.isDestroyed());

    const idleSamePartition = this.pool.find((e) => !e.busy && e.partition === partition);
    if (idleSamePartition) {
      idleSamePartition.busy = true;
      idleSamePartition.lastUsedAt = Date.now();
      idleSamePartition.win.setSize(viewport.width, viewport.height);
      return idleSamePartition.win;
    }

    if (this.pool.length >= this.maxSize) {
      // Evict oldest idle entry regardless of partition if pool is full
      const idleSorted = this.pool
        .filter((e) => !e.busy)
        .sort((a, b) => a.lastUsedAt - b.lastUsedAt);
      if (idleSorted.length > 0) {
        const victim = idleSorted[0];
        this.pool = this.pool.filter((e) => e !== victim);
        try {
          if (victim.win.webContents.debugger.isAttached()) {
            victim.win.webContents.debugger.detach();
          }
        } catch {}
        try {
          if (!victim.win.isDestroyed()) {
            victim.win.destroy();
          }
        } catch {}
      }
    }

    const win = new BrowserWindow({
      show: false,
      width: viewport.width,
      height: viewport.height,
      webPreferences: {
        offscreen: true,
        partition,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
      },
    });

    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    this.pool.push({
      win,
      partition,
      busy: true,
      lastUsedAt: Date.now(),
    });

    return win;
  }

  public async release(win: BrowserWindow): Promise<void> {
    const entry = this.pool.find((e) => e.win === win);
    if (!entry) {
      try {
        if (!win.isDestroyed()) win.destroy();
      } catch {}
      return;
    }

    if (win.isDestroyed()) {
      this.pool = this.pool.filter((e) => e !== entry);
      return;
    }

    try {
      if (win.webContents.debugger.isAttached()) {
        win.webContents.debugger.detach();
      }
    } catch {}

    try {
      await win.loadURL('about:blank');
    } catch {}

    entry.busy = false;
    entry.lastUsedAt = Date.now();
  }

  public discard(win: BrowserWindow): void {
    this.pool = this.pool.filter((e) => e.win !== win);
    try {
      if (!win.isDestroyed() && win.webContents.debugger.isAttached()) {
        win.webContents.debugger.detach();
      }
    } catch {}
    try {
      if (!win.isDestroyed()) {
        win.destroy();
      }
    } catch {}
  }

  public destroyAll(): void {
    for (const entry of this.pool) {
      try {
        if (!entry.win.isDestroyed() && entry.win.webContents.debugger.isAttached()) {
          entry.win.webContents.debugger.detach();
        }
      } catch {}
      try {
        if (!entry.win.isDestroyed()) {
          entry.win.destroy();
        }
      } catch {}
    }
    this.pool = [];
  }
}
