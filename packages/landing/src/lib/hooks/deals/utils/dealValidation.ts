import logger from '@/lib/utils/logger';

// Security: Sanitize error messages to prevent sensitive data exposure
export function sanitizeErrorMessage(error: any): string {
  const message = error?.message || 'Unknown error';
  
  // Log full error server-side but return sanitized message to user
  logger.error('Deal operation error (sanitized for user):', {
    message,
    timestamp: new Date().toISOString(),
    // Don't log full error object to prevent sensitive data exposure
  });
  
  // Return generic error messages for common errors
  if (message.includes('duplicate key')) {
    return 'A deal with this information already exists';
  }
  if (message.includes('foreign key')) {
    return 'Referenced record not found';
  }
  if (message.includes('PGRST')) {
    return 'Database connection error';
  }
  if (message.includes('JWT')) {
    return 'Authentication required';
  }
  
  return 'Operation failed. Please try again.';
}

// Validate and format date for PostgreSQL
export function processDateField(dateValue: any): string | null {
  if (dateValue === '' || dateValue === undefined) {
    return null;
  }
  
  if (!dateValue) {
    return null;
  }
  
  try {
    // Validate and format the date
    const dateObj = new Date(dateValue);
    if (isNaN(dateObj.getTime())) {
      logger.warn('⚠️ Invalid date format, setting to null');
      return null;
    }
    
    // Format as YYYY-MM-DD for PostgreSQL DATE type
    return dateObj.toISOString().split('T')[0];
  } catch (dateError) {
    logger.warn('⚠️ Date processing error, setting to null:', dateError);
    return null;
  }
}

// Clean update data for safe database operations
export function sanitizeUpdateData(updateData: any): any {
  const sanitized = { ...updateData };
  
  // Handle expected_close_date specifically
  if ('expected_close_date' in sanitized) {
    logger.log('🗓️ Processing expected_close_date:', sanitized.expected_close_date);
    sanitized.expected_close_date = processDateField(sanitized.expected_close_date);
  }
  
  // Remove any undefined values
  Object.keys(sanitized).forEach(key => {
    if (sanitized[key] === undefined) {
      delete sanitized[key];
    }
  });
  
  return sanitized;
}

// Create basic update data for fallback scenarios
export function createBasicUpdateData(updateData: any): any {
  const basicUpdateData: any = {
    name: updateData.name,
    company: updateData.company,
    value: updateData.value,
    stage_id: updateData.stage_id,
    probability: updateData.probability,
    notes: updateData.notes || updateData.description,
    updated_at: new Date().toISOString()
  };
  
  // Remove any undefined values
  Object.keys(basicUpdateData).forEach(key => {
    if (basicUpdateData[key] === undefined) {
      delete basicUpdateData[key];
    }
  });
  
  return basicUpdateData;
}