import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as currency
 * @param value The value to format
 * @param currency The currency code (default: GBP)
 * @returns Formatted currency string
 */
export function formatCurrency(value: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format a number for display, converting to "k" notation when over 999
 * @param value The number to format
 * @returns Formatted string (e.g., "999", "1k", "1.4k", "2k")
 */
export function formatRank(value: number): string {
  if (value < 1000) {
    return value.toString();
  }
  
  const thousands = value / 1000;
  // If it's a whole number (e.g., 2000 -> 2k), don't show decimals
  if (thousands % 1 === 0) {
    return `${thousands}k`;
  }
  
  // Otherwise, show one decimal place (e.g., 1400 -> 1.4k)
  return `${thousands.toFixed(1)}k`;
}