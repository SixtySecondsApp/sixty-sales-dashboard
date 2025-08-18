/**
 * FINANCIAL DATA VALIDATION UTILITIES
 * 
 * Critical security utility for validating financial data to prevent
 * corruption of financial calculations and malicious data injection.
 * 
 * Security Features:
 * - Robust number parsing and validation
 * - Range validation for financial amounts
 * - Edge case handling (NaN, Infinity, null, undefined)
 * - Comprehensive error logging with severity levels
 * - Type-safe validation with TypeScript
 */

export interface ValidationResult {
  isValid: boolean;
  value: number;
  originalValue: any;
  errors: string[];
  warnings: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface FinancialValidationOptions {
  allowNegative?: boolean;
  minValue?: number;
  maxValue?: number;
  allowZero?: boolean;
  fieldName?: string;
  logErrors?: boolean;
}

// Default validation configuration for different financial fields
export const FINANCIAL_FIELD_CONFIGS = {
  revenue: {
    allowNegative: false,
    minValue: 0,
    maxValue: 10_000_000, // £10M max
    allowZero: true,
    fieldName: 'revenue'
  },
  mrr: {
    allowNegative: false,
    minValue: 0,
    maxValue: 1_000_000, // £1M monthly max
    allowZero: true,
    fieldName: 'monthly_mrr'
  },
  dealValue: {
    allowNegative: false,
    minValue: 0,
    maxValue: 10_000_000, // £10M max
    allowZero: true,
    fieldName: 'deal_value'
  },
  subscriptionAmount: {
    allowNegative: false,
    minValue: 0,
    maxValue: 500_000, // £500K monthly max
    allowZero: true,
    fieldName: 'subscription_amount'
  }
} as const;

/**
 * Enhanced financial data logger with severity levels
 */
class FinancialLogger {
  private static logLevel: 'debug' | 'info' | 'warn' | 'error' = 'warn';

  static setLogLevel(level: 'debug' | 'info' | 'warn' | 'error') {
    this.logLevel = level;
  }

  static log(severity: 'low' | 'medium' | 'high' | 'critical', message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      severity,
      message,
      data,
      source: 'FinancialValidation'
    };

    // Console logging based on severity
    switch (severity) {
      case 'critical':
        console.error('🚨 CRITICAL FINANCIAL ERROR:', logEntry);
        // In production, this would also alert monitoring systems
        break;
      case 'high':
        console.error('❌ HIGH FINANCIAL ERROR:', logEntry);
        break;
      case 'medium':
        console.warn('⚠️ MEDIUM FINANCIAL WARNING:', logEntry);
        break;
      case 'low':
        if (this.logLevel === 'debug') {
          console.info('ℹ️ LOW FINANCIAL INFO:', logEntry);
        }
        break;
    }

    // Store in session storage for debugging (limit to last 100 entries)
    try {
      const stored = JSON.parse(sessionStorage.getItem('financial_validation_logs') || '[]');
      stored.push(logEntry);
      if (stored.length > 100) stored.shift();
      sessionStorage.setItem('financial_validation_logs', JSON.stringify(stored));
    } catch (e) {
      // Ignore storage errors
    }
  }

  static getLogs(): any[] {
    try {
      return JSON.parse(sessionStorage.getItem('financial_validation_logs') || '[]');
    } catch (e) {
      return [];
    }
  }

  static clearLogs() {
    sessionStorage.removeItem('financial_validation_logs');
  }
}

/**
 * Core financial number validation function
 * Handles all edge cases and provides comprehensive validation
 */
export function validateFinancialNumber(
  value: any,
  options: FinancialValidationOptions = {}
): ValidationResult {
  const {
    allowNegative = false,
    minValue = 0,
    maxValue = Number.MAX_SAFE_INTEGER,
    allowZero = true,
    fieldName = 'financial_field',
    logErrors = true
  } = options;

  const result: ValidationResult = {
    isValid: false,
    value: 0,
    originalValue: value,
    errors: [],
    warnings: [],
    severity: 'low'
  };

  // Phase 1: Handle null/undefined/empty values
  if (value === null || value === undefined || value === '') {
    result.value = 0;
    result.isValid = allowZero;
    if (!allowZero) {
      result.errors.push(`${fieldName} cannot be empty`);
      result.severity = 'medium';
    }
    if (logErrors && result.errors.length > 0) {
      FinancialLogger.log(result.severity, `Empty value for ${fieldName}`, { value, options });
    }
    return result;
  }

  // Phase 2: Handle boolean values (potential attack vector)
  if (typeof value === 'boolean') {
    result.errors.push(`${fieldName} cannot be a boolean value`);
    result.severity = 'high';
    if (logErrors) {
      FinancialLogger.log('high', `Boolean value detected for ${fieldName}`, { value, options });
    }
    return result;
  }

  // Phase 3: Handle array/object values (potential attack vector)
  if (typeof value === 'object' && value !== null) {
    result.errors.push(`${fieldName} cannot be an object or array`);
    result.severity = 'critical';
    if (logErrors) {
      FinancialLogger.log('critical', `Object/array value detected for ${fieldName}`, { value, options });
    }
    return result;
  }

  // Phase 4: Convert to number with robust parsing
  let numericValue: number;

  if (typeof value === 'string') {
    // Remove common currency symbols and whitespace
    const cleanedValue = value
      .replace(/[£$€,\s]/g, '')
      .replace(/[^\d.-]/g, ''); // Only allow digits, decimal points, and minus

    // Check for multiple decimal points
    if ((cleanedValue.match(/\./g) || []).length > 1) {
      result.errors.push(`${fieldName} has invalid decimal format`);
      result.severity = 'high';
      if (logErrors) {
        FinancialLogger.log('high', `Multiple decimal points in ${fieldName}`, { value, cleanedValue, options });
      }
      return result;
    }

    // Check for multiple minus signs or invalid minus position
    const minusCount = (cleanedValue.match(/-/g) || []).length;
    if (minusCount > 1 || (minusCount === 1 && !cleanedValue.startsWith('-'))) {
      result.errors.push(`${fieldName} has invalid negative format`);
      result.severity = 'high';
      if (logErrors) {
        FinancialLogger.log('high', `Invalid negative format in ${fieldName}`, { value, cleanedValue, options });
      }
      return result;
    }

    numericValue = parseFloat(cleanedValue);
  } else {
    numericValue = Number(value);
  }

  // Phase 5: Check for NaN
  if (isNaN(numericValue)) {
    result.errors.push(`${fieldName} is not a valid number`);
    result.severity = 'high';
    if (logErrors) {
      FinancialLogger.log('high', `NaN detected for ${fieldName}`, { value, numericValue, options });
    }
    return result;
  }

  // Phase 6: Check for Infinity
  if (!isFinite(numericValue)) {
    result.errors.push(`${fieldName} cannot be infinite`);
    result.severity = 'critical';
    if (logErrors) {
      FinancialLogger.log('critical', `Infinite value detected for ${fieldName}`, { value, numericValue, options });
    }
    return result;
  }

  // Phase 7: Check for unsafe integers (potential precision loss)
  if (!Number.isSafeInteger(numericValue * 100)) { // Check precision to 2 decimal places
    result.warnings.push(`${fieldName} may lose precision due to size`);
    result.severity = Math.max(result.severity === 'low' ? 0 : 1, 1) === 0 ? 'low' : 'medium';
    if (logErrors) {
      FinancialLogger.log('medium', `Unsafe integer precision for ${fieldName}`, { value, numericValue, options });
    }
  }

  // Phase 8: Check negative values
  if (numericValue < 0 && !allowNegative) {
    result.errors.push(`${fieldName} cannot be negative`);
    result.severity = 'medium';
    if (logErrors) {
      FinancialLogger.log('medium', `Negative value not allowed for ${fieldName}`, { value, numericValue, options });
    }
    return result;
  }

  // Phase 9: Check zero values
  if (numericValue === 0 && !allowZero) {
    result.errors.push(`${fieldName} cannot be zero`);
    result.severity = 'medium';
    if (logErrors) {
      FinancialLogger.log('medium', `Zero value not allowed for ${fieldName}`, { value, numericValue, options });
    }
    return result;
  }

  // Phase 10: Check range constraints
  if (numericValue < minValue) {
    result.errors.push(`${fieldName} must be at least ${minValue}`);
    result.severity = 'medium';
    if (logErrors) {
      FinancialLogger.log('medium', `Value below minimum for ${fieldName}`, { value, numericValue, minValue, options });
    }
    return result;
  }

  if (numericValue > maxValue) {
    result.errors.push(`${fieldName} cannot exceed ${maxValue}`);
    result.severity = 'high';
    if (logErrors) {
      FinancialLogger.log('high', `Value exceeds maximum for ${fieldName}`, { value, numericValue, maxValue, options });
    }
    return result;
  }

  // Phase 11: Check for suspicious patterns
  if (numericValue > 1_000_000) {
    result.warnings.push(`${fieldName} is unusually large (>£1M)`);
    if (logErrors) {
      FinancialLogger.log('low', `Unusually large value for ${fieldName}`, { value, numericValue, options });
    }
  }

  // Round to 2 decimal places to avoid floating point issues
  numericValue = Math.round(numericValue * 100) / 100;

  // Success case
  result.isValid = true;
  result.value = numericValue;

  if (logErrors && (result.warnings.length > 0 || value !== numericValue)) {
    FinancialLogger.log('low', `Successfully validated ${fieldName}`, { 
      originalValue: value, 
      validatedValue: numericValue, 
      warnings: result.warnings,
      options 
    });
  }

  return result;
}

/**
 * Validate revenue amounts (one-off revenue, annual revenue, etc.)
 */
export function validateRevenue(value: any): ValidationResult {
  return validateFinancialNumber(value, FINANCIAL_FIELD_CONFIGS.revenue);
}

/**
 * Validate monthly recurring revenue (MRR)
 */
export function validateMRR(value: any): ValidationResult {
  return validateFinancialNumber(value, FINANCIAL_FIELD_CONFIGS.mrr);
}

/**
 * Validate deal values
 */
export function validateDealValue(value: any): ValidationResult {
  return validateFinancialNumber(value, FINANCIAL_FIELD_CONFIGS.dealValue);
}

/**
 * Validate subscription amounts
 */
export function validateSubscriptionAmount(value: any): ValidationResult {
  return validateFinancialNumber(value, FINANCIAL_FIELD_CONFIGS.subscriptionAmount);
}

/**
 * Safely parse financial value with fallback
 * Returns a safe numeric value even if validation fails
 */
export function safeParseFinancial(
  value: any, 
  fallback: number = 0,
  options?: FinancialValidationOptions
): number {
  const validation = validateFinancialNumber(value, options);
  
  if (validation.isValid) {
    return validation.value;
  }
  
  // Log the fallback usage
  FinancialLogger.log('medium', `Using fallback value for financial data`, {
    originalValue: value,
    fallbackValue: fallback,
    errors: validation.errors,
    fieldName: options?.fieldName || 'unknown'
  });
  
  return fallback;
}

/**
 * Validate multiple financial fields at once
 * Useful for validating entire financial objects
 */
export function validateFinancialObject(data: Record<string, any>): {
  isValid: boolean;
  validatedData: Record<string, number>;
  errors: Record<string, string[]>;
  warnings: Record<string, string[]>;
  overallSeverity: 'low' | 'medium' | 'high' | 'critical';
} {
  const validatedData: Record<string, number> = {};
  const errors: Record<string, string[]> = {};
  const warnings: Record<string, string[]> = {};
  let overallSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low';
  let isValid = true;

  // Map fields to their validation configs
  const fieldMappings: Record<string, FinancialValidationOptions> = {
    one_off_revenue: FINANCIAL_FIELD_CONFIGS.revenue,
    monthly_mrr: FINANCIAL_FIELD_CONFIGS.mrr,
    annual_value: FINANCIAL_FIELD_CONFIGS.revenue,
    deal_value: FINANCIAL_FIELD_CONFIGS.dealValue,
    subscription_amount: FINANCIAL_FIELD_CONFIGS.subscriptionAmount,
    lifetime_deal_value: FINANCIAL_FIELD_CONFIGS.dealValue
  };

  for (const [key, value] of Object.entries(data)) {
    const config = fieldMappings[key] || { fieldName: key };
    const validation = validateFinancialNumber(value, { ...config, fieldName: key });
    
    validatedData[key] = validation.value;
    
    if (validation.errors.length > 0) {
      errors[key] = validation.errors;
      isValid = false;
    }
    
    if (validation.warnings.length > 0) {
      warnings[key] = validation.warnings;
    }
    
    // Update overall severity
    const severityLevels = { low: 0, medium: 1, high: 2, critical: 3 };
    if (severityLevels[validation.severity] > severityLevels[overallSeverity]) {
      overallSeverity = validation.severity;
    }
  }

  return {
    isValid,
    validatedData,
    errors,
    warnings,
    overallSeverity
  };
}

/**
 * Calculate lifetime deal value with validated inputs
 * Implements business rule: (3x monthly subscription) + (1x one-time payment)
 */
export function calculateLifetimeValue(monthlyMRR: any, oneOffRevenue: any): {
  value: number;
  isValid: boolean;
  errors: string[];
} {
  const mrrValidation = validateMRR(monthlyMRR);
  const revenueValidation = validateRevenue(oneOffRevenue);
  
  const errors: string[] = [];
  
  if (!mrrValidation.isValid) {
    errors.push(...mrrValidation.errors.map(err => `MRR: ${err}`));
  }
  
  if (!revenueValidation.isValid) {
    errors.push(...revenueValidation.errors.map(err => `One-off Revenue: ${err}`));
  }
  
  const validMRR = mrrValidation.isValid ? mrrValidation.value : 0;
  const validRevenue = revenueValidation.isValid ? revenueValidation.value : 0;
  
  const lifetimeValue = (validMRR * 3) + validRevenue;
  
  // Validate the calculated result
  const lifetimeValidation = validateDealValue(lifetimeValue);
  
  if (!lifetimeValidation.isValid) {
    errors.push(...lifetimeValidation.errors.map(err => `Lifetime Value: ${err}`));
  }
  
  return {
    value: lifetimeValidation.value,
    isValid: errors.length === 0,
    errors
  };
}

// Export the logger for external use
export { FinancialLogger };

// Utility function to check if financial validation is healthy
export function getFinancialValidationHealth() {
  const logs = FinancialLogger.getLogs();
  const recentLogs = logs.filter(log => 
    new Date(log.timestamp).getTime() > Date.now() - (24 * 60 * 60 * 1000) // Last 24 hours
  );
  
  const criticalCount = recentLogs.filter(log => log.severity === 'critical').length;
  const highCount = recentLogs.filter(log => log.severity === 'high').length;
  const mediumCount = recentLogs.filter(log => log.severity === 'medium').length;
  
  let status: 'healthy' | 'warning' | 'critical' = 'healthy';
  
  if (criticalCount > 0 || highCount > 10) {
    status = 'critical';
  } else if (highCount > 0 || mediumCount > 50) {
    status = 'warning';
  }
  
  return {
    status,
    totalLogs: logs.length,
    recentLogs: recentLogs.length,
    severityCounts: {
      critical: criticalCount,
      high: highCount,
      medium: mediumCount,
      low: recentLogs.filter(log => log.severity === 'low').length
    }
  };
}