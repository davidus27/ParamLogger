/// <reference types="vitest" />
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

const root = import.meta.dirname;

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: resolve(root, 'src/index.ts'),
      name: 'ParamLogger',
      fileName: 'index'
    },
    rollupOptions: {
      external: ['vue']
    }
  },
  resolve: {
    alias: {
      '@': resolve(root, 'src'),
      '@shared': resolve(root, '../shared/src')
    }
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts', 'src/**/*.vue'],
      exclude: ['src/index.ts']
    }
  }
});