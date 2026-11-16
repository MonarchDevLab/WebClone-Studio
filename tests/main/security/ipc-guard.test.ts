import { describe, it, expect } from 'vitest';
import { assertTrustedSender } from '../../../src/main/security/ipc-guard';

describe('Security ipc-guard', () => {
  it('accepts trusted file:// mainFrame origin and rejects third-party or subframe senders', () => {
    const mainFrame = { url: 'file:///app/out/renderer/index.html' };
    const trustedEvent = {
      senderFrame: mainFrame,
      sender: { mainFrame },
    } as any;
    expect(() => assertTrustedSender(trustedEvent)).not.toThrow();

    const evilFrame = { url: 'https://evil.example/exploit.html' };
    const untrustedOriginEvent = {
      senderFrame: evilFrame,
      sender: { mainFrame: evilFrame },
    } as any;
    expect(() => assertTrustedSender(untrustedOriginEvent)).toThrow(/ERR_IPC_FORBIDDEN_SENDER/);

    const subframeEvent = {
      senderFrame: { url: 'http://127.0.0.1:45123/cloned.html' },
      sender: { mainFrame },
    } as any;
    expect(() => assertTrustedSender(subframeEvent)).toThrow(/ERR_IPC_FORBIDDEN_SENDER/);
  });
});
