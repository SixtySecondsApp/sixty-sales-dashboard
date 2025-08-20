import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Allow Vite to use any available port
    strictPort: false,
    host: true, // Listen on all addresses
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        ws: true,
        // Add timeout and retry logic
        timeout: 30000,
        proxyTimeout: 30000,
        configure: (proxy, _options) => {
          proxy.on('error', (err, req, res) => {
            console.log('proxy error', err);
            // Send a proper error response instead of hanging
            if (res && !res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ 
                error: 'Backend server unavailable', 
                message: 'Please ensure the backend server is running on port 8000',
                details: err.message 
              }));
            }
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
            // Add keep-alive to prevent connection drops
            proxyReq.setHeader('Connection', 'keep-alive');
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
    },
  },
  build: {
    // Simplified chunking to avoid initialization order issues
    rollupOptions: {
      output: {
        manualChunks: {
          // Keep core vendor libs together for proper initialization order
          vendor: ['react', 'react-dom', 'react-router-dom'],
          // Separate Supabase to avoid circular deps but keep initialization simple
          supabase: ['@supabase/supabase-js'],
          // UI libraries
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-tabs', 'framer-motion'],
          // Charts
          charts: ['recharts'],
          // Utils
          utils: ['date-fns', 'clsx']
        }
      },
    },
    // Increase chunk size limit to avoid over-splitting
    chunkSizeWarningLimit: 1000,
    // Keep sourcemaps for debugging vendor bundle issues
    sourcemap: true,
    // Use esbuild for faster builds and less aggressive optimizations
    minify: 'esbuild',
    // Target modern browsers
    target: 'es2020',
  },
  // Optimize dependencies during development
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      'recharts',
      'date-fns',
    ],
    exclude: [
      // Exclude heavy dev dependencies
      '@testing-library/react',
      '@playwright/test',
    ],
  },
  // Performance optimizations
  esbuild: {
    target: 'es2020',
    drop: ['console', 'debugger'],
    legalComments: 'none',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
  },
});