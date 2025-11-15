/**
 * Console filter to suppress verbose Supabase library logs
 * This prevents memory leaks and performance issues from excessive logging
 */

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleDebug = console.debug;
const originalConsoleInfo = console.info;

// Patterns that indicate Supabase internal logs
const supabasePatterns = [
  /GoTrueClient/,
  /#_acquireLock/,
  /#_useSession/,
  /#__loadSession/,
  /#getSession/,
  /session from storage/,
  /session has not expired/,
  /lock acquired for storage key/,
  /lock released for storage key/,
  /@supabase_supabase-js/,
  /sb-.*-auth-token/,
];

function isSupabaseLog(...args: any[]): boolean {
  const message = args.map(arg => {
    if (typeof arg === 'string') return arg;
    if (arg instanceof Error) return arg.message;
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  }).join(' ');

  return supabasePatterns.some(pattern => pattern.test(message));
}

/**
 * Initialize console filtering to suppress Supabase logs
 * Call this early in the application lifecycle, before Supabase is initialized
 */
export function suppressSupabaseLogs(): void {
  // Override console.log
  console.log = (...args: any[]) => {
    if (!isSupabaseLog(...args)) {
      originalConsoleLog.apply(console, args);
    }
  };

  // Override console.error (but keep non-Supabase errors)
  console.error = (...args: any[]) => {
    if (!isSupabaseLog(...args)) {
      originalConsoleError.apply(console, args);
    }
  };

  // Override console.warn
  console.warn = (...args: any[]) => {
    if (!isSupabaseLog(...args)) {
      originalConsoleWarn.apply(console, args);
    }
  };

  // Override console.debug
  console.debug = (...args: any[]) => {
    if (!isSupabaseLog(...args)) {
      originalConsoleDebug.apply(console, args);
    }
  };

  // Override console.info
  console.info = (...args: any[]) => {
    if (!isSupabaseLog(...args)) {
      originalConsoleInfo.apply(console, args);
    }
  };
}

/**
 * Restore original console methods (useful for debugging)
 */
export function restoreConsoleLogs(): void {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.debug = originalConsoleDebug;
  console.info = originalConsoleInfo;
}

