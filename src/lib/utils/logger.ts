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
  log: (...args: LogArgs) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  warn: (...args: LogArgs) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  
  error: (...args: LogArgs) => {
    // Always log errors, but in production send to error tracking service
    if (isDevelopment) {
      console.error(...args);
    } else {
      // In production, you might want to send to an error tracking service
      // like Sentry, LogRocket, etc.
      // For now, we'll use a minimal console.error
      console.error(args[0]); // Only log the first argument (usually the message)
    }
  },
  
  info: (...args: LogArgs) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
  
  debug: (...args: LogArgs) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },
  
  table: (data: TableData) => {
    if (isDevelopment) {
      console.table(data);
    }
  },
  
  time: (label: string) => {
    if (isDevelopment) {
      console.time(label);
    }
  },
  
  timeEnd: (label: string) => {
    if (isDevelopment) {
      console.timeEnd(label);
    }
  },
  
  group: (label?: string) => {
    if (isDevelopment) {
      console.group(label);
    }
  },
  
  groupEnd: () => {
    if (isDevelopment) {
      console.groupEnd();
    }
  },
  
  clear: () => {
    if (isDevelopment) {
      console.clear();
    }
  }
};

export default logger;