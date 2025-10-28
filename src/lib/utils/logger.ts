/**
 * Conditional logging utility that only logs in development
 * Prevents memory leaks from console.log in production
 * Type-safe logging interface
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogArgs = readonly unknown[];
type TableData = Record<string, unknown> | readonly Record<string, unknown>[];

const isDevelopment = process.env.NODE_ENV === 'development';

interface Logger {
  log: (...args: LogArgs) => void;
  warn: (...args: LogArgs) => void;
  error: (...args: LogArgs) => void;
  info: (...args: LogArgs) => void;
  debug: (...args: LogArgs) => void;
  table: (data: TableData) => void;
  time: (label: string) => void;
  timeEnd: (label: string) => void;
  group: (label?: string) => void;
  groupEnd: () => void;
  clear: () => void;
}

export const logger: Logger = {
  log: () => {},
  
  warn: () => {},
  
  error: (...args: LogArgs) => {
    // Only surface errors; keep payload minimal to reduce memory
    try {
      if (args.length === 0) {
        return;
      }
      const [first, ...rest] = args as unknown[];
      const maybeErr = rest?.[0] as any;
      if (first instanceof Error) {
        console.error(first.message);
      } else if (typeof first === 'string') {
        // If a string prefix is provided and an Error/object follows, include its message compactly
        if (maybeErr instanceof Error && typeof maybeErr.message === 'string') {
          console.error(`${first} ${maybeErr.message}`);
        } else if (maybeErr && typeof maybeErr.message === 'string') {
          console.error(`${first} ${maybeErr.message}`);
        } else if (maybeErr && typeof maybeErr === 'object') {
          // Print a compact subset to avoid bloat
          const compact = JSON.stringify({
            message: (maybeErr && (maybeErr.message || maybeErr.error)) || undefined,
            code: maybeErr.code || maybeErr.status || undefined
          });
          console.error(`${first} ${compact}`);
        } else {
          console.error(first);
        }
      } else {
        console.error(JSON.stringify(first));
      }
      // Drop verbose objects in rest to avoid memory bloat
    } catch {
      // Fallback to a simple error emission
      console.error('Error');
    }
  },
  
  info: () => {},
  
  debug: () => {},
  
  table: () => {},
  
  time: () => {},
  
  timeEnd: () => {},
  
  group: () => {},
  
  groupEnd: () => {},
  
  clear: () => {}
};

export default logger;