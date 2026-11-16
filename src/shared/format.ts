const BYTE_UNITS_HUMAN = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'] as const;
const BYTE_UNITS_COMPACT = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const;

/**
 * Formats a byte count into a human-readable unit string.
 */
export function formatBytes(
  bytes: number,
  decimals: number = 2,
  compactUnit: boolean = false
): string {
  const units = compactUnit ? BYTE_UNITS_COMPACT : BYTE_UNITS_HUMAN;
  if (!bytes || bytes <= 0 || Number.isNaN(bytes)) {
    return `0 ${units[0]}`;
  }
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${units[i]}`;
}

/**
 * Formats seconds either as a readable duration ("1h 12m 30s") or a digital clock ("01:12:30").
 */
export function formatDuration(
  seconds: number,
  style: 'human' | 'clock' = 'human'
): string {
  if (!seconds || seconds <= 0 || Number.isNaN(seconds)) {
    return style === 'clock' ? '00:00' : '0s';
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (style === 'clock') {
    const mm = String(mins).padStart(2, '0');
    const ss = String(secs).padStart(2, '0');
    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${mm}:${ss}`;
    }
    return `${mm}:${ss}`;
  }

  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

/**
 * Formats bytes-per-second throughput speed.
 */
export function formatSpeed(bytesPerSecond: number, compactUnit: boolean = true): string {
  return `${formatBytes(bytesPerSecond, compactUnit ? 1 : 2, compactUnit)}/s`;
}

/**
 * Formats integers with locale-appropriate grouping separators.
 */
export function formatNumber(n: number): string {
  return Number.isFinite(n) ? n.toLocaleString() : '0';
}
