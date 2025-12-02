import { z } from 'zod';

export interface ProcessingResult {
  success: boolean;
  data?: any;
  error?: string;
  extractedFields?: Record<string, any>;
}

export interface ExtractionRule {
  field: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  path?: string; // JSONPath or dot notation for nested fields
  required?: boolean;
  transform?: (value: any) => any;
  validation?: z.ZodSchema;
}

/**
 * Parse JSON response from AI model
 */
export function parseJSONResponse(response: string): ProcessingResult {
  try {
    // Handle markdown code blocks
    const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/);
    const jsonString = jsonMatch ? jsonMatch[1] : response;
    
    // Clean up common issues
    const cleaned = jsonString
      .trim()
      .replace(/^[^{[]*/, '') // Remove text before JSON
      .replace(/[^}\]]*$/, ''); // Remove text after JSON
    
    const data = JSON.parse(cleaned);
    
    return {
      success: true,
      data
    };
  } catch (error) {
    // Try to extract JSON-like structures
    const jsonLikeMatch = response.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonLikeMatch) {
      try {
        const data = JSON.parse(jsonLikeMatch[0]);
        return {
          success: true,
          data
        };
      } catch {
        // Fall through to error
      }
    }
    
    return {
      success: false,
      error: `Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Extract specific fields from AI response
 */
export function extractFields(
  response: string | object,
  rules: ExtractionRule[]
): ProcessingResult {
  try {
    // Parse response if it's a string
    let data: any;
    if (typeof response === 'string') {
      const parseResult = parseJSONResponse(response);
      if (!parseResult.success) {
        // Try to extract fields from plain text
        return extractFieldsFromText(response, rules);
      }
      data = parseResult.data;
    } else {
      data = response;
    }
    
    const extractedFields: Record<string, any> = {};
    const errors: string[] = [];
    
    for (const rule of rules) {
      try {
        // Extract value using path or direct field
        let value: any;
        if (rule.path) {
          value = getValueByPath(data, rule.path);
        } else {
          value = data[rule.field];
        }
        
        // Check if required
        if (rule.required && value === undefined) {
          errors.push(`Required field '${rule.field}' is missing`);
          continue;
        }
        
        // Apply transformation
        if (rule.transform && value !== undefined) {
          value = rule.transform(value);
        }
        
        // Validate with Zod schema if provided
        if (rule.validation && value !== undefined) {
          const result = rule.validation.safeParse(value);
          if (!result.success) {
            errors.push(`Validation failed for '${rule.field}': ${result.error.message}`);
            continue;
          }
          value = result.data;
        }
        
        // Type coercion
        if (value !== undefined) {
          switch (rule.type) {
            case 'number':
              value = Number(value);
              if (isNaN(value)) {
                errors.push(`Field '${rule.field}' could not be converted to number`);
                continue;
              }
              break;
            case 'boolean':
              value = Boolean(value);
              break;
            case 'string':
              value = String(value);
              break;
          }
        }
        
        extractedFields[rule.field] = value;
      } catch (error) {
        errors.push(`Error processing field '${rule.field}': ${error}`);
      }
    }
    
    if (errors.length > 0) {
      return {
        success: false,
        error: errors.join('; '),
        extractedFields
      };
    }
    
    return {
      success: true,
      extractedFields
    };
  } catch (error) {
    return {
      success: false,
      error: `Field extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Extract fields from plain text response
 */
function extractFieldsFromText(text: string, rules: ExtractionRule[]): ProcessingResult {
  const extractedFields: Record<string, any> = {};
  const errors: string[] = [];
  
  for (const rule of rules) {
    try {
      let value: any;
      
      // Try to extract using patterns
      const patterns: Record<string, RegExp> = {
        email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/i,
        phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,
        url: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/,
        number: /\b\d+\.?\d*\b/,
        boolean: /\b(true|false|yes|no)\b/i,
        date: /\b\d{4}-\d{2}-\d{2}\b|\b\d{2}\/\d{2}\/\d{4}\b/
      };
      
      // Look for field name followed by value
      const fieldPattern = new RegExp(`${rule.field}[:\\s]+([^\\n,]+)`, 'i');
      const match = text.match(fieldPattern);
      
      if (match) {
        value = match[1].trim();
      } else if (patterns[rule.field]) {
        // Try pattern matching for common field types
        const patternMatch = text.match(patterns[rule.field]);
        if (patternMatch) {
          value = patternMatch[0];
        }
      }
      
      // Apply type conversion
      if (value !== undefined) {
        switch (rule.type) {
          case 'number':
            value = parseFloat(value.replace(/[^\d.-]/g, ''));
            if (isNaN(value)) {
              value = undefined;
            }
            break;
          case 'boolean':
            value = /true|yes/i.test(value);
            break;
        }
      }
      
      if (rule.required && value === undefined) {
        errors.push(`Required field '${rule.field}' not found in text`);
      } else if (value !== undefined) {
        extractedFields[rule.field] = value;
      }
    } catch (error) {
      errors.push(`Error extracting '${rule.field}' from text: ${error}`);
    }
  }
  
  return {
    success: errors.length === 0,
    error: errors.length > 0 ? errors.join('; ') : undefined,
    extractedFields
  };
}

/**
 * Get value from nested object using path
 */
function getValueByPath(obj: any, path: string): any {
  const keys = path.split('.');
  let value = obj;
  
  for (const key of keys) {
    if (value === null || value === undefined) {
      return undefined;
    }
    
    // Handle array indexing
    const arrayMatch = key.match(/^(.+)\[(\d+)\]$/);
    if (arrayMatch) {
      value = value[arrayMatch[1]];
      if (Array.isArray(value)) {
        value = value[parseInt(arrayMatch[2])];
      } else {
        return undefined;
      }
    } else {
      value = value[key];
    }
  }
  
  return value;
}

/**
 * Validate response against a schema
 */
export function validateResponse(
  response: any,
  schema: z.ZodSchema
): ProcessingResult {
  try {
    const result = schema.safeParse(response);
    
    if (result.success) {
      return {
        success: true,
        data: result.data
      };
    } else {
      return {
        success: false,
        error: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Process response with retry logic
 */
export async function processWithRetry<T>(
  processFn: () => Promise<T>,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<{ success: boolean; data?: T; error?: string }> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const data = await processFn();
      return { success: true, data };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt < maxRetries) {
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt - 1)));
      }
    }
  }
  
  return {
    success: false,
    error: `Failed after ${maxRetries} attempts: ${lastError?.message}`
  };
}

/**
 * Common extraction patterns for CRM data
 */
export const CRM_EXTRACTION_RULES: Record<string, ExtractionRule[]> = {
  lead: [
    { field: 'name', type: 'string', required: true },
    { field: 'email', type: 'string', required: false },
    { field: 'phone', type: 'string', required: false },
    { field: 'company', type: 'string', required: false },
    { field: 'score', type: 'number', required: false, path: 'qualification.score' },
    { field: 'qualified', type: 'boolean', required: true, path: 'qualification.isQualified' }
  ],
  
  task: [
    { field: 'title', type: 'string', required: true },
    { field: 'description', type: 'string', required: false },
    { field: 'priority', type: 'string', required: true },
    { field: 'dueDate', type: 'string', required: false },
    { field: 'assignee', type: 'string', required: false }
  ],
  
  meeting: [
    { field: 'summary', type: 'string', required: true },
    { field: 'actionItems', type: 'array', required: false },
    { field: 'attendees', type: 'array', required: false },
    { field: 'nextSteps', type: 'string', required: false },
    { field: 'followUpDate', type: 'string', required: false }
  ],
  
  email: [
    { field: 'subject', type: 'string', required: true },
    { field: 'body', type: 'string', required: true },
    { field: 'to', type: 'array', required: true },
    { field: 'cc', type: 'array', required: false },
    { field: 'attachments', type: 'array', required: false }
  ]
};