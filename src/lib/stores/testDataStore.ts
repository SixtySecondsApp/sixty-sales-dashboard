/**
 * Test Data Store - Keeps test_data mode state during navigation
 *
 * Keeps track of:
 * - Test run results
 * - Created resources (for cleanup)
 * - Cleanup status
 *
 * Note: Currently uses in-memory store only. Data is lost on page refresh.
 * This is intentional to avoid auth-related refresh loops.
 */

import { create } from 'zustand';
import type {
  TrackedResource,
  TrackedAIPrompt,
  CleanupResult,
  TestDataTestRun,
} from '@/lib/types/processMapTesting';

// Serializable test run data (excludes engine reference)
interface PersistedTestRun {
  testRun: TestDataTestRun;
  trackedResources: TrackedResource[];
  trackedAIPrompts: TrackedAIPrompt[];
  cleanupResult: CleanupResult | null;
}

interface TestDataState {
  // Current test run data (per process map)
  testRuns: Record<string, PersistedTestRun>;

  // Actions
  setTestRun: (
    processMapId: string,
    testRun: TestDataTestRun,
    trackedResources: TrackedResource[],
    trackedAIPrompts: TrackedAIPrompt[]
  ) => void;

  updateTrackedResources: (
    processMapId: string,
    resources: TrackedResource[]
  ) => void;

  setCleanupResult: (
    processMapId: string,
    result: CleanupResult
  ) => void;

  clearTestRun: (processMapId: string) => void;

  getTestRun: (processMapId: string) => PersistedTestRun | null;
}

// Simple in-memory store (no persistence for now to avoid refresh issues)
export const useTestDataStore = create<TestDataState>()((set, get) => ({
  testRuns: {},

  setTestRun: (processMapId, testRun, trackedResources, trackedAIPrompts) => {
    set((state) => ({
      testRuns: {
        ...state.testRuns,
        [processMapId]: {
          testRun,
          trackedResources,
          trackedAIPrompts,
          cleanupResult: null,
        },
      },
    }));
  },

  updateTrackedResources: (processMapId, resources) => {
    set((state) => {
      const existing = state.testRuns[processMapId];
      if (!existing) return state;

      return {
        testRuns: {
          ...state.testRuns,
          [processMapId]: {
            ...existing,
            trackedResources: resources,
          },
        },
      };
    });
  },

  setCleanupResult: (processMapId, result) => {
    set((state) => {
      const existing = state.testRuns[processMapId];
      if (!existing) return state;

      return {
        testRuns: {
          ...state.testRuns,
          [processMapId]: {
            ...existing,
            cleanupResult: result,
          },
        },
      };
    });
  },

  clearTestRun: (processMapId) => {
    set((state) => {
      const { [processMapId]: _, ...rest } = state.testRuns;
      return { testRuns: rest };
    });
  },

  getTestRun: (processMapId) => {
    return get().testRuns[processMapId] || null;
  },
}));
