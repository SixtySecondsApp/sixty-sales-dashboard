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
  build: {
    // Target smaller chunk sizes for better caching and loading
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunk optimization
          if (id.includes('node_modules')) {
            // Core React libs - keep small and frequently used
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-core';
            }
            // Heavy UI libraries
            if (id.includes('@radix-ui') || id.includes('framer-motion')) {
              return 'ui-libs';
            }
            // Chart libraries (heavy)
            if (id.includes('recharts') || id.includes('d3')) {
              return 'charts';
            }
            // Supabase and related
            if (id.includes('@supabase') || id.includes('postgrest')) {
              return 'supabase';
            }
            // Date/utility libraries
            if (id.includes('date-fns') || id.includes('lodash') || id.includes('clsx')) {
              return 'utils';
            }
            // DnD libraries
            if (id.includes('@dnd-kit') || id.includes('@hello-pangea/dnd')) {
              return 'dnd';
            }
            // Everything else as shared vendor
            return 'vendor';
          }

          // Route-based code splitting for large components
          if (id.includes('src/pages/')) {
            if (id.includes('Dashboard')) return 'route-dashboard';
            if (id.includes('Pipeline')) return 'route-pipeline';
            if (id.includes('companies/')) return 'route-companies';
            if (id.includes('contacts/')) return 'route-contacts';
            if (id.includes('deals/')) return 'route-deals';
            if (id.includes('admin/')) return 'route-admin';
            if (id.includes('auth/')) return 'route-auth';
            return 'route-other';
          }

          // Component-based splitting for heavy components
          if (id.includes('src/components/')) {
            if (id.includes('PaymentsTable')) return 'comp-payments';
            if (id.includes('Pipeline/')) return 'comp-pipeline';
            if (id.includes('EditDealModal/')) return 'comp-edit-deal';
            if (id.includes('SalesActivityChart')) return 'comp-charts';
          }

          // Hook-based splitting for heavy logic
          if (id.includes('src/lib/hooks/')) {
            if (id.includes('useCompany') || id.includes('useCompanies')) return 'hooks-company';
            if (id.includes('useDeals') || id.includes('useDealSplits')) return 'hooks-deals';
            if (id.includes('useActivities') || id.includes('useSalesData')) return 'hooks-activities';
            if (id.includes('useClients') || id.includes('useMRR')) return 'hooks-clients';
          }
        },
      },
    },
    // Reduce chunk size warning limit to catch bloat early
    chunkSizeWarningLimit: 200,
    // Disable sourcemaps in production for smaller bundles
    sourcemap: false,
    // Use terser for better minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
        passes: 2,
      },
      mangle: {
        safari10: true,
      },
    },
    // Target modern browsers for smaller output
    target: 'es2020',
    // Optimize dependencies
    commonjsOptions: {
      include: [/node_modules/],
    },
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