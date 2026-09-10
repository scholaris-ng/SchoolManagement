/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_DEV_API_PROXY || 'http://localhost:4000';

  return {
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    server: {
      port: 5173,
      // API calls are proxied to the Express server in development so the
      // browser always talks to a same-origin `/api/v1` path, exactly as it
      // will in production behind Firebase App Hosting.
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true, secure: false },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            query: ['@tanstack/react-query'],
            charts: ['recharts'],
            firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      /**
       * Vitest's 5s default is too tight for the page-level specs here. Several
       * render a whole screen, drive it with `userEvent` and wait on React
       * Query — around 3-4s on an idle machine, and past 5s once the suite runs
       * them in parallel. That produced failures that came and went with
       * machine load rather than with the code.
       */
      testTimeout: 20_000,
    },
  };
});
