import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { IpcChannel } from '../../shared/ipc-channels';

/**
 * Verifies that an IPC invocation originates from the trusted application mainFrame
 * (file:// bundle in production or local ELECTRON_RENDERER_URL in dev), never from
 * a cloned site preview iframe or external origin.
 */
export function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const frame = event.senderFrame;
  const mainFrame = event.sender?.mainFrame;

  if (!frame || !mainFrame || frame !== mainFrame) {
    throw new Error('ERR_IPC_FORBIDDEN_SENDER: IPC calls are only permitted from main application frame.');
  }

  const url = frame.url || '';
  const devUrl = process.env['ELECTRON_RENDERER_URL'] || process.env['VITE_DEV_SERVER_URL'] || '';

  const isFileOrigin = url.startsWith('file://');
  const isDevOrigin = Boolean(devUrl && url.startsWith(devUrl));

  if (!isFileOrigin && !isDevOrigin) {
    throw new Error(`ERR_IPC_FORBIDDEN_SENDER: Untrusted frame origin "${url}".`);
  }
}

/**
 * Registers an ipcMain handler protected by senderFrame verification.
 */
export function handleSecure<Req = any, Res = any>(
  channel: IpcChannel,
  handler: (event: IpcMainInvokeEvent, payload: Req) => Promise<Res> | Res
): void {
  ipcMain.handle(channel, async (event, payload) => {
    assertTrustedSender(event);
    return await handler(event, payload as Req);
  });
}
