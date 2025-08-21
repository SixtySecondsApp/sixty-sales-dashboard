import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';

// Simplified config for performance testing
export default defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: 'dist/bundle-analysis.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
      template: 'treemap',
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    strictPort: false,
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        ws: true,
        timeout: 30000,
        proxyTimeout: 30000,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-router': ['react-router-dom'],
          'vendor-state': ['zustand', '@tanstack/react-query'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-charts': ['recharts'],
          'ui-radix-core': [
            '@radix-ui/react-dialog', 
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select'
          ],
          'ui-radix-extended': [
            '@radix-ui/react-tabs',
            '@radix-ui/react-popover', 
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-tooltip'
          ],
          'ui-animation': ['framer-motion'],
          'ui-forms': [
            'react-hook-form',
            '@radix-ui/react-label',
            '@radix-ui/react-switch'
          ],
          'vendor-utils': ['date-fns', 'clsx', 'class-variance-authority'],
          'vendor-parsing': ['papaparse'],
          'vendor-icons': ['lucide-react'],
        }
      },
    },
    chunkSizeWarningLimit: 500,
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2020',
    cssCodeSplit: true,
    assetsDir: 'assets',
    assetsInlineLimit: 4096,
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      'zustand',
      'lucide-react',
      'clsx',
      'date-fns',
      '@supabase/supabase-js'
    ],
    exclude: [
      'recharts',
      '@radix-ui/react-tabs',
      'framer-motion',
      'papaparse',
    ],
  },
  esbuild: {
    target: 'es2020',
    drop: ['console', 'debugger'],
    legalComments: 'none',
  },
});