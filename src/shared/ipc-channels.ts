/**
 * IPC (Inter-Process Communication) kanal isimleri.
 * Ana süreç (Main) ile İşleyici süreç (Renderer) arasındaki iletişimi sağlar.
 */
export enum IpcChannel {
  // Analyze
  ANALYZE_START = 'analyze:start',
  
  // Clone
  CLONE_START = 'clone:start',
  CLONE_PAUSE = 'clone:pause',
  CLONE_RESUME = 'clone:resume',
  CLONE_CANCEL = 'clone:cancel',
  CLONE_PROGRESS = 'clone:progress',
  CLONE_FILE_ADDED = 'clone:file-added',
  CLONE_LOG = 'clone:log',
  CLONE_COMPLETE = 'clone:complete',
  CLONE_ERROR = 'clone:error',
  
  // Dialog
  DIALOG_SELECT_DIR = 'dialog:select-dir',
  DIALOG_ESTIMATE = 'dialog:estimate',
  
  // Shell
  SHELL_OPEN_FOLDER = 'shell:open-folder',
  SHELL_OPEN_FILE = 'shell:open-file',
  
  // Projects
  PROJECTS_LIST = 'projects:list',
  PROJECTS_DELETE = 'projects:delete',
  PROJECTS_OPEN = 'projects:open',

  // Settings
  SETTINGS_GET = 'settings:get',
  SETTINGS_SET = 'settings:set',

  // Export & Dossier
  EXPORT_SYSTEM_MAP = 'export:system-map',
  DIALOG_SAVE_FILE = 'dialog:save-file',

  // Local Preview Server
  SERVER_START_PREVIEW = 'server:start-preview',
  SERVER_STOP_PREVIEW = 'server:stop-preview',

  // System & Global Errors
  SYSTEM_ERROR = 'system:error',
}
