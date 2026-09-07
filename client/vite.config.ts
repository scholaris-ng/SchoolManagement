/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

/**
 * MSW's worker script lives in `public/` so the dev server can serve it, which
 * would otherwise copy it into every production build. Nothing loads it there —
 * the mock bundle is compiled out — but shipping an interception worker to a
 * live school portal is not something to leave to chance.
 */
function excludeMockWorkerFromBuild(): Plugin {
  return {
    name: 'scholaris:exclude-mock-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const fileName of Object.keys(bundle)) {
        if (fileName === 'mockServiceWorker.js') delete bundle[fileName];
      }
    },
    closeBundle() {
      const artefact = path.resolve(__dirname, 'dist/mockServiceWorker.js');
      if (fs.existsSync(artefact)) fs.rmSync(artefact);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_DEV_API_PROXY || 'http://localhost:4000';

  return {
    plugins: [react(), excludeMockWorkerFromBuild()],
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
    },
  };
});
