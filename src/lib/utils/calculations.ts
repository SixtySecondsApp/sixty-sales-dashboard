import { Deal } from '@/lib/database/models';

/**
 * Calculate the Lifetime Value (LTV) based on revenue model fields
 * 
 * @param deal - The deal object with revenue fields
 * @param fallbackAmount - Fallback amount to use as one-off if no revenue fields are set
 * @param contractYears - Number of years for recurring revenue (default: 1)
 * @returns The calculated LTV
 */
export function calculateLTVValue(
  deal: Partial<Deal> | null | undefined,
  fallbackAmount?: number,
  contractYears: number = 1
): number {
  if (!deal) return fallbackAmount || 0;

  // For older deals without the new revenue fields, use the fallback amount as one-off
  const hasRevenueFields = deal.one_off_revenue || deal.monthly_mrr || deal.annual_value;
  
  if (!hasRevenueFields && fallbackAmount) {
    return fallbackAmount;
  }

  const oneOffRevenue = deal.one_off_revenue || 0;
  const monthlyMRR = deal.monthly_mrr || 0;
  const annualValue = deal.annual_value || 0;

  // Calculate total LTV
  // One-off revenue + (Annual value * years) + (Monthly MRR * 12 months * years)
  const ltvValue = oneOffRevenue + (annualValue * contractYears) + (monthlyMRR * 12 * contractYears);

  return ltvValue;
}

/**
 * Format currency value to GBP
 * 
 * @param value - The numeric value to format
 * @returns Formatted currency string
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '£0';
  return new Intl.NumberFormat('en-GB', { 
    style: 'currency', 
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

/**
 * Get a display string for LTV with optional original amount
 * 
 * @param originalAmount - The original activity amount
 * @param ltvValue - The calculated LTV
 * @param activityType - The type of activity (for special handling)
 * @returns Display string for the amount column
 */
export function formatActivityAmount(
  originalAmount: number | null | undefined,
  ltvValue: number | null | undefined,
  activityType?: string
): string {
  const hasOriginal = originalAmount !== null && originalAmount !== undefined && originalAmount > 0;
  const hasLTV = ltvValue !== null && ltvValue !== undefined && ltvValue > 0;

  // For proposals, always show the amount (original or LTV)
  if (activityType === 'proposal') {
    if (hasLTV) {
      return formatCurrency(ltvValue);
    }
    if (hasOriginal) {
      return formatCurrency(originalAmount);
    }
    return '-';
  }

  if (!hasOriginal && !hasLTV) {
    return '-';
  }

  if (hasLTV && (!hasOriginal || originalAmount === ltvValue)) {
    // Only show LTV if no original or they're the same
    return formatCurrency(ltvValue);
  }

  if (hasOriginal && !hasLTV) {
    // Only show original if no LTV
    return formatCurrency(originalAmount);
  }

  // Show both if they're different
  return `${formatCurrency(originalAmount)} (LTV: ${formatCurrency(ltvValue)})`;
}