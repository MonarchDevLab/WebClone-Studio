/**
 * Byte değerini okunabilir metne dönüştürür (örn: 14.2 MB)
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Saniye değerini okunabilir süreye dönüştürür (örn: 1h 12m 30s, 7m 14s veya 24s)
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0 || isNaN(seconds)) return '0s';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}
