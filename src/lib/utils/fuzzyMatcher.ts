import { compareTwoStrings } from 'string-similarity';

export interface FuzzyMatchResult {
  id: string;
  score: number;
  field: string;
  value: string;
  originalValue: string;
  record: any;
}

export interface FuzzyMatchOptions {
  threshold?: number; // Minimum similarity score (0-1) to consider a match
  fields?: string[]; // Fields to check for duplicates
  normalize?: boolean; // Whether to normalize strings before comparison
}

/**
 * Normalize a company name for better matching
 * Removes common suffixes, special characters, and standardizes spacing
 */
export function normalizeCompanyName(name: string): string {
  if (!name) return '';
  
  return name
    .toLowerCase()
    // Remove common company suffixes
    .replace(/\b(inc|incorporated|llc|ltd|limited|corp|corporation|company|co|gmbh|ag|sa|plc|pty|pvt)\b\.?/gi, '')
    // Remove special characters except spaces
    .replace(/[^\w\s]/g, '')
    // Collapse multiple spaces into one
    .replace(/\s+/g, ' ')
    // Trim whitespace
    .trim();
}

/**
 * Normalize email for comparison (domain extraction)
 */
export function normalizeEmail(email: string): string {
  if (!email) return '';
  const domain = email.split('@')[1];
  return domain ? domain.toLowerCase() : email.toLowerCase();
}

/**
 * Normalize phone numbers for comparison
 */
export function normalizePhone(phone: string): string {
  if (!phone) return '';
  // Remove all non-numeric characters
  return phone.replace(/\D/g, '');
}

/**
 * Generate variations of a company name for fuzzy matching
 */
export function generateCompanyVariations(name: string): string[] {
  const normalized = normalizeCompanyName(name);
  const variations = [normalized];
  
  // Add variations with common misspellings or abbreviations
  const words = normalized.split(' ');
  
  // Single word variations
  if (words.length === 1) {
    const word = words[0];
    // Add common typos (first/last letter swaps)
    if (word.length > 3) {
      variations.push(word.slice(1) + word[0]); // Move first to end
      variations.push(word[word.length - 1] + word.slice(0, -1)); // Move last to start
    }
  }
  
  // Multi-word variations
  if (words.length > 1) {
    // Acronym
    const acronym = words.map(w => w[0]).join('');
    if (acronym.length > 1) {
      variations.push(acronym);
    }
    
    // First word only
    variations.push(words[0]);
    
    // Without first word (in case it's "The" or similar)
    if (words[0].length <= 3) {
      variations.push(words.slice(1).join(' '));
    }
  }
  
  return [...new Set(variations)]; // Remove duplicates
}

/**
 * Perform fuzzy matching on a collection of records
 */
export function fuzzyMatch(
  input: Record<string, any>,
  existingRecords: any[],
  options: FuzzyMatchOptions = {}
): FuzzyMatchResult[] {
  const {
    threshold = 0.7,
    fields = ['name', 'company', 'email', 'phone'],
    normalize = true
  } = options;
  
  const matches: FuzzyMatchResult[] = [];
  
  for (const record of existingRecords) {
    for (const field of fields) {
      const inputValue = input[field] || input[`client_${field}`] || input[`contact_${field}`];
      const recordValue = record[field] || record[`client_${field}`] || record[`contact_${field}`];
      
      if (!inputValue || !recordValue) continue;
      
      let normalizedInput = inputValue;
      let normalizedRecord = recordValue;
      
      if (normalize) {
        // Apply field-specific normalization
        if (field.includes('company') || field.includes('name') || field.includes('client')) {
          normalizedInput = normalizeCompanyName(inputValue);
          normalizedRecord = normalizeCompanyName(recordValue);
          
          // Check variations for company names
          const inputVariations = generateCompanyVariations(inputValue);
          const recordVariations = generateCompanyVariations(recordValue);
          
          // Find best match among variations
          let bestScore = 0;
          for (const iv of inputVariations) {
            for (const rv of recordVariations) {
              const score = compareTwoStrings(iv, rv);
              bestScore = Math.max(bestScore, score);
            }
          }
          
          if (bestScore >= threshold) {
            matches.push({
              id: record.id,
              score: bestScore,
              field,
              value: recordValue,
              originalValue: inputValue,
              record
            });
          }
        } else if (field.includes('email')) {
          // For emails, check domain similarity
          normalizedInput = normalizeEmail(inputValue);
          normalizedRecord = normalizeEmail(recordValue);
          
          const score = normalizedInput === normalizedRecord ? 1 : 
                       compareTwoStrings(normalizedInput, normalizedRecord);
          
          if (score >= threshold) {
            matches.push({
              id: record.id,
              score,
              field,
              value: recordValue,
              originalValue: inputValue,
              record
            });
          }
        } else if (field.includes('phone')) {
          // For phones, check numeric similarity
          normalizedInput = normalizePhone(inputValue);
          normalizedRecord = normalizePhone(recordValue);
          
          const score = normalizedInput === normalizedRecord ? 1 : 
                       compareTwoStrings(normalizedInput, normalizedRecord);
          
          if (score >= threshold) {
            matches.push({
              id: record.id,
              score,
              field,
              value: recordValue,
              originalValue: inputValue,
              record
            });
          }
        } else {
          // Generic string comparison
          const score = compareTwoStrings(
            normalize ? normalizedInput.toLowerCase() : normalizedInput,
            normalize ? normalizedRecord.toLowerCase() : normalizedRecord
          );
          
          if (score >= threshold) {
            matches.push({
              id: record.id,
              score,
              field,
              value: recordValue,
              originalValue: inputValue,
              record
            });
          }
        }
      }
    }
  }
  
  // Sort by score (highest first) and remove duplicates
  const uniqueMatches = new Map<string, FuzzyMatchResult>();
  matches.forEach(match => {
    const key = `${match.id}-${match.field}`;
    const existing = uniqueMatches.get(key);
    if (!existing || match.score > existing.score) {
      uniqueMatches.set(key, match);
    }
  });
  
  return Array.from(uniqueMatches.values())
    .sort((a, b) => b.score - a.score);
}

/**
 * Check if a new record is likely a duplicate of existing records
 */
export function checkForDuplicates(
  newRecord: Record<string, any>,
  existingRecords: any[],
  options: FuzzyMatchOptions = {}
): {
  isDuplicate: boolean;
  matches: FuzzyMatchResult[];
  confidence: number;
} {
  const matches = fuzzyMatch(newRecord, existingRecords, options);
  
  // Calculate overall confidence based on matches
  let confidence = 0;
  if (matches.length > 0) {
    // Higher confidence if multiple fields match
    const uniqueRecords = new Set(matches.map(m => m.id));
    const avgScore = matches.reduce((sum, m) => sum + m.score, 0) / matches.length;
    
    // Confidence factors:
    // - Average match score (0-1)
    // - Number of matching fields per record (more fields = higher confidence)
    // - Consistency (same record matching multiple fields)
    
    const recordFieldCounts = new Map<string, number>();
    matches.forEach(m => {
      recordFieldCounts.set(m.id, (recordFieldCounts.get(m.id) || 0) + 1);
    });
    
    const maxFieldMatches = Math.max(...recordFieldCounts.values());
    confidence = (avgScore * 0.6) + (maxFieldMatches / 4 * 0.4); // Assuming max 4 fields
    confidence = Math.min(confidence, 1); // Cap at 1
  }
  
  return {
    isDuplicate: confidence > 0.8, // High confidence threshold for auto-detection
    matches,
    confidence
  };
}

/**
 * Merge duplicate records intelligently
 */
export function mergeDuplicates(
  primary: Record<string, any>,
  secondary: Record<string, any>,
  preferPrimary: boolean = true
): Record<string, any> {
  const merged = { ...primary };
  
  // Merge strategy: Fill in missing fields from secondary
  for (const [key, value] of Object.entries(secondary)) {
    if (!merged[key] || (merged[key] === '' && value)) {
      merged[key] = value;
    } else if (!preferPrimary && value && value !== merged[key]) {
      // If not preferring primary, overwrite with secondary values
      merged[key] = value;
    }
  }
  
  // Special handling for arrays (tags, categories, etc.)
  ['tags', 'categories', 'labels'].forEach(field => {
    if (Array.isArray(primary[field]) && Array.isArray(secondary[field])) {
      merged[field] = [...new Set([...primary[field], ...secondary[field]])];
    }
  });
  
  // Update timestamps
  merged.updated_at = new Date().toISOString();
  
  return merged;
}