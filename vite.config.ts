/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // The dev server runs inside WSL against files on the Windows drive
    // (/mnt/c/...). Native filesystem events (inotify) don't reliably cross
    // that WSL↔Windows boundary, so edits made from the Windows side can go
    // unnoticed until the server is restarted. Polling instead of relying on
    // native events fixes that at the cost of some CPU/battery overhead.
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    css: true,
  },
});
