import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';

// got + cheerio yayınlıyor artık saf ESM ("type": "module") — externalize edilirse
// derlenen CJS main bundle'ında çıplak require() ile ERR_REQUIRE_ESM ile çöker.
// Bu ikisini dışlayarak Vite'ın kendi bundle'ına gömüp CJS'e interop etmesini sağlıyoruz.
const ESM_ONLY_DEPS = ['got', 'cheerio'];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ESM_ONLY_DEPS })],
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
      },
    },
    build: {
      rollupOptions: {
        // undici (got'un iç HTTP motoru, kendisi CJS) node:sqlite'ı opsiyonel özellik-
        // tespiti için try/catch içinde lazy require() eder. undici got ile birlikte
        // bundle'a gömülürse, Rollup tüm modülün require() çağrılarını dosya tepesine
        // hoisting'liyor — try/catch koruması kayboluyor, Electron'un Node'unda olmayan
        // node:sqlite ERR_UNKNOWN_BUILTIN_MODULE ile çöküyor. undici zaten CJS olduğu
        // için external bırakmak güvenli: normal require() ile node_modules'tan
        // değişmeden yüklenir, iç try/catch'i dokunulmadan çalışır.
        external: ['undici', 'node:sqlite'],
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@shared': resolve('src/shared'),
      },
    },
    plugins: [react(), tailwindcss()],
  },
});
