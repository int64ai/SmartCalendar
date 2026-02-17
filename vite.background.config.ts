import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: 'src/background/service-worker.ts',
      formats: ['iife'],
      name: 'ServiceWorker',
      fileName: () => 'service-worker.js',
    },
    rollupOptions: {
      output: {
        entryFileNames: 'service-worker.js',
      },
    },
  },
})
