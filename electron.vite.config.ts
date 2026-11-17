import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import tailwindcss from '@tailwindcss/vite';

const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { version: string };
const appVersionDefine = {
  __APP_VERSION__: JSON.stringify(pkg.version),
};

// Bundle ESM-only main-process dependencies so Rollup compiles them cleanly to CJS.
const ESM_ONLY_DEPS = ['cheerio'];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ESM_ONLY_DEPS })],
    define: appVersionDefine,
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        cheerio: 'cheerio/slim',
      },
    },
    build: {
      minify: 'esbuild',
      rollupOptions: {
        // Keep Node built-in node:sqlite external to preserve native built-in loading semantics.
        external: ['node:sqlite'],
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    define: appVersionDefine,
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
      },
    },
  },
  renderer: {
    define: appVersionDefine,
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@shared': resolve('src/shared'),
      },
    },
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('react-dom') || id.includes('scheduler') || /[\\/]react[\\/]/.test(id)) {
              return 'vendor-react';
            }
            return 'vendor-libs';
          },
        },
      },
    },
  },
});
