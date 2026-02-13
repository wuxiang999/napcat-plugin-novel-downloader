import { defineConfig } from 'vite';
import { resolve } from 'path';
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'index.mjs',
    },
    rollupOptions: {
      external: [
        'napcat-types',
        'axios',
        'cheerio',
        'epub-gen',
        'adm-zip',
        'fs',
        'path',
        'http',
        'https',
        'crypto',
      ],
      plugins: [nodeResolve()],
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
