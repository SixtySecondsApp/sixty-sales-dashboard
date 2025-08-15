import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./setup.ts'],
    globals: true,
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.config.{js,ts}',
        '**/*.test.{js,ts,tsx}',
        '**/*.spec.{js,ts,tsx}',
        'setup.ts'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 85,
          lines: 90,
          statements: 90
        }
      }
    },
    // Increase timeout for performance tests
    testTimeout: 10000,
    // Mock browser APIs
    mockReset: true,
    clearMocks: true,
    // Include patterns for test discovery
    include: [
      '**/*.{test,spec}.{js,ts,tsx}',
      '!**/e2e-*.spec.ts' // Exclude Playwright E2E tests
    ]
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '../'),
      '@/components': resolve(__dirname, '../components'),
      '@/lib': resolve(__dirname, '../lib'),
      '@/tests': resolve(__dirname, './')
    }
  }
});