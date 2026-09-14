import { defineConfig } from 'vite';
import plugin from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [plugin()],
    server: {
        port: 54028,
        strictPort: true,
        watch: {
            ignored: ['**/src-tauri/target/**'],
        },
    }
})
