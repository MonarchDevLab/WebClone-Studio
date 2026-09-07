import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Sınıf isimlerini birleştirir ve Tailwind çakışmalarını çözer
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Bayt değerini okunabilir formata dönüştürür
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Saniye cinsinden süreyi "MM:SS" veya "HH:MM:SS" formatına dönüştürür
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0 || isNaN(seconds)) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m}:${s}`;
  }
  return `${m}:${s}`;
}

/**
 * Saniyedeki bayt hızını formatlar
 */
export function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

/**
 * Sayıyı yerel formata göre binlik ayırıcı ile formatlar (örn. 1,417)
 */
export function formatNumber(n: number): string {
  return n.toLocaleString();
}
