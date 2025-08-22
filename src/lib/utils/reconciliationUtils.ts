/**
 * Reconciliation Utility Functions
 * Phase 1: Data Analysis & Reporting
 * 
 * This module provides utility functions for sales data reconciliation,
 * including fuzzy matching algorithms, confidence scoring, and data transformation.
 */

import { differenceInDays, parseISO, isValid } from 'date-fns';
import logger from '@/lib/utils/logger';

// Types for utility functions
export interface FuzzyMatchResult {
  similarity: number;
  isMatch: boolean;
  confidence: 'high' | 'medium' | 'low';
  matchType: 'exact' | 'fuzzy' | 'variation';
}

export interface DateProximityResult {
  daysDifference: number;
  isWithinThreshold: boolean;
  proximityScore: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface AmountSimilarityResult {
  percentageDifference: number;
  isSimilar: boolean;
  similarityScore: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface ConfidenceScore {
  nameScore: number;
  dateScore: number;
  amountScore: number;
  totalScore: number;
  level: 'high_confidence' | 'medium_confidence' | 'low_confidence';
  isRecommended: boolean;
}

export interface ReconciliationMatch {
  activityId: string;
  dealId: string;
  clientName: string;
  companyName: string;
  confidenceScore: ConfidenceScore;
  reasons: string[];
  risks: string[];
}

/**
 * FUZZY MATCHING ALGORITHMS
 */

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i += 1) {
    matrix[0][i] = i;
  }

  for (let j = 0; j <= str2.length; j += 1) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Calculate similarity ratio between two strings (0-1)
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1;
  
  const distance = levenshteinDistance(str1, str2);
  return (maxLength - distance) / maxLength;
}

/**
 * Normalize company name for comparison
 */
export function normalizeCompanyName(name: string): string {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .trim()
    // Remove common business suffixes
    .replace(/\b(ltd|limited|inc|incorporated|corp|corporation|llc|llp|plc|co|company)\b\.?/g, '')
    // Remove common prefixes
    .replace(/^(the\s+)/g, '')
    // Remove special characters except spaces and alphanumeric
    .replace(/[^a-z0-9\s]/g, '')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Perform fuzzy matching between two company names
 */
export function fuzzyMatchCompanyNames(name1: string, name2: string): FuzzyMatchResult {
  if (!name1 || !name2) {
    return {
      similarity: 0,
      isMatch: false,
      confidence: 'low',
      matchType: 'exact'
    };
  }

  // Exact match check
  if (name1.toLowerCase().trim() === name2.toLowerCase().trim()) {
    return {
      similarity: 1,
      isMatch: true,
      confidence: 'high',
      matchType: 'exact'
    };
  }

  // Normalize names for comparison
  const normalized1 = normalizeCompanyName(name1);
  const normalized2 = normalizeCompanyName(name2);

  // Check for exact match after normalization
  if (normalized1 === normalized2) {
    return {
      similarity: 0.95,
      isMatch: true,
      confidence: 'high',
      matchType: 'variation'
    };
  }

  // Calculate fuzzy similarity
  const similarity = calculateSimilarity(normalized1, normalized2);

  // Determine match confidence
  let confidence: 'high' | 'medium' | 'low';
  let isMatch = false;

  if (similarity >= 0.9) {
    confidence = 'high';
    isMatch = true;
  } else if (similarity >= 0.8) {
    confidence = 'high';
    isMatch = true;
  } else if (similarity >= 0.7) {
    confidence = 'medium';
    isMatch = true;
  } else if (similarity >= 0.6) {
    confidence = 'low';
    isMatch = true;
  } else {
    confidence = 'low';
    isMatch = false;
  }

  return {
    similarity,
    isMatch,
    confidence,
    matchType: 'fuzzy'
  };
}

/**
 * Check for specific company name variations (e.g., Viewpoint variations)
 */
export function checkCompanyVariations(name1: string, name2: string): FuzzyMatchResult {
  const variations = {
    'viewpoint': ['viewpoint', 'viewpoint vc', 'viewpoint ventures', 'view point', 'vp'],
    'microsoft': ['microsoft', 'microsoft corp', 'microsoft corporation', 'msft'],
    'google': ['google', 'google inc', 'google llc', 'alphabet'],
    'amazon': ['amazon', 'amazon.com', 'amazon inc', 'aws'],
    // Add more known variations as needed
  };

  const norm1 = normalizeCompanyName(name1);
  const norm2 = normalizeCompanyName(name2);

  for (const [canonical, variants] of Object.entries(variations)) {
    const isName1Variant = variants.some(variant => norm1.includes(variant) || variant.includes(norm1));
    const isName2Variant = variants.some(variant => norm2.includes(variant) || variant.includes(norm2));

    if (isName1Variant && isName2Variant) {
      return {
        similarity: 0.95,
        isMatch: true,
        confidence: 'high',
        matchType: 'variation'
      };
    }
  }

  // Fallback to regular fuzzy matching
  return fuzzyMatchCompanyNames(name1, name2);
}

/**
 * DATE PROXIMITY CALCULATIONS
 */

/**
 * Calculate date proximity between two dates
 */
export function calculateDateProximity(date1: string | Date, date2: string | Date, thresholdDays: number = 3): DateProximityResult {
  try {
    const d1 = typeof date1 === 'string' ? parseISO(date1) : date1;
    const d2 = typeof date2 === 'string' ? parseISO(date2) : date2;

    if (!isValid(d1) || !isValid(d2)) {
      return {
        daysDifference: Infinity,
        isWithinThreshold: false,
        proximityScore: 0,
        confidence: 'low'
      };
    }

    const daysDifference = Math.abs(differenceInDays(d1, d2));
    const isWithinThreshold = daysDifference <= thresholdDays;

    // Calculate proximity score (30 max points)
    let proximityScore = 0;
    let confidence: 'high' | 'medium' | 'low' = 'low';

    if (daysDifference === 0) {
      proximityScore = 30;
      confidence = 'high';
    } else if (daysDifference <= 1) {
      proximityScore = 25;
      confidence = 'high';
    } else if (daysDifference <= 3) {
      proximityScore = 20;
      confidence = 'medium';
    } else if (daysDifference <= 7) {
      proximityScore = 10;
      confidence = 'low';
    } else if (daysDifference <= 14) {
      proximityScore = 5;
      confidence = 'low';
    }

    return {
      daysDifference,
      isWithinThreshold,
      proximityScore,
      confidence
    };
  } catch (error) {
    logger.error('Error calculating date proximity:', error);
    return {
      daysDifference: Infinity,
      isWithinThreshold: false,
      proximityScore: 0,
      confidence: 'low'
    };
  }
}

/**
 * AMOUNT SIMILARITY FUNCTIONS
 */

/**
 * Calculate amount similarity between two values
 */
export function calculateAmountSimilarity(amount1: number, amount2: number, tolerancePercent: number = 10): AmountSimilarityResult {
  if (!amount1 || !amount2 || amount1 <= 0 || amount2 <= 0) {
    return {
      percentageDifference: 100,
      isSimilar: false,
      similarityScore: 0,
      confidence: 'low'
    };
  }

  const largerAmount = Math.max(amount1, amount2);
  const percentageDifference = Math.abs(amount1 - amount2) / largerAmount * 100;
  const isSimilar = percentageDifference <= tolerancePercent;

  // Calculate similarity score (30 max points)
  let similarityScore = 0;
  let confidence: 'high' | 'medium' | 'low' = 'low';

  if (percentageDifference <= 5) {
    similarityScore = 30;
    confidence = 'high';
  } else if (percentageDifference <= 10) {
    similarityScore = 20;
    confidence = 'medium';
  } else if (percentageDifference <= 20) {
    similarityScore = 10;
    confidence = 'low';
  } else if (percentageDifference <= 50) {
    similarityScore = 5;
    confidence = 'low';
  }

  return {
    percentageDifference,
    isSimilar,
    similarityScore,
    confidence
  };
}

/**
 * CONFIDENCE SCORING LOGIC
 */

/**
 * Calculate comprehensive confidence score for a potential match
 */
export function calculateConfidenceScore(
  activityClientName: string,
  dealCompanyName: string,
  activityDate: string | Date,
  dealDate: string | Date,
  activityAmount?: number,
  dealAmount?: number
): ConfidenceScore {
  // Name matching (40 points max)
  const nameMatch = checkCompanyVariations(activityClientName, dealCompanyName);
  const nameScore = Math.round(nameMatch.similarity * 40);

  // Date proximity (30 points max)
  const dateProximity = calculateDateProximity(activityDate, dealDate);
  const dateScore = dateProximity.proximityScore;

  // Amount similarity (30 points max)
  let amountScore = 0;
  if (activityAmount && dealAmount) {
    const amountSimilarity = calculateAmountSimilarity(activityAmount, dealAmount);
    amountScore = amountSimilarity.similarityScore;
  }

  // Total score (100 max)
  const totalScore = nameScore + dateScore + amountScore;

  // Determine confidence level
  let level: 'high_confidence' | 'medium_confidence' | 'low_confidence';
  let isRecommended = false;

  if (totalScore >= 80) {
    level = 'high_confidence';
    isRecommended = true;
  } else if (totalScore >= 60) {
    level = 'medium_confidence';
    isRecommended = true;
  } else if (totalScore >= 40) {
    level = 'low_confidence';
    isRecommended = false;
  } else {
    level = 'low_confidence';
    isRecommended = false;
  }

  return {
    nameScore,
    dateScore,
    amountScore,
    totalScore,
    level,
    isRecommended
  };
}

/**
 * Generate match reasons and risk assessments
 */
export function generateMatchAnalysis(
  activityClientName: string,
  dealCompanyName: string,
  activityDate: string | Date,
  dealDate: string | Date,
  activityAmount?: number,
  dealAmount?: number
): { reasons: string[]; risks: string[] } {
  const reasons: string[] = [];
  const risks: string[] = [];

  // Analyze name matching
  const nameMatch = checkCompanyVariations(activityClientName, dealCompanyName);
  if (nameMatch.similarity >= 0.9) {
    reasons.push(`Strong name match (${Math.round(nameMatch.similarity * 100)}% similarity)`);
  } else if (nameMatch.similarity >= 0.7) {
    reasons.push(`Good name match (${Math.round(nameMatch.similarity * 100)}% similarity)`);
    risks.push('Name similarity could be coincidental');
  } else {
    risks.push(`Low name similarity (${Math.round(nameMatch.similarity * 100)}%)`);
  }

  // Analyze date proximity
  const dateProximity = calculateDateProximity(activityDate, dealDate);
  if (dateProximity.daysDifference === 0) {
    reasons.push('Same date activity and deal');
  } else if (dateProximity.daysDifference <= 3) {
    reasons.push(`Close dates (${dateProximity.daysDifference} days apart)`);
  } else if (dateProximity.daysDifference <= 7) {
    reasons.push(`Recent dates (${dateProximity.daysDifference} days apart)`);
    risks.push('Date gap might indicate different transactions');
  } else {
    risks.push(`Large date gap (${dateProximity.daysDifference} days apart)`);
  }

  // Analyze amount similarity
  if (activityAmount && dealAmount) {
    const amountSimilarity = calculateAmountSimilarity(activityAmount, dealAmount);
    if (amountSimilarity.percentageDifference <= 5) {
      reasons.push('Very similar amounts');
    } else if (amountSimilarity.percentageDifference <= 10) {
      reasons.push(`Similar amounts (${Math.round(amountSimilarity.percentageDifference)}% difference)`);
    } else if (amountSimilarity.percentageDifference <= 20) {
      reasons.push(`Moderate amount difference (${Math.round(amountSimilarity.percentageDifference)}%)`);
      risks.push('Amount difference might indicate different deals');
    } else {
      risks.push(`Large amount difference (${Math.round(amountSimilarity.percentageDifference)}%)`);
    }
  } else {
    risks.push('Missing amount data for comparison');
  }

  return { reasons, risks };
}

/**
 * DATA TRANSFORMATION UTILITIES
 */

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, currency: string = 'GBP'): string {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return '£0.00';
  }
  
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0%';
  }
  
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format date for display
 */
export function formatDate(date: string | Date): string {
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(d)) return 'Invalid date';
    
    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(d);
  } catch (error) {
    return 'Invalid date';
  }
}

/**
 * Get confidence level color
 */
export function getConfidenceColor(level: string): string {
  switch (level) {
    case 'high_confidence':
    case 'high':
      return 'text-green-600 bg-green-50';
    case 'medium_confidence':
    case 'medium':
      return 'text-yellow-600 bg-yellow-50';
    case 'low_confidence':
    case 'low':
      return 'text-red-600 bg-red-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
}

/**
 * Get priority level color
 */
export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'revenue_risk':
    case 'high':
      return 'text-red-600 bg-red-50';
    case 'revenue_tracking':
    case 'medium':
      return 'text-yellow-600 bg-yellow-50';
    case 'data_integrity':
    case 'low':
      return 'text-blue-600 bg-blue-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
}

/**
 * VALIDATION UTILITIES
 */

/**
 * Validate reconciliation data consistency
 */
export function validateReconciliationData(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data) {
    errors.push('No data provided');
    return { isValid: false, errors };
  }

  // Validate required fields for activities
  if (data.type === 'activity') {
    if (!data.id) errors.push('Activity ID is required');
    if (!data.client_name) errors.push('Client name is required');
    if (!data.date) errors.push('Activity date is required');
    if (data.amount && typeof data.amount !== 'number') errors.push('Activity amount must be a number');
  }

  // Validate required fields for deals
  if (data.type === 'deal') {
    if (!data.id) errors.push('Deal ID is required');
    if (!data.company) errors.push('Company name is required');
    if (!data.stage_changed_at) errors.push('Deal date is required');
    if (data.value && typeof data.value !== 'number') errors.push('Deal value must be a number');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Sanitize string for safe processing
 */
export function sanitizeString(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .trim()
    .replace(/[<>\"']/g, '') // Remove potential XSS characters
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * EXPORT UTILITIES
 */

/**
 * Export reconciliation data to CSV format
 */
export function exportToCSV(data: any[], filename: string = 'reconciliation_data.csv'): void {
  if (!data || data.length === 0) {
    logger.warn('No data to export');
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Handle arrays and objects
        if (Array.isArray(value)) {
          return `"${value.join(';')}"`;
        } else if (typeof value === 'object' && value !== null) {
          return `"${JSON.stringify(value)}"`;
        } else if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}