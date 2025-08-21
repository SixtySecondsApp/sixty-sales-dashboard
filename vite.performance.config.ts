/**
 * Performance-Optimized Vite Configuration
 * 
 * This configuration implements the recommendations from the performance analysis:
 * - Optimized bundle splitting
 * - Reduced initial bundle size
 * - Better caching strategies
 * - Resource preloading
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';

export default defineConfig({
  plugins: [
    react({
      // Optimize React for production
      babel: {
        plugins: [
          // Remove React dev tools in production
          ['babel-plugin-react-remove-properties', { properties: ['data-testid'] }],
        ],
      },
    }),
    visualizer({
      filename: 'dist/bundle-analysis.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
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
        configure: (proxy, _options) => {
          proxy.on('error', (err, req, res) => {
            console.log('proxy error', err);
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
    // Performance-optimized build settings
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React libraries - load first (smallest, most critical)
          'vendor-react': ['react', 'react-dom'],
          
          // Router - needed early but can be separate
          'vendor-router': ['react-router-dom'],
          
          // State management and data fetching
          'vendor-state': ['zustand', '@tanstack/react-query'],
          
          // Supabase - keep separate to avoid duplication
          'vendor-supabase': ['@supabase/supabase-js'],
          
          // Charts - lazy loaded, heavy library
          'vendor-charts': ['recharts'],
          
          // UI components - split into logical groups
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
          
          // Utilities
          'vendor-utils': ['date-fns', 'clsx', 'class-variance-authority'],
          'vendor-parsing': ['papaparse'],
          'vendor-icons': ['lucide-react'],
          
          // Feature-specific chunks
          'feature-pipeline': [
            './src/pages/PipelinePage',
            './src/components/Pipeline'
          ],
          'feature-charts-dashboard': [
            './src/components/SalesActivityChart',
            './src/pages/Dashboard'
          ]
        }
      },
    },
    
    // Optimize bundle size
    chunkSizeWarningLimit: 500, // Reduced from 1000KB
    sourcemap: process.env.NODE_ENV === 'development', // Only in dev
    minify: 'esbuild', // Faster than terser
    target: 'es2020',
    
    // CSS code splitting
    cssCodeSplit: true,
    
    // Optimize asset handling
    assetsDir: 'assets',
    assetsInlineLimit: 4096, // 4KB limit for inlining
  },
  
  // Enhanced dependency optimization
  optimizeDeps: {
    include: [
      // Pre-bundle critical dependencies
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      'zustand',
      
      // UI essentials
      'lucide-react',
      'clsx',
      'date-fns',
      
      // Supabase for API calls
      '@supabase/supabase-js'
    ],
    exclude: [
      // Don't pre-bundle heavy/rarely used libs
      'recharts',
      '@radix-ui/react-tabs',
      'framer-motion',
      'papaparse',
      
      // Test dependencies
      '@testing-library/react',
      '@playwright/test',
      'vitest'
    ],
    
    // Force optimize specific deps that might not auto-detect
    force: process.env.NODE_ENV === 'development'
  },
  
  // Enhanced esbuild configuration
  esbuild: {
    target: 'es2020',
    
    // Production optimizations
    ...(process.env.NODE_ENV === 'production' && {
      drop: ['console', 'debugger'],
      legalComments: 'none',
      minifyIdentifiers: true,
      minifySyntax: true,
      minifyWhitespace: true,
    }),
    
    // Development optimizations
    ...(process.env.NODE_ENV === 'development' && {
      keepNames: true,
    })
  },
  
  // CSS optimization
  css: {
    devSourcemap: process.env.NODE_ENV === 'development',
    modules: {
      // Optimize CSS modules
      localsConvention: 'camelCase',
    },
  },
  
  // Vitest configuration
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    // Optimize test runs
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true
      }
    }
  },
  
  // Performance monitoring
  define: {
    // Enable performance monitoring in development
    __DEV_PERFORMANCE__: JSON.stringify(process.env.NODE_ENV === 'development'),
    __BUNDLE_ANALYZER__: JSON.stringify(process.env.ANALYZE === 'true'),
  },
  
  // Experimental features for performance
  experimental: {
    // Enable render optimization
    renderBuiltUrl(filename) {
      return `/${filename}`;
    }
  }
});