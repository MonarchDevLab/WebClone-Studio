import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  formatBytes as sharedFormatBytes,
  formatDuration as sharedFormatDuration,
  formatSpeed as sharedFormatSpeed,
  formatNumber,
} from '@shared/format';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 1): string {
  return sharedFormatBytes(bytes, decimals, true);
}

export function formatDuration(seconds: number): string {
  return sharedFormatDuration(seconds, 'clock');
}

export function formatSpeed(bytesPerSecond: number): string {
  return sharedFormatSpeed(bytesPerSecond, true);
}

export { formatNumber };
