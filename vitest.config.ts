import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify('2.0.0'),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/src'),
      '@shared': resolve(__dirname, 'src/shared'),
      cheerio: 'cheerio/slim',
      electron: resolve(__dirname, 'tests/setup/electron-mock.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**'],
  },
});
