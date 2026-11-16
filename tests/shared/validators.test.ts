import { describe, it, expect } from 'vitest';
import { formatBytes, formatDuration, formatSpeed } from '../../src/shared/format';
import { clampCloneSettings, sanitizeSettingsPatch, validateHttpUrlShape } from '../../src/shared/validators';

describe('Shared Format & Validators', () => {
  it('formats bytes and durations accurately across human and clock styles', () => {
    expect(formatBytes(0)).toBe('0 Bytes');
    expect(formatBytes(0, 1, true)).toBe('0 B');
    expect(formatBytes(1024 * 1024, 2, false)).toBe('1 MB');
    expect(formatDuration(3665, 'human')).toBe('1h 1m 5s');
    expect(formatDuration(3665, 'clock')).toBe('01:01:05');
    expect(formatSpeed(2048)).toBe('2 KB/s');
  });

  it('validates HTTP/HTTPS URLs and rejects credentials or dangerous schemes', () => {
    expect(validateHttpUrlShape('https://example.com/path').hostname).toBe('example.com');
    expect(() => validateHttpUrlShape('file:///etc/passwd')).toThrow(/Unsupported URL protocol/);
    expect(() => validateHttpUrlShape('javascript:alert(1)')).toThrow(/Unsupported URL protocol/);
    expect(() => validateHttpUrlShape('https://user:pass@example.com')).toThrow(/embedded credentials/);
  });

  it('clamps clone settings and settings patches to safe bounds', () => {
    const clamped = clampCloneSettings({
      maxDepth: 999,
      concurrentDownloads: -5,
      rateLimit: 999999,
      maxFileSize: 9999999999,
      mode: 'dynamic',
    });
    expect(clamped.maxDepth).toBe(10);
    expect(clamped.concurrentDownloads).toBe(1);
    expect(clamped.rateLimit).toBe(5000);
    expect(clamped.maxFileSize).toBe(500 * 1024 * 1024);

    const patch = sanitizeSettingsPatch({
      defaultThreads: 100,
      defaultRateLimit: -10,
      allowLocalhostTargets: true,
    });
    expect(patch.defaultThreads).toBe(20);
    expect(patch.defaultRateLimit).toBe(0);
    expect(patch.allowLocalhostTargets).toBe(true);
  });
});
