import { describe, it, expect } from 'vitest';
import {
  isBlockedIpAddress,
  assertSafeRemoteUrl,
} from '../../../src/main/security/url-guard';

describe('Security url-guard', () => {
  it('always blocks cloud metadata and unspecified/link-local addresses', () => {
    expect(isBlockedIpAddress('169.254.169.254', true).blocked).toBe(true);
    expect(isBlockedIpAddress('::ffff:169.254.169.254', true).blocked).toBe(true);
    expect(isBlockedIpAddress('0.0.0.0', true).blocked).toBe(true);
    expect(isBlockedIpAddress('fe80::1', true).blocked).toBe(true);
    expect(isBlockedIpAddress('100.64.0.1', true).blocked).toBe(true);
  });

  it('blocks loopback and RFC1918 private IPs by default unless allowLocalhostTargets is enabled', () => {
    expect(isBlockedIpAddress('127.0.0.1', false).blocked).toBe(true);
    expect(isBlockedIpAddress('::1', false).blocked).toBe(true);
    expect(isBlockedIpAddress('::ffff:127.0.0.1', false).blocked).toBe(true);
    expect(isBlockedIpAddress('10.0.0.5', false).blocked).toBe(true);
    expect(isBlockedIpAddress('172.16.0.1', false).blocked).toBe(true);
    expect(isBlockedIpAddress('192.168.1.10', false).blocked).toBe(true);
    expect(isBlockedIpAddress('fc00::1', false).blocked).toBe(true);

    // Loopback allowed ONLY when explicitly permitted for local testing
    expect(isBlockedIpAddress('127.0.0.1', true).blocked).toBe(false);
    expect(isBlockedIpAddress('::1', true).blocked).toBe(false);
    // Public IP is allowed
    expect(isBlockedIpAddress('1.1.1.1', false).blocked).toBe(false);
  });

  it('rejects dangerous schemes, credentials, and DNS rebinding to metadata/private IPs', async () => {
    await expect(assertSafeRemoteUrl('file:///c:/windows/win.ini')).rejects.toThrow(/Unsupported URL protocol/);
    await expect(assertSafeRemoteUrl('javascript:alert(1)')).rejects.toThrow(/Unsupported URL protocol/);
    await expect(assertSafeRemoteUrl('https://user:secret@example.com')).rejects.toThrow(/embedded credentials/);

    const dnsMockMetadata = async () => [{ address: '169.254.169.254', family: 4 }];
    await expect(
      assertSafeRemoteUrl('https://evil-redirect.test/latest', {
        allowLocalhostTargets: true,
        dnsLookup: dnsMockMetadata,
      })
    ).rejects.toThrow(/ERR_SSRF_BLOCKED/);

    const dnsMockPublic = async () => [{ address: '1.1.1.1', family: 4 }];
    const safe = await assertSafeRemoteUrl('https://example.com/app', {
      allowLocalhostTargets: false,
      dnsLookup: dnsMockPublic,
    });
    expect(safe.hostname).toBe('example.com');
  });
});
