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
    minify: false,  // 禁用压缩以保留中文字符
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
