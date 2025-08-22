import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';

// Production-optimized Vite configuration for memory efficiency
export default defineConfig({
  plugins: [
    react({
      // Production React optimizations
      babel: {
        plugins: [
          // Remove development-only code
          ['transform-remove-console', { exclude: ['error', 'warn'] }],
          // Optimize React components
          ['@babel/plugin-transform-react-constant-elements'],
          ['@babel/plugin-transform-react-inline-elements'],
        ],
      },
    }),
    visualizer({
      filename: 'dist/production-bundle-analysis.html',
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
  define: {
    // Remove development globals
    __DEV__: false,
    'process.env.NODE_ENV': '"production"',
  },
  build: {
    // Memory-optimized build configuration
    rollupOptions: {
      output: {
        // Ultra-granular chunking for optimal memory usage
        manualChunks: {
          // Critical path - smallest possible bundles
          'vendor-react-core': ['react', 'react-dom'],
          'vendor-router': ['react-router-dom'],
          
          // State management - separate to enable lazy loading
          'vendor-state': ['zustand'],
          'vendor-query': ['@tanstack/react-query'],
          
          // Database layer
          'vendor-supabase': ['@supabase/supabase-js'],
          
          // Heavy libraries - aggressive splitting
          'vendor-charts': ['recharts'],
          'vendor-animation': ['framer-motion'],
          'vendor-dnd': ['@hello-pangea/dnd', '@dnd-kit/core', '@dnd-kit/sortable'],
          
          // UI components - micro-chunking strategy
          'ui-radix-dialogs': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-alert-dialog',
          ],
          'ui-radix-dropdowns': [
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-popover',
          ],
          'ui-radix-forms': [
            '@radix-ui/react-label',
            '@radix-ui/react-switch',
            '@radix-ui/react-slider',
            'react-hook-form',
          ],
          'ui-radix-layout': [
            '@radix-ui/react-tabs',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-separator',
          ],
          'ui-radix-feedback': [
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
            'sonner',
          ],
          
          // Utilities - split by usage frequency
          'utils-date': ['date-fns'],
          'utils-styling': ['clsx', 'class-variance-authority', 'tailwind-merge'],
          'utils-icons': ['lucide-react'],
          'utils-parsing': ['papaparse'],
          'utils-ids': ['uuid'],
          
          // Monitoring and performance
          'monitoring': ['web-vitals'],
          
          // Table virtualization
          'vendor-table': ['@tanstack/react-table', 'react-window'],
        },
        
        // Memory-optimized chunk naming
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId
            ? path.basename(chunkInfo.facadeModuleId, path.extname(chunkInfo.facadeModuleId))
            : 'chunk';
          return `assets/${facadeModuleId}-[hash].js`;
        },
        
        // Optimize asset names
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/\.(css)$/.test(assetInfo.name)) {
            return `assets/styles/[name]-[hash].${ext}`;
          }
          if (/\.(png|jpe?g|gif|svg|webp|avif)$/.test(assetInfo.name)) {
            return `assets/images/[name]-[hash].${ext}`;
          }
          if (/\.(woff2?|eot|ttf|otf)$/.test(assetInfo.name)) {
            return `assets/fonts/[name]-[hash].${ext}`;
          }
          return `assets/[name]-[hash].${ext}`;
        },
        
        // Enable tree shaking
        preserveModules: false,
        
        // Memory-efficient output format
        format: 'es',
        generatedCode: {
          constBindings: true,
          arrowFunctions: true,
          objectShorthand: true,
        },
      },
      
      // External dependencies for CDN
      external: (id) => {
        // Externalize large dependencies that can be served from CDN
        return false; // Keep all bundled for now, can be adjusted based on CDN strategy
      },
      
      // Tree shaking configuration
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        unknownGlobalSideEffects: false,
      },
      
      // Input optimization
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
    },
    
    // Build optimization
    target: 'es2020',
    minify: 'terser', // Use Terser for maximum compression in production
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
        passes: 2,
        unsafe_arrows: true,
        unsafe_comps: true,
        unsafe_math: true,
        unsafe_methods: true,
        unsafe_proto: true,
      },
      mangle: {
        properties: {
          regex: /^_/,
        },
      },
      format: {
        comments: false,
      },
    },
    
    // Memory and size limits
    chunkSizeWarningLimit: 250, // Very aggressive chunk size limit
    sourcemap: false, // No sourcemaps in production
    
    // CSS optimization
    cssCodeSplit: true,
    cssMinify: true,
    
    // Asset optimization
    assetsDir: 'assets',
    assetsInlineLimit: 2048, // Reduced inline limit to minimize memory usage
    
    // Rollup memory optimization
    maxParallelFileOps: 2, // Limit parallel operations to reduce memory pressure
    
    // Output directory optimization
    outDir: 'dist',
    emptyOutDir: true,
    
    // Report size
    reportCompressedSize: true,
  },
  
  // Dependency optimization for production
  optimizeDeps: {
    // Don't pre-bundle in production
    disabled: 'build',
  },
  
  // Enhanced esbuild configuration for production
  esbuild: {
    target: 'es2020',
    drop: ['console', 'debugger'],
    legalComments: 'none',
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true,
    treeShaking: true,
    
    // Memory optimization
    logLevel: 'error',
    logLimit: 10,
  },
  
  // CSS production optimization
  css: {
    devSourcemap: false,
    modules: {
      localsConvention: 'camelCase',
      generateScopedName: (name, filename, css) => {
        // Shorter class names for production
        return `_${name.slice(0, 5)}_${Math.abs(
          Array.from(filename + css).reduce((hash, char) => 
            ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0
          )
        ).toString(36).slice(0, 5)}`;
      },
    },
    postcss: {
      plugins: [
        // Optimize CSS for production
        require('autoprefixer'),
        require('cssnano')({
          preset: ['advanced', {
            discardComments: { removeAll: true },
            mergeIdents: true,
            mergeRules: true,
            mergeLonghand: true,
            colormin: true,
            convertValues: true,
            discardDuplicates: true,
            discardEmpty: true,
            discardOverridden: true,
            normalizeCharset: true,
            normalizeDisplayValues: true,
            normalizePositions: true,
            normalizeRepeatStyle: true,
            normalizeString: true,
            normalizeTimingFunctions: true,
            normalizeUnicode: true,
            normalizeUrl: true,
            normalizeWhitespace: true,
            orderedValues: true,
            reduceIdents: true,
            reduceInitial: true,
            reduceTransforms: true,
            svgo: true,
            uniqueSelectors: true,
          }],
        }),
      ],
    },
  },
  
  // Server configuration for preview
  preview: {
    port: 4173,
    host: true,
    headers: {
      'Cache-Control': 'public, max-age=31536000',
      'Service-Worker-Allowed': '/',
    },
  },
  
  // Worker configuration
  worker: {
    format: 'es',
    plugins: [],
  },
});