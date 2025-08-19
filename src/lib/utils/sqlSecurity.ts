/**
 * SQL Security Utilities
 * 
 * This module provides security utilities to prevent SQL injection attacks
 * and ensure safe database query construction with Supabase.
 */

export interface ValidationResult {
  isValid: boolean;
  sanitized: string;
  error?: string;
}

/**
 * Validates and sanitizes input for use in database queries
 * 
 * @param input - The input string to validate and sanitize
 * @param options - Validation options
 * @returns ValidationResult with sanitized string if valid
 */
export function validateAndSanitizeInput(
  input: string,
  options: {
    maxLength?: number;
    allowWildcards?: boolean;
    allowSpecialChars?: boolean;
    fieldName?: string;
  } = {}
): ValidationResult {
  const {
    maxLength = 255,
    allowWildcards = false,
    allowSpecialChars = false,
    fieldName = 'input'
  } = options;

  if (!input) {
    return { 
      isValid: false, 
      sanitized: '', 
      error: `${fieldName} is required` 
    };
  }

  // Remove leading/trailing whitespace
  const trimmed = input.trim();

  // Check length constraints
  if (trimmed.length > maxLength) {
    return { 
      isValid: false, 
      sanitized: '', 
      error: `${fieldName} is too long (maximum ${maxLength} characters)` 
    };
  }

  // Define allowed pattern based on options
  let pattern: RegExp;
  
  if (allowSpecialChars) {
    // Allow more characters for complex searches (emails, names with apostrophes, etc.)
    pattern = /^[a-zA-Z0-9\s\-_@.'"\(\)&\[\]]+$/;
  } else if (allowWildcards) {
    // Allow basic wildcards for search patterns
    pattern = /^[a-zA-Z0-9\s\-_%*]+$/;
  } else {
    // Basic alphanumeric with common safe characters
    pattern = /^[a-zA-Z0-9\s\-_]+$/;
  }

  if (!pattern.test(trimmed)) {
    const allowedChars = allowSpecialChars 
      ? 'letters, numbers, spaces, hyphens, underscores, @, periods, quotes, parentheses, and brackets'
      : allowWildcards
      ? 'letters, numbers, spaces, hyphens, underscores, and wildcards (%, *)'
      : 'letters, numbers, spaces, hyphens, and underscores';
    
    return { 
      isValid: false, 
      sanitized: '', 
      error: `${fieldName} contains invalid characters. Only ${allowedChars} are allowed.` 
    };
  }

  return { isValid: true, sanitized: trimmed };
}

/**
 * Safely constructs an OR clause for Supabase queries with proper escaping
 * 
 * @param conditions - Array of condition objects
 * @returns Safely constructed OR clause string
 */
export function buildSafeOrClause(conditions: Array<{
  field: string;
  operator: 'eq' | 'ilike' | 'like' | 'gt' | 'gte' | 'lt' | 'lte' | 'neq';
  value: string;
  useWildcards?: boolean;
}>): string {
  const safeConditions = conditions.map(({ field, operator, value, useWildcards = false }) => {
    // Validate field name (should be alphanumeric with underscores only)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field)) {
      throw new Error(`Invalid field name: ${field}`);
    }

    // Validate operator
    const validOperators = ['eq', 'ilike', 'like', 'gt', 'gte', 'lt', 'lte', 'neq'];
    if (!validOperators.includes(operator)) {
      throw new Error(`Invalid operator: ${operator}`);
    }

    // Sanitize value
    const validation = validateAndSanitizeInput(value, {
      allowWildcards: useWildcards && (operator === 'ilike' || operator === 'like'),
      allowSpecialChars: operator === 'ilike' || operator === 'like',
      fieldName: `value for ${field}`
    });

    if (!validation.isValid) {
      throw new Error(validation.error || `Invalid value for ${field}`);
    }

    // Escape the value and construct the condition
    let escapedValue = validation.sanitized;
    
    // For ILIKE/LIKE operations, add wildcards if requested
    if ((operator === 'ilike' || operator === 'like') && useWildcards) {
      escapedValue = `%${escapedValue}%`;
    }

    // Double-quote the value to prevent injection
    return `${field}.${operator}."${escapedValue}"`;
  });

  return safeConditions.join(',');
}

/**
 * Validates company ID specifically
 */
export function validateCompanyId(companyId: string): ValidationResult {
  return validateAndSanitizeInput(companyId, {
    maxLength: 255,
    allowWildcards: false,
    allowSpecialChars: false,
    fieldName: 'Company ID'
  });
}

/**
 * Validates search terms for safe use in queries
 */
export function validateSearchTerm(searchTerm: string): ValidationResult {
  return validateAndSanitizeInput(searchTerm, {
    maxLength: 500,
    allowWildcards: true,
    allowSpecialChars: true,
    fieldName: 'Search term'
  });
}

/**
 * Validates email addresses for database queries
 */
export function validateEmail(email: string): ValidationResult {
  if (!email) {
    return { 
      isValid: false, 
      sanitized: '', 
      error: 'Email is required' 
    };
  }

  const trimmed = email.trim();

  // Check length constraints
  if (trimmed.length > 255) {
    return { 
      isValid: false, 
      sanitized: '', 
      error: 'Email is too long (maximum 255 characters)' 
    };
  }

  // Basic email pattern validation - more permissive for email addresses
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailPattern.test(trimmed)) {
    return {
      isValid: false,
      sanitized: '',
      error: 'Invalid email format'
    };
  }

  return { isValid: true, sanitized: trimmed };
}

/**
 * Creates a safe query builder for common search patterns
 */
export class SafeQueryBuilder {
  private conditions: Array<{
    field: string;
    operator: 'eq' | 'ilike' | 'like' | 'gt' | 'gte' | 'lt' | 'lte' | 'neq';
    value: string;
    useWildcards?: boolean;
  }> = [];

  /**
   * Add an equality condition
   */
  addEqualCondition(field: string, value: string): this {
    this.conditions.push({ field, operator: 'eq', value });
    return this;
  }

  /**
   * Add a case-insensitive LIKE condition with wildcards
   */
  addSearchCondition(field: string, value: string): this {
    this.conditions.push({ 
      field, 
      operator: 'ilike', 
      value, 
      useWildcards: true 
    });
    return this;
  }

  /**
   * Build the safe OR clause
   */
  buildOrClause(): string {
    if (this.conditions.length === 0) {
      throw new Error('No conditions added to query builder');
    }
    return buildSafeOrClause(this.conditions);
  }

  /**
   * Reset the builder
   */
  reset(): this {
    this.conditions = [];
    return this;
  }
}