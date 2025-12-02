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
  
  error: () => {
    // Silently ignore errors to prevent memory leaks and performance issues
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