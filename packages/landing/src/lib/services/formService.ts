import { FormField } from '@/components/workflows/nodes/FormNode';
import { VariableContext } from '../utils/promptVariables';
import { v4 as uuidv4 } from 'uuid';

export interface FormSubmission {
  id: string;
  formId: string;
  formTitle?: string;
  submittedAt: string;
  fields: Record<string, any>;
  metadata: {
    ip?: string;
    userAgent?: string;
    referrer?: string;
  };
  status: 'pending' | 'processing' | 'completed' | 'failed';
  workflowExecutionId?: string;
}

export interface FormValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

class FormService {
  private submissions: Map<string, FormSubmission> = new Map();
  private formSchemas: Map<string, FormField[]> = new Map();

  /**
   * Register a form schema for validation
   */
  registerFormSchema(formId: string, fields: FormField[]): void {
    this.formSchemas.set(formId, fields);
  }

  /**
   * Generate a unique form ID
   */
  generateFormId(): string {
    return `form-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate form URLs for test and production
   */
  generateFormUrls(formId: string): { testUrl: string; productionUrl: string } {
    const baseUrl = window.location.origin;
    return {
      testUrl: `${baseUrl}/form-test/${formId}`,
      productionUrl: `${baseUrl}/form/${formId}`
    };
  }

  /**
   * Fix form URL to use current origin (fixes port issues)
   */
  fixFormUrl(url: string): string {
    if (!url) return url;
    
    try {
      const urlObj = new URL(url);
      const currentOrigin = window.location.origin;
      
      // Replace the origin but keep the path
      urlObj.protocol = window.location.protocol;
      urlObj.hostname = window.location.hostname;
      urlObj.port = window.location.port;
      
      return urlObj.toString();
    } catch (error) {
      return url;
    }
  }

  /**
   * Validate form data against schema
   */
  validateFormData(formId: string, data: Record<string, any>): FormValidationResult {
    const schema = this.formSchemas.get(formId);
    if (!schema) {
      return {
        isValid: true,
        errors: {}
      };
    }

    const errors: Record<string, string> = {};
    
    for (const field of schema) {
      const value = data[field.name];
      
      // Check required fields
      if (field.required && (value === undefined || value === null || value === '')) {
        errors[field.name] = `${field.label} is required`;
        continue;
      }

      // Skip validation if field is optional and empty
      if (!field.required && (value === undefined || value === null || value === '')) {
        continue;
      }

      // Type-specific validation
      switch (field.type) {
        case 'email':
          if (value && !this.isValidEmail(value)) {
            errors[field.name] = `${field.label} must be a valid email address`;
          }
          break;
          
        case 'url':
          if (value && !this.isValidUrl(value)) {
            errors[field.name] = `${field.label} must be a valid URL`;
          }
          break;
          
        case 'tel':
          if (value && !this.isValidPhone(value)) {
            errors[field.name] = `${field.label} must be a valid phone number`;
          }
          break;
          
        case 'number':
          const numValue = parseFloat(value);
          if (isNaN(numValue)) {
            errors[field.name] = `${field.label} must be a number`;
          } else {
            if (field.validation?.min !== undefined && numValue < field.validation.min) {
              errors[field.name] = `${field.label} must be at least ${field.validation.min}`;
            }
            if (field.validation?.max !== undefined && numValue > field.validation.max) {
              errors[field.name] = `${field.label} must be at most ${field.validation.max}`;
            }
          }
          break;
          
        case 'text':
        case 'textarea':
          if (value) {
            const strValue = String(value);
            if (field.validation?.minLength && strValue.length < field.validation.minLength) {
              errors[field.name] = `${field.label} must be at least ${field.validation.minLength} characters`;
            }
            if (field.validation?.maxLength && strValue.length > field.validation.maxLength) {
              errors[field.name] = `${field.label} must be at most ${field.validation.maxLength} characters`;
            }
            if (field.validation?.pattern) {
              const regex = new RegExp(field.validation.pattern);
              if (!regex.test(strValue)) {
                errors[field.name] = `${field.label} format is invalid`;
              }
            }
          }
          break;
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  /**
   * Submit form data
   */
  async submitForm(
    formId: string,
    formTitle: string | undefined,
    data: Record<string, any>,
    metadata?: {
      ip?: string;
      userAgent?: string;
      referrer?: string;
    }
  ): Promise<FormSubmission> {
    const submissionId = uuidv4();
    const submission: FormSubmission = {
      id: submissionId,
      formId,
      formTitle,
      submittedAt: new Date().toISOString(),
      fields: data,
      metadata: metadata || {},
      status: 'pending'
    };

    this.submissions.set(submissionId, submission);
    
    // Simulate async processing
    setTimeout(() => {
      const sub = this.submissions.get(submissionId);
      if (sub) {
        sub.status = 'processing';
        this.submissions.set(submissionId, sub);
      }
    }, 100);

    return submission;
  }

  /**
   * Get form submission by ID
   */
  getSubmission(submissionId: string): FormSubmission | undefined {
    return this.submissions.get(submissionId);
  }

  /**
   * Update submission status
   */
  updateSubmissionStatus(
    submissionId: string,
    status: FormSubmission['status'],
    workflowExecutionId?: string
  ): void {
    const submission = this.submissions.get(submissionId);
    if (submission) {
      submission.status = status;
      if (workflowExecutionId) {
        submission.workflowExecutionId = workflowExecutionId;
      }
      this.submissions.set(submissionId, submission);
    }
  }

  /**
   * Create variable context from form submission
   */
  createFormVariableContext(submission: FormSubmission): Partial<VariableContext> {
    return {
      formData: {
        submittedAt: submission.submittedAt,
        fields: submission.fields,
        formId: submission.formId,
        submissionId: submission.id,
        formTitle: submission.formTitle,
        submitterIp: submission.metadata.ip,
        submitterUserAgent: submission.metadata.userAgent
      }
    };
  }

  /**
   * Generate sample form data for testing
   */
  generateSampleData(fields: FormField[]): Record<string, any> {
    const sampleData: Record<string, any> = {};
    
    for (const field of fields) {
      switch (field.type) {
        case 'text':
          sampleData[field.name] = `Sample ${field.label}`;
          break;
        case 'email':
          sampleData[field.name] = 'test@example.com';
          break;
        case 'tel':
          sampleData[field.name] = '+1 (555) 123-4567';
          break;
        case 'number':
          sampleData[field.name] = field.validation?.min || 42;
          break;
        case 'date':
          sampleData[field.name] = new Date().toISOString().split('T')[0];
          break;
        case 'url':
          sampleData[field.name] = 'https://example.com';
          break;
        case 'textarea':
          sampleData[field.name] = `This is a sample text for ${field.label}.\nIt can have multiple lines.`;
          break;
        case 'select':
          if (field.options && field.options.length > 0) {
            sampleData[field.name] = field.options[0].value;
          }
          break;
        case 'checkbox':
          sampleData[field.name] = true;
          break;
      }
    }
    
    return sampleData;
  }

  /**
   * Clear all submissions (for testing)
   */
  clearSubmissions(): void {
    this.submissions.clear();
  }

  /**
   * Get all submissions for a form
   */
  getFormSubmissions(formId: string): FormSubmission[] {
    return Array.from(this.submissions.values()).filter(s => s.formId === formId);
  }

  // Validation helpers
  private isValidEmail(email: string): boolean {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private isValidPhone(phone: string): boolean {
    // Basic phone validation - can be customized
    const re = /^[\d\s\-\+\(\)]+$/;
    return re.test(phone) && phone.replace(/\D/g, '').length >= 10;
  }
}

// Export singleton instance
export const formService = new FormService();