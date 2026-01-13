import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Vitest configuration for E2E tests using Playwriter
 * E2E tests run in Node.js environment (not jsdom) since they use playwright-core
 * 
 * Note: The dev server must be running before tests start.
 * Start it with: npm run dev (in a separate terminal)
 * Or use: npm run dev:all (starts both dev server and tests)
 */
export default defineConfig({
  plugins: [react()],
  test: {
    name: 'e2e',
    environment: 'node', // E2E tests need Node.js environment for playwright-core
    globals: true,
    include: ['tests/e2e/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    exclude: [
      'node_modules',
      'dist',
      'tests/unit',
      'tests/integration',
      'tests/regression'
    ],
    testTimeout: 60000, // E2E tests may take longer
    hookTimeout: 60000,
    teardownTimeout: 30000,
    // Run tests sequentially to avoid port conflicts with Playwriter CDP server
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Run all tests in a single process
      },
    },
    // Note: We don't start the dev server here because Playwriter uses existing Chrome tabs
    // Make sure to start the dev server manually: npm run dev
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
