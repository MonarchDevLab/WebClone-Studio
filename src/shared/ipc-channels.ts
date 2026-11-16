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
  CLONE_RESUME_CHECKPOINT = 'clone:resume-checkpoint',
  CLONE_DIFF = 'clone:diff',
  CLONE_CANCEL = 'clone:cancel',
  CLONE_PROGRESS = 'clone:progress',
  CLONE_FILE_ADDED = 'clone:file-added',
  CLONE_LOG = 'clone:log',
  CLONE_TELEMETRY_BATCH = 'clone:telemetry-batch',
  CLONE_COMPLETE = 'clone:complete',
  CLONE_ERROR = 'clone:error',
  
  // Dialog
  DIALOG_SELECT_DIR = 'dialog:select-dir',
  DIALOG_ESTIMATE = 'dialog:estimate',
  
  // Shell
  SHELL_OPEN_FOLDER = 'shell:open-folder',
  SHELL_OPEN_FILE = 'shell:open-file',
  SHELL_OPEN_EXTERNAL = 'shell:open-external',
  
  // Projects & Artifacts
  PROJECTS_LIST = 'projects:list',
  PROJECTS_DELETE = 'projects:delete',
  PROJECTS_OPEN = 'projects:open',
  ARTIFACTS_SUMMARY = 'artifacts:summary',
  ARTIFACTS_READ = 'artifacts:read',

  // Settings
  SETTINGS_GET = 'settings:get',
  SETTINGS_SET = 'settings:set',

  // Export & Dossier
  EXPORT_SYSTEM_MAP = 'export:system-map',
  EXPORT_WACZ = 'export:wacz',
  DIALOG_SAVE_FILE = 'dialog:save-file',

  // Local Preview Server
  SERVER_START_PREVIEW = 'server:start-preview',
  SERVER_STOP_PREVIEW = 'server:stop-preview',

  // Auth Session Capture
  AUTH_OPEN_SESSION = 'auth:open-session',

  // Updates
  APP_CHECK_UPDATE = 'app:check-update',
  APP_GET_VERSION = 'app:get-version',

  // System & Global Errors
  SYSTEM_ERROR = 'system:error',
}
