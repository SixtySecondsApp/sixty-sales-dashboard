/**
 * Conditional logging utility that only logs in development
 * Prevents memory leaks from console.log in production
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  
  error: (...args: any[]) => {
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
  
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
  
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },
  
  table: (data: any) => {
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
  }
};

export default logger;