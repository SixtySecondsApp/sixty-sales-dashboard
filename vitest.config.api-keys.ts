import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    name: 'api-keys-test-suite',
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/api-keys/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
    
    // Test file patterns specifically for API key testing
    include: [
      'tests/api-keys/**/*.test.ts',
      'tests/api-keys/**/*.test.tsx',
      'tests/api-keys/**/*.spec.ts'
    ],
    
    exclude: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '**/*.d.ts'
    ],
    
    // Coverage configuration for API key components only
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage/api-keys',
      include: [
        'supabase/functions/create-api-key/**/*.ts',
        'src/components/ApiKeyManager.tsx',
        'src/lib/mockApiKeys.ts',
        'supabase/functions/_shared/**/*.ts'
      ],
      exclude: [
        'node_modules/**',
        'dist/**',
        'build/**',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts'
      ],
      thresholds: {
        global: {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85
        }
      }
    },
    
    // Environment variables for testing
    env: {
      NODE_ENV: 'test',
      VITE_SUPABASE_URL: 'https://test-project.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      SUPABASE_JWT_SECRET: 'test-jwt-secret-very-long-key-for-testing-purposes-minimum-256-bits',
    },
    
    // Pool options for parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4,
        minThreads: 1
      }
    },
    
    // Reporter configuration
    reporter: ['verbose', 'json', 'html'],
    outputFile: {
      json: './test-results/api-keys-results.json',
      html: './test-results/api-keys-results.html'
    },
    
    // Retry configuration for flaky tests
    retry: 2,
    
    // Bail on first failure in CI
    bail: process.env.CI ? 1 : 0
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
      '@supabase': path.resolve(__dirname, './supabase')
    }
  },
  
  define: {
    global: 'globalThis'
  }
});