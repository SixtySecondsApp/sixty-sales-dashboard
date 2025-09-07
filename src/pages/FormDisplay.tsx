import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { formService } from '@/lib/services/formService';
import { formStorageService } from '@/lib/services/formStorageService';
import { workflowExecutionService } from '@/lib/services/workflowExecutionService';
import { formatVariableValue } from '@/lib/utils/promptVariables';
import type { FormField } from '@/components/workflows/nodes/FormNode';

interface FormConfig {
  formTitle: string;
  formDescription?: string;
  submitButtonText: string;
  fields: FormField[];
  authentication?: 'none' | 'basic' | 'apiKey';
  responseSettings?: {
    onSubmit?: 'continue' | 'redirect' | 'message';
    successMessage?: string;
    errorMessage?: string;
    redirectUrl?: string;
  };
}

export default function FormDisplay() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const [formConfig, setFormConfig] = useState<FormConfig | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedData, setSubmittedData] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    // Load form configuration
    const loadFormConfig = async () => {
      if (!formId) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      try {
        // Fetch form configuration from storage
        const storedForm = await formStorageService.getFormConfig(formId);
        
        if (storedForm && storedForm.config) {
          const config: FormConfig = {
            formTitle: storedForm.config.formTitle || 'Form',
            formDescription: storedForm.config.formDescription,
            submitButtonText: storedForm.config.submitButtonText || 'Submit',
            fields: storedForm.config.fields || [],
            authentication: storedForm.config.authentication,
            responseSettings: storedForm.config.responseSettings
          };
          
          // Register form schema with service
          formService.registerFormSchema(formId, config.fields);
          
          setFormConfig(config);
        } else {
          // Form not found
          setFormConfig(null);
        }
      } catch (error) {
        console.error('Error loading form:', error);
        setFormConfig(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadFormConfig();
  }, [formId]);

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData({ ...formData, [fieldName]: value });
    // Clear error when user types
    if (errors[fieldName]) {
      const newErrors = { ...errors };
      delete newErrors[fieldName];
      setErrors(newErrors);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formConfig || !formId) return;
    
    // Validate form
    const validationResult = formService.validateFormData(formId, formData);
    
    if (!validationResult.isValid) {
      setErrors(validationResult.errors);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Submit form
      const submission = await formService.submitForm(
        formId,
        formConfig.formTitle,
        formData,
        {
          userAgent: navigator.userAgent,
          referrer: document.referrer
        }
      );
      
      setSubmitted(true);
      setSubmittedData(formData);
      
      // Trigger workflow execution if this form is part of a workflow
      const storedForm = await formStorageService.getFormConfig(formId);
      if (storedForm?.workflow_id) {
        // In a real implementation, we would load the workflow and execute it
        // For now, we'll just trigger an event
        const event = new CustomEvent('formSubmitted', {
          detail: {
            formId,
            workflowId: storedForm.workflow_id,
            submission,
            formData
          }
        });
        window.dispatchEvent(event);
      }
      
      // Handle response settings
      if (formConfig.responseSettings?.onSubmit === 'redirect' && formConfig.responseSettings.redirectUrl) {
        setTimeout(() => {
          window.location.href = formConfig.responseSettings.redirectUrl;
        }, 2000);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      // Show error message
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (field: FormField) => {
    const value = formData[field.name] || '';
    const error = errors[field.name];
    
    const fieldClass = `w-full px-3 py-2 bg-white border ${
      error ? 'border-red-500' : 'border-gray-300'
    } rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:border-blue-500`;
    
    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'url':
        return (
          <input
            type={field.type}
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            className={fieldClass}
            placeholder={field.placeholder}
            required={field.required}
          />
        );
        
      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            className={fieldClass}
            placeholder={field.placeholder}
            required={field.required}
            min={field.validation?.min}
            max={field.validation?.max}
          />
        );
        
      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            className={fieldClass}
            required={field.required}
          />
        );
        
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            className={fieldClass}
            placeholder={field.placeholder}
            required={field.required}
            rows={4}
          />
        );
        
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            className={fieldClass}
            required={field.required}
          >
            <option value="">Select an option</option>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
        
      case 'checkbox':
        return (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => handleFieldChange(field.name, e.target.checked)}
              className="rounded border-gray-300 text-blue-500"
              required={field.required}
            />
            <span className="text-sm text-gray-700">
              {field.placeholder || 'Check this box'}
            </span>
          </label>
        );
        
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading form...</p>
        </div>
      </div>
    );
  }

  if (!formConfig) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Form Not Found</h2>
          <p className="text-gray-600">The form you're looking for doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  if (submitted && submittedData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
          <div className="text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">
              {formConfig.responseSettings?.successMessage || 'Form Submitted Successfully!'}
            </h2>
            {formConfig.responseSettings?.onSubmit === 'redirect' && (
              <p className="text-gray-600 mb-4">Redirecting...</p>
            )}
          </div>
          
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Submitted Data:</h3>
            <div className="space-y-2">
              {Object.entries(submittedData).map(([key, value]) => (
                <div key={key} className="flex justify-between text-sm">
                  <span className="text-gray-600">{key}:</span>
                  <span className="text-gray-900 font-medium">
                    {formatVariableValue(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          <button
            onClick={() => {
              setSubmitted(false);
              setSubmittedData(null);
              setFormData({});
            }}
            className="mt-6 w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
          >
            Submit Another Response
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-800">{formConfig.formTitle}</h1>
            {formConfig.formDescription && (
              <p className="text-gray-600 mt-2">{formConfig.formDescription}</p>
            )}
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {formConfig.fields.map((field) => (
              <div key={field.id}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {renderField(field)}
                {errors[field.name] && (
                  <div className="mt-1 flex items-center gap-1 text-sm text-red-600">
                    <AlertCircle className="w-3 h-3" />
                    {errors[field.name]}
                  </div>
                )}
              </div>
            ))}
            
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                formConfig.submitButtonText || 'Submit'
              )}
            </button>
          </form>
        </div>
        
        <div className="mt-4 text-center text-sm text-gray-500">
          Form ID: {formId}
        </div>
      </div>
    </div>
  );
}