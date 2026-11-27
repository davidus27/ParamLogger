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
    }
});
