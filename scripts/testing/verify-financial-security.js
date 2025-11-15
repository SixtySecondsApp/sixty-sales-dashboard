// Test cases to verify the validation logic
const testCases = [
  // Valid cases
  { input: 1000, expected: true, description: 'Valid positive number' },
  { input: '£1,500.50', expected: true, description: 'Valid currency string' },
  { input: 0, expected: true, description: 'Valid zero value' },
  
  // Edge cases that should be handled
  { input: NaN, expected: false, description: 'NaN should be blocked' },
  { input: Infinity, expected: false, description: 'Infinity should be blocked' },
  { input: -100, expected: false, description: 'Negative values should be blocked (default)' },
  { input: '100.50.25', expected: false, description: 'Invalid decimal format' },
  { input: '--100', expected: false, description: 'Invalid negative format' },
  { input: true, expected: false, description: 'Boolean values should be blocked' },
  { input: {}, expected: false, description: 'Objects should be blocked' },
  { input: [], expected: false, description: 'Arrays should be blocked' },
  
  // Security attack vectors
  { input: '<script>alert("xss")</script>', expected: false, description: 'XSS attempts should be blocked' },
  { input: '${process.env}', expected: false, description: 'Template injection should be blocked' },
];

// Simple validation logic (mimicking our implementation)
function simpleValidateFinancial(value) {
  // Handle null/undefined/empty
  if (value === null || value === undefined || value === '') return { isValid: true, value: 0 };
  
  // Block boolean values
  if (typeof value === 'boolean') return { isValid: false, error: 'Boolean not allowed' };
  
  // Block objects/arrays
  if (typeof value === 'object' && value !== null) return { isValid: false, error: 'Object not allowed' };
  
  let numericValue;
  
  if (typeof value === 'string') {
    // Clean currency symbols
    const cleaned = value.replace(/[£$€,\s]/g, '').replace(/[^\d.-]/g, '');
    
    // Check for multiple decimal points
    if ((cleaned.match(/\./g) || []).length > 1) return { isValid: false, error: 'Invalid decimal format' };
    
    // Check for invalid negative format
    const minusCount = (cleaned.match(/-/g) || []).length;
    if (minusCount > 1 || (minusCount === 1 && !cleaned.startsWith('-'))) {
      return { isValid: false, error: 'Invalid negative format' };
    }
    
    numericValue = parseFloat(cleaned);
  } else {
    numericValue = Number(value);
  }
  
  // Check for NaN
  if (isNaN(numericValue)) return { isValid: false, error: 'Not a valid number' };
  
  // Check for Infinity
  if (!isFinite(numericValue)) return { isValid: false, error: 'Cannot be infinite' };
  
  // Check negative (default: not allowed)
  if (numericValue < 0) return { isValid: false, error: 'Negative not allowed' };
  
  // Check reasonable range
  if (numericValue > 10_000_000) return { isValid: false, error: 'Exceeds maximum' };
  
  return { isValid: true, value: Math.round(numericValue * 100) / 100 };
}

// Run tests
let passed = 0;
let failed = 0;
testCases.forEach((testCase, index) => {
  const result = simpleValidateFinancial(testCase.input);
  const actualValid = result.isValid;
  const expectedValid = testCase.expected;
  
  if (actualValid === expectedValid) {
    passed++;
  } else {
    if (result.error) {}
    failed++;
  }
});
if (failed === 0) {
} else {
}
// Check if the actual validation file exists
const fs = require('fs');
const path = require('path');

const validationPath = path.join(__dirname, 'src/lib/utils/financialValidation.ts');
const monitorPath = path.join(__dirname, 'src/components/FinancialSecurityMonitor.tsx');
const testPath = path.join(__dirname, 'src/lib/utils/__tests__/financialValidation.test.ts');