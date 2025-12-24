/**
 * Sentry Profiling Configuration (Optional)
 *
 * Provides profiling utilities for performance monitoring.
 * Disabled by default - enable via VITE_SENTRY_PROFILING_ENABLED=true
 *
 * When enabled:
 * - 1% sample rate in production
 * - 100% sample rate in development
 * - Priority components: Pipeline, DealWizard, MeetingsList
 */

import * as Sentry from '@sentry/react';

// Check if profiling is enabled via environment variable
export const isProfilingEnabled = import.meta.env.VITE_SENTRY_PROFILING_ENABLED === 'true';

// Sample rates
export const PROFILING_SAMPLE_RATE = import.meta.env.PROD ? 0.01 : 1.0; // 1% in prod, 100% in dev

// Priority components that benefit most from profiling
export const PRIORITY_COMPONENTS = [
  'Pipeline',
  'PipelinePage',
  'DealWizard',
  'MeetingsList',
  'MeetingsPage',
  'Dashboard',
  'CRM',
  'ContactsTable',
  'CompaniesTable',
  'TasksPage',
] as const;

export type PriorityComponent = (typeof PRIORITY_COMPONENTS)[number];

/**
 * Check if a component is a priority component for profiling
 */
export function isPriorityComponent(componentName: string): boolean {
  return PRIORITY_COMPONENTS.includes(componentName as PriorityComponent);
}

/**
 * Start a profiled transaction for a component.
 * Only profiles if profiling is enabled.
 */
export function startProfiledTransaction(
  name: string,
  op: string = 'component.render'
): ReturnType<typeof Sentry.startSpan> | null {
  if (!isProfilingEnabled) {
    return null;
  }

  return Sentry.startSpan(
    {
      name,
      op,
      attributes: {
        'profiling.enabled': true,
        'component.priority': isPriorityComponent(name),
      },
    },
    (span) => span
  );
}

/**
 * Profile a function execution.
 * Wraps the function in a profiled span if profiling is enabled.
 */
export async function profiledExecution<T>(
  name: string,
  fn: () => Promise<T>,
  options?: {
    op?: string;
    data?: Record<string, unknown>;
  }
): Promise<T> {
  if (!isProfilingEnabled) {
    return fn();
  }

  return Sentry.startSpan(
    {
      name,
      op: options?.op || 'function',
      attributes: {
        'profiling.enabled': true,
        ...options?.data,
      },
    },
    async () => fn()
  );
}

/**
 * Profile a synchronous function execution.
 */
export function profiledSync<T>(
  name: string,
  fn: () => T,
  options?: {
    op?: string;
    data?: Record<string, unknown>;
  }
): T {
  if (!isProfilingEnabled) {
    return fn();
  }

  return Sentry.startSpan(
    {
      name,
      op: options?.op || 'function.sync',
      attributes: {
        'profiling.enabled': true,
        ...options?.data,
      },
    },
    () => fn()
  );
}

/**
 * Create a profiling wrapper for React components.
 * Use this in useEffect or similar hooks to profile component lifecycle.
 *
 * @example
 * useEffect(() => {
 *   const cleanup = profileComponent('MyComponent');
 *   return cleanup;
 * }, []);
 */
export function profileComponent(componentName: string): () => void {
  if (!isProfilingEnabled) {
    return () => {};
  }

  const startTime = performance.now();

  return () => {
    const duration = performance.now() - startTime;

    // Only log significant renders (>16ms = more than one frame)
    if (duration > 16) {
      Sentry.addBreadcrumb({
        category: 'profiling',
        message: `Component ${componentName} mounted for ${duration.toFixed(2)}ms`,
        level: 'info',
        data: {
          component: componentName,
          duration_ms: duration,
          is_priority: isPriorityComponent(componentName),
        },
      });
    }
  };
}

/**
 * Profile a render cycle for React components.
 * Call at the start of render and returns timing info.
 *
 * @example
 * function MyComponent() {
 *   const renderProfile = useRenderProfile('MyComponent');
 *   // ... component logic
 *   renderProfile.complete();
 * }
 */
export function createRenderProfile(componentName: string): {
  complete: () => void;
  getDuration: () => number;
} {
  const startTime = performance.now();

  return {
    complete: () => {
      if (!isProfilingEnabled) return;

      const duration = performance.now() - startTime;

      // Log slow renders (>50ms)
      if (duration > 50) {
        Sentry.addBreadcrumb({
          category: 'profiling.slow',
          message: `Slow render: ${componentName} took ${duration.toFixed(2)}ms`,
          level: 'warning',
          data: {
            component: componentName,
            duration_ms: duration,
            threshold_ms: 50,
          },
        });
      }
    },
    getDuration: () => performance.now() - startTime,
  };
}

/**
 * Get profiling configuration for Sentry init.
 * Use this when initializing Sentry to conditionally enable profiling.
 */
export function getProfilingConfig(): {
  profilesSampleRate: number;
} | null {
  if (!isProfilingEnabled) {
    return null;
  }

  return {
    profilesSampleRate: PROFILING_SAMPLE_RATE,
  };
}

/**
 * Log profiling status for debugging
 */
export function logProfilingStatus(): void {
  if (import.meta.env.DEV) {
    console.log('[Sentry Profiling]', {
      enabled: isProfilingEnabled,
      sampleRate: PROFILING_SAMPLE_RATE,
      environment: import.meta.env.PROD ? 'production' : 'development',
      priorityComponents: PRIORITY_COMPONENTS,
    });
  }
}
