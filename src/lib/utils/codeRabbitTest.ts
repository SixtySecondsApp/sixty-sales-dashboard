/**
 * CodeRabbit Test Utility
 * 
 * This file is created to test CodeRabbit AI code review integration.
 * It contains some intentional code patterns that CodeRabbit might comment on.
 */

/**
 * Calculate the sum of an array of numbers
 */
export function calculateSum(numbers: number[]): number {
  let sum = 0;
  for (let i = 0; i < numbers.length; i++) {
    sum += numbers[i];
  }
  return sum;
}

/**
 * Format a currency value
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  // Simple currency formatting
  if (currency === 'USD') {
    return '$' + amount.toFixed(2);
  } else if (currency === 'GBP') {
    return '£' + amount.toFixed(2);
  } else if (currency === 'EUR') {
    return '€' + amount.toFixed(2);
  }
  return amount.toFixed(2) + ' ' + currency;
}

/**
 * Validate an email address
 */
export function isValidEmail(email: string): boolean {
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Debounce a function call
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Get a random integer between min and max (inclusive)
 */
export function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Capitalize the first letter of a string
 */
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
