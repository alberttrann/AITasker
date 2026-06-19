import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@':           path.resolve(__dirname, './src'),
      '@lib':        path.resolve(__dirname, './src/lib'),
      '@components': path.resolve(__dirname, './src/components'),
      '@features':   path.resolve(__dirname, './src/features'),
      '@hooks':      path.resolve(__dirname, './src/hooks'),
      '@store':      path.resolve(__dirname, './src/store'),
      '@t':          path.resolve(__dirname, './src/types'),   
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target:      'http://localhost:3001',
        changeOrigin: true,
        rewrite:     (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
