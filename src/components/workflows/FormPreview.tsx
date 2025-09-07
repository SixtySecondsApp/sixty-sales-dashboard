import React, { useState } from 'react';
import { X, Send, CheckCircle, AlertCircle, Copy } from 'lucide-react';
import type { FormField } from './nodes/FormNode';
import { formService } from '@/lib/services/formService';
import { formatVariableValue } from '@/lib/utils/promptVariables';

interface FormPreviewProps {
  formTitle?: string;
  formDescription?: string;
  submitButtonText?: string;
  fields: FormField[];
  onSubmit?: (data: Record<string, any>) => void;
  onClose?: () => void;
  showVariables?: boolean;
}

export default function FormPreview({
  formTitle = 'Form Preview',
  formDescription,
  submitButtonText = 'Submit',
  fields,
  onSubmit,
  onClose,
  showVariables = true
}: FormPreviewProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submittedData, setSubmittedData] = useState<Record<string, any> | null>(null);

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData({ ...formData, [fieldName]: value });
    // Clear error when user types
    if (errors[fieldName]) {
      const newErrors = { ...errors };
      delete newErrors[fieldName];
      setErrors(newErrors);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const validationResult = formService.validateFormData('preview', fields);
    
    // Check for missing required fields
    const validationErrors: Record<string, string> = {};
    for (const field of fields) {
      const value = formData[field.name];
      if (field.required && (value === undefined || value === null || value === '')) {
        validationErrors[field.name] = `${field.label} is required`;
      }
    }
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    // Submit form
    setSubmitted(true);
    setSubmittedData(formData);
    
    if (onSubmit) {
      onSubmit(formData);
    }
  };

  const copyVariable = (variablePath: string) => {
    navigator.clipboard.writeText(`{{${variablePath}}}`);
  };

  const generateSampleData = () => {
    const sampleData = formService.generateSampleData(fields);
    setFormData(sampleData);
    setErrors({});
  };

  const renderField = (field: FormField) => {
    const value = formData[field.name] || '';
    const error = errors[field.name];
    
    const fieldClass = `w-full px-3 py-2 bg-gray-800 border ${
      error ? 'border-red-500' : 'border-gray-700'
    } rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500`;
    
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
              className="rounded border-gray-600 bg-gray-700 text-blue-500"
              required={field.required}
            />
            <span className="text-sm text-gray-300">
              {field.placeholder || 'Check this box'}
            </span>
          </label>
        );
        
      default:
        return null;
    }
  };

  if (submitted && submittedData) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-2xl w-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-500" />
            <h3 className="text-xl font-semibold text-white">Form Submitted Successfully!</h3>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          )}
        </div>
        
        <div className="space-y-4">
          <div className="p-4 bg-gray-800 rounded-lg">
            <h4 className="text-sm font-medium text-gray-400 mb-3">Submitted Data</h4>
            <div className="space-y-2">
              {Object.entries(submittedData).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-sm text-gray-300">{key}:</span>
                  <span className="text-sm text-white font-mono">
                    {formatVariableValue(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          {showVariables && (
            <div className="p-4 bg-gray-800 rounded-lg">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Available Variables</h4>
              <div className="space-y-1">
                {Object.keys(submittedData).map((key) => (
                  <div key={key} className="flex items-center justify-between">
                    <code className="text-xs text-blue-400">
                      {`{{formData.fields.${key}}}`}
                    </code>
                    <button
                      onClick={() => copyVariable(`formData.fields.${key}`)}
                      className="p-1 hover:bg-gray-700 rounded transition-colors"
                      title="Copy variable"
                    >
                      <Copy className="w-3 h-3 text-gray-400" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <button
            onClick={() => {
              setSubmitted(false);
              setSubmittedData(null);
              setFormData({});
            }}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors"
          >
            Submit Another Response
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-2xl w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-white">{formTitle}</h3>
          {formDescription && (
            <p className="text-sm text-gray-400 mt-1">{formDescription}</p>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400">No form fields configured</p>
            <p className="text-sm text-gray-500 mt-2">
              Add fields in the configuration to preview the form
            </p>
          </div>
        ) : (
          <>
            {fields.map((field) => (
              <div key={field.id}>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </label>
                {renderField(field)}
                {errors[field.name] && (
                  <div className="mt-1 flex items-center gap-1 text-sm text-red-400">
                    <AlertCircle className="w-3 h-3" />
                    {errors[field.name]}
                  </div>
                )}
              </div>
            ))}
            
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                {submitButtonText}
              </button>
              
              <button
                type="button"
                onClick={generateSampleData}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
              >
                Fill Sample Data
              </button>
            </div>
          </>
        )}
      </form>
      
      {showVariables && fields.length > 0 && (
        <div className="mt-6 p-4 bg-gray-800 rounded-lg">
          <h4 className="text-sm font-medium text-gray-400 mb-2">Variable Reference</h4>
          <p className="text-xs text-gray-500 mb-3">
            Use these variables in AI prompts and other nodes
          </p>
          <div className="space-y-1">
            {fields.map((field) => (
              <div key={field.id} className="flex items-center justify-between">
                <code className="text-xs text-blue-400">
                  {`{{formData.fields.${field.name}}}`}
                </code>
                <button
                  onClick={() => copyVariable(`formData.fields.${field.name}`)}
                  className="p-1 hover:bg-gray-700 rounded transition-colors"
                  title="Copy variable"
                >
                  <Copy className="w-3 h-3 text-gray-400" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}