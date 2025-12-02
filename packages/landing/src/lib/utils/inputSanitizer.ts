/**
 * Input Sanitization Utility
 * 
 * Provides secure input sanitization using DOMPurify to prevent XSS attacks
 * and other malicious input injections as recommended in the security audit.
 * 
 * Based on audit findings: Phase 2 Security - Input validation gaps (65% score)
 * Target: Implement comprehensive input sanitization for all form inputs
 */

import DOMPurify from 'dompurify';
import logger from './logger';

// Configuration for different contexts
const SANITIZE_CONFIG = {
  // Basic text sanitization - removes all HTML
  text: {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true
  },
  
  // Rich text sanitization - allows safe HTML tags
  richText: {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    ALLOWED_ATTR: ['class'],
    KEEP_CONTENT: true
  },
  
  // URL sanitization - ensures safe URLs
  url: {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
  }
} as const;

/**
 * Sanitize basic text input - removes all HTML tags
 */
export const sanitizeText = (input: string | null | undefined): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }

  try {
    return DOMPurify.sanitize(input, SANITIZE_CONFIG.text).trim();
  } catch (error) {
    logger.error('Text sanitization failed:', error);
    return '';
  }
};

/**
 * Sanitize rich text input - allows safe HTML tags
 */
export const sanitizeRichText = (input: string | null | undefined): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }

  try {
    return DOMPurify.sanitize(input, SANITIZE_CONFIG.richText);
  } catch (error) {
    logger.error('Rich text sanitization failed:', error);
    return '';
  }
};

/**
 * Sanitize URL input - ensures safe URLs
 */
export const sanitizeUrl = (input: string | null | undefined): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }

  try {
    const sanitized = DOMPurify.sanitize(input, SANITIZE_CONFIG.url).trim();
    
    // Additional URL validation
    if (sanitized && !sanitized.match(SANITIZE_CONFIG.url.ALLOWED_URI_REGEXP)) {
      logger.warn('Potentially unsafe URL blocked:', input);
      return '';
    }
    
    return sanitized;
  } catch (error) {
    logger.error('URL sanitization failed:', error);
    return '';
  }
};

/**
 * Sanitize object with multiple fields - applies appropriate sanitization to each field
 */
export const sanitizeFormData = <T extends Record<string, any>>(
  data: T,
  fieldConfig: Record<keyof T, 'text' | 'richText' | 'url' | 'skip'> = {}
): T => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  try {
    const sanitized = { ...data };
    
    Object.keys(sanitized).forEach(key => {
      const value = sanitized[key];
      const config = fieldConfig[key] || 'text'; // Default to text sanitization
      
      if (config === 'skip') {
        return; // Don't sanitize this field
      }
      
      if (typeof value === 'string') {
        switch (config) {
          case 'richText':
            sanitized[key] = sanitizeRichText(value);
            break;
          case 'url':
            sanitized[key] = sanitizeUrl(value);
            break;
          case 'text':
          default:
            sanitized[key] = sanitizeText(value);
            break;
        }
      }
    });
    
    return sanitized;
  } catch (error) {
    logger.error('Form data sanitization failed:', error);
    return data;
  }
};

/**
 * Validate and sanitize email addresses
 */
export const sanitizeEmail = (email: string | null | undefined): string => {
  if (!email || typeof email !== 'string') {
    return '';
  }

  const sanitized = sanitizeText(email);
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(sanitized)) {
    return '';
  }
  
  return sanitized.toLowerCase();
};

/**
 * Sanitize phone numbers - removes non-numeric characters except +, -, (, ), and spaces
 */
export const sanitizePhone = (phone: string | null | undefined): string => {
  if (!phone || typeof phone !== 'string') {
    return '';
  }

  // Remove all characters except digits, +, -, (, ), and spaces
  const sanitized = phone.replace(/[^0-9+\-() ]/g, '').trim();
  
  // Basic length validation (between 7 and 20 characters)
  if (sanitized.length < 7 || sanitized.length > 20) {
    return '';
  }
  
  return sanitized;
};

/**
 * SQL injection prevention - escapes special SQL characters
 * Note: This is a fallback - parameterized queries should be used instead
 */
export const escapeSqlInput = (input: string | null | undefined): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Basic SQL escape - replace single quotes
  return input.replace(/'/g, "''");
};

/**
 * Validate and sanitize numeric inputs
 */
export const sanitizeNumber = (
  input: string | number | null | undefined,
  options: { min?: number; max?: number; decimals?: number } = {}
): number | null => {
  if (input === null || input === undefined) {
    return null;
  }

  let num: number;
  
  if (typeof input === 'string') {
    // Remove non-numeric characters except decimal point and minus sign
    const cleaned = input.replace(/[^0-9.-]/g, '');
    num = parseFloat(cleaned);
  } else {
    num = input;
  }

  if (isNaN(num)) {
    return null;
  }

  // Apply constraints
  if (options.min !== undefined && num < options.min) {
    return options.min;
  }
  
  if (options.max !== undefined && num > options.max) {
    return options.max;
  }

  // Round to specified decimal places
  if (options.decimals !== undefined) {
    return Math.round(num * Math.pow(10, options.decimals)) / Math.pow(10, options.decimals);
  }

  return num;
};

/**
 * Configuration-based sanitization for different CRM form contexts
 */
export const CRM_FIELD_CONFIGS = {
  // Deal form fields
  dealForm: {
    name: 'text' as const,
    description: 'richText' as const,
    notes: 'richText' as const,
    company_name: 'text' as const,
    client_name: 'text' as const,
    contact_email: 'skip' as const, // Use sanitizeEmail instead
    website: 'url' as const,
    phone: 'skip' as const, // Use sanitizePhone instead
    one_off_revenue: 'skip' as const, // Use sanitizeNumber instead
    monthly_mrr: 'skip' as const, // Use sanitizeNumber instead
  },
  
  // Activity form fields
  activityForm: {
    type: 'text' as const,
    description: 'richText' as const,
    details: 'richText' as const,
    client_name: 'text' as const,
    notes: 'richText' as const,
    outcome: 'text' as const,
  },
  
  // Company form fields
  companyForm: {
    name: 'text' as const,
    description: 'richText' as const,
    website: 'url' as const,
    industry: 'text' as const,
    notes: 'richText' as const,
  },
  
  // Contact form fields
  contactForm: {
    name: 'text' as const,
    email: 'skip' as const, // Use sanitizeEmail instead
    phone: 'skip' as const, // Use sanitizePhone instead
    position: 'text' as const,
    notes: 'richText' as const,
  }
} as const;

/**
 * Convenience method for sanitizing CRM forms
 */
export const sanitizeCrmForm = <T extends Record<string, any>>(
  data: T,
  formType: keyof typeof CRM_FIELD_CONFIGS
): T => {
  return sanitizeFormData(data, CRM_FIELD_CONFIGS[formType]);
};

export default {
  sanitizeText,
  sanitizeRichText,
  sanitizeUrl,
  sanitizeFormData,
  sanitizeEmail,
  sanitizePhone,
  sanitizeNumber,
  sanitizeCrmForm,
  CRM_FIELD_CONFIGS
};