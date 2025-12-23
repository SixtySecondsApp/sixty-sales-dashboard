import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';

// Plugin to exclude landing package from production builds
// Landing pages are deployed separately and should not be bundled in the main app
function excludeLandingPackagePlugin(): Plugin {
  return {
    name: 'exclude-landing-package',
    enforce: 'pre',
    resolveId(id, importer) {
      // In production, replace landing package imports with empty modules
      if (process.env.NODE_ENV === 'production' && id.includes('packages/landing')) {
        return { id: '\0virtual:empty-landing-module', moduleSideEffects: false };
      }
      return null;
    },
    load(id) {
      if (id === '\0virtual:empty-landing-module') {
        // Return an empty module that exports nothing
        return 'export default function() { return null; }; export {};';
      }
      return null;
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    // Exclude landing package in production (must be first to intercept imports early)
    excludeLandingPackagePlugin(),
    react({
      // Optimize React for production
      babel: {
        plugins: [],
      },
    }),
    visualizer({
      filename: 'dist/bundle-analysis.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
      template: 'treemap', // Better visualization
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Allow importing landing package for dev-only local preview
      '@landing': path.resolve(__dirname, './packages/landing/src'),
    },
  },
  
  // Handle CommonJS/ESM compatibility issues
  define: {
    // Fix recharts lodash import issues
    global: 'globalThis',
  },
  server: {
    // Force a specific port to maintain authentication consistency
    strictPort: true,
    host: true, // Listen on all addresses
    port: 5175, // Fixed port - will error if in use rather than switching
    // Commented out proxy to allow API test suite to work with Supabase Edge Functions
    // proxy: {
    //   '/api': {
    //     target: 'http://127.0.0.1:8000',
    //     changeOrigin: true,
    //     secure: false,
    //     ws: true,
    //     // Add timeout and retry logic
    //     timeout: 30000,
    //     proxyTimeout: 30000,
    //     configure: (proxy, _options) => {
    //       proxy.on('error', (err, req, res) => {
    //         console.log('proxy error', err);
    //         // Send a proper error response instead of hanging
    //         if (res && !res.headersSent) {
    //           res.writeHead(502, { 'Content-Type': 'application/json' });
    //           res.end(JSON.stringify({ 
    //             error: 'Backend server unavailable', 
    //             message: 'Please ensure the backend server is running on port 8000',
    //             details: err.message 
    //           }));
    //         }
    //       });
    //       proxy.on('proxyReq', (proxyReq, req, _res) => {
    //         console.log('Sending Request to the Target:', req.method, req.url);
    //         // Add keep-alive to prevent connection drops
    //         proxyReq.setHeader('Connection', 'keep-alive');
    //       });
    //       proxy.on('proxyRes', (proxyRes, req, _res) => {
    //         console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
    //       });
    //     },
    //   },
    // },
  },
  build: {
    // Performance-optimized chunking strategy
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
          
          // Charts removed from vendor chunk - now dynamically imported
          
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
        },
        
        // Generate consistent file names with content hashes for cache busting
        entryFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId
            ? chunkInfo.facadeModuleId.split('/').pop().replace(/\.[jt]sx?$/, '')
            : 'unknown';
          // Use contenthash for cache busting
          return `js/${facadeModuleId}-[hash].js`;
        },
        
        chunkFileNames: (chunkInfo) => {
          // Use contenthash for cache busting
          return `js/[name]-[hash].js`;
        },
        
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          let extType = info[info.length - 1];
          
          // Handle different asset types
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            extType = 'images';
          } else if (/woff2?|eot|ttf|otf/i.test(extType)) {
            extType = 'fonts';
          } else if (/css/i.test(extType)) {
            extType = 'css';
          }
          
          // Use contenthash for cache busting
          return `${extType}/[name]-[hash].[ext]`;
        }
      },
    },
    
    // Optimize bundle size
    chunkSizeWarningLimit: 500, // Reduced from 1000KB to encourage smaller chunks
    sourcemap: process.env.NODE_ENV === 'development', // Only in dev
    minify: 'esbuild', // Faster than terser
    target: 'es2020',
    
    // CSS code splitting
    cssCodeSplit: true,
    
    // Optimize asset handling
    assetsDir: 'assets',
    assetsInlineLimit: 4096, // 4KB limit for inlining
    
    // Copy service worker and ensure proper asset handling
    copyPublicDir: true,
    
    // Ensure assets are properly resolved
    emptyOutDir: true,
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
      
      // Radix UI (prebundle to avoid slow on-demand transforms / 504s in dev)
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-popover',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-label',
      '@radix-ui/react-switch',

      // UI essentials
      'lucide-react',
      'clsx',
      'date-fns',
      
      // Supabase for API calls
      '@supabase/supabase-js',
      
      // Charts - need to pre-bundle to fix lodash ESM issues
      'recharts',
      
      // Workflow visualization
      'reactflow',
      
      // Lodash utilities required by recharts
      'lodash',
      'lodash/get',
      'lodash/isEqual',
      'lodash/isNil',
      'lodash/isFunction',
      'lodash/isObject',
      'lodash/isArray',
      'lodash/upperFirst',
      'lodash/sortBy',
      'lodash/uniqueId',
      'lodash/isNaN',
      'lodash/isString',
      'lodash/isNumber'
    ],
    exclude: [
      // Don't pre-bundle heavy/rarely used libs
      'framer-motion',
      
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
    
    // Development optimizations - NEVER drop console in dev
    ...(process.env.NODE_ENV !== 'production' && {
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
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
  },
});