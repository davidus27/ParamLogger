import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
export default defineConfig({
    plugins: [vue()],
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'ParameterInventory',
            fileName: 'index'
        },
        rollupOptions: {
            external: ['vue']
        }
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
            '@shared': resolve(__dirname, '../shared/src')
        }
    }
});
