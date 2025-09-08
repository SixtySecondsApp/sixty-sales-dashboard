import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, ChevronUp, ChevronDown, Copy, ExternalLink } from 'lucide-react';
import type { FormNodeData, FormField } from './nodes/FormNode';
import { formStorageService } from '@/lib/services/formStorageService';

interface FormConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeData?: FormNodeData | { config?: Partial<FormNodeData['config']> };
  onSave: (config: FormNodeData['config']) => void;
  onPreview?: () => void;
  workflowId?: string;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Phone' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'url', label: 'URL' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'select', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
];

export default function FormConfigModal({ isOpen, onClose, nodeData, onSave, onPreview, workflowId }: FormConfigModalProps) {
  const [activeTab, setActiveTab] = useState<'config' | 'fields' | 'response'>('config');
  const [config, setConfig] = useState<FormNodeData['config']>({
    formTitle: '',
    formDescription: '',
    submitButtonText: 'Submit',
    fields: [],
    authentication: 'none',
    responseSettings: {
      onSubmit: 'continue',
      successMessage: 'Form submitted successfully!',
      errorMessage: 'An error occurred. Please try again.',
      redirectUrl: ''
    },
    ...(nodeData?.config || {})
  });

  useEffect(() => {
    if (nodeData?.config) {
      setConfig({
        ...config,
        ...nodeData.config,
        fields: nodeData.config.fields || [],
        responseSettings: {
          ...config.responseSettings,
          ...(nodeData.config.responseSettings || {})
        }
      });
    }
  }, [nodeData]);

  const generateFormUrl = (environment: 'test' | 'production') => {
    const formId = `form-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const baseUrl = environment === 'test' 
      ? `${window.location.origin}/form-test`
      : `${window.location.origin}/form`;
    return `${baseUrl}/${formId}`;
  };

  const addField = () => {
    const newField: FormField = {
      id: `field-${Date.now()}`,
      name: `field_${config.fields?.length || 0}`,
      label: `Field ${(config.fields?.length || 0) + 1}`,
      type: 'text',
      required: false,
      placeholder: '',
    };
    
    setConfig({
      ...config,
      fields: [...(config.fields || []), newField]
    });
  };

  const updateField = (index: number, updates: Partial<FormField>) => {
    const fields = [...(config.fields || [])];
    fields[index] = { ...fields[index], ...updates };
    setConfig({ ...config, fields });
  };

  const removeField = (index: number) => {
    const fields = [...(config.fields || [])];
    fields.splice(index, 1);
    setConfig({ ...config, fields });
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const fields = [...(config.fields || [])];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex >= 0 && newIndex < fields.length) {
      [fields[index], fields[newIndex]] = [fields[newIndex], fields[index]];
      setConfig({ ...config, fields });
    }
  };

  const addSelectOption = (fieldIndex: number) => {
    const fields = [...(config.fields || [])];
    const field = fields[fieldIndex];
    
    if (!field.options) {
      field.options = [];
    }
    
    field.options.push({
      label: `Option ${field.options.length + 1}`,
      value: `option_${field.options.length + 1}`
    });
    
    setConfig({ ...config, fields });
  };

  const updateSelectOption = (fieldIndex: number, optionIndex: number, updates: { label?: string; value?: string }) => {
    const fields = [...(config.fields || [])];
    const field = fields[fieldIndex];
    
    if (field.options && field.options[optionIndex]) {
      field.options[optionIndex] = { ...field.options[optionIndex], ...updates };
      setConfig({ ...config, fields });
    }
  };

  const removeSelectOption = (fieldIndex: number, optionIndex: number) => {
    const fields = [...(config.fields || [])];
    const field = fields[fieldIndex];
    
    if (field.options) {
      field.options.splice(optionIndex, 1);
      setConfig({ ...config, fields });
    }
  };

  const handleSave = async () => {
    // Generate URLs if not already set
    const testFormId = config.testUrl?.split('/').pop() || generateFormUrl('test').split('/').pop();
    const prodFormId = config.productionUrl?.split('/').pop() || generateFormUrl('production').split('/').pop();
    
    if (!config.testUrl) {
      config.testUrl = generateFormUrl('test');
    }
    if (!config.productionUrl) {
      config.productionUrl = generateFormUrl('production');
    }
    
    // Store form configurations for both test and production
    if (testFormId) {
      await formStorageService.storeFormConfig(testFormId, config, workflowId, true);
    }
    if (prodFormId) {
      await formStorageService.storeFormConfig(prodFormId, config, workflowId, false);
    }
    
    onSave(config);
    onClose();
  };

  const copyVariable = (fieldName: string) => {
    navigator.clipboard.writeText(`{{formData.fields.${fieldName}}}`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-[800px] max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-xl font-semibold text-white">Configure Form Node</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          <button
            onClick={() => setActiveTab('config')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'config'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Configuration
          </button>
          <button
            onClick={() => setActiveTab('fields')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'fields'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Form Fields
          </button>
          <button
            onClick={() => setActiveTab('response')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'response'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Response Settings
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {activeTab === 'config' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Form Title
                </label>
                <input
                  type="text"
                  value={config.formTitle || ''}
                  onChange={(e) => setConfig({ ...config, formTitle: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                  placeholder="e.g., Contact Us"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Form Description
                </label>
                <textarea
                  value={config.formDescription || ''}
                  onChange={(e) => setConfig({ ...config, formDescription: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                  placeholder="e.g., We'll get back to you soon"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Submit Button Text
                </label>
                <input
                  type="text"
                  value={config.submitButtonText || 'Submit'}
                  onChange={(e) => setConfig({ ...config, submitButtonText: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                  placeholder="Submit"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Authentication
                </label>
                <select
                  value={config.authentication || 'none'}
                  onChange={(e) => setConfig({ ...config, authentication: e.target.value as any })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                >
                  <option value="none">None</option>
                  <option value="basic">Basic Auth</option>
                  <option value="apiKey">API Key</option>
                </select>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">
                  Form URLs
                </label>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="text-xs text-gray-400 mb-1">Test URL</div>
                      <div className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 text-sm font-mono">
                        {config.testUrl || generateFormUrl('test')}
                      </div>
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(config.testUrl || generateFormUrl('test'))}
                      className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <Copy className="w-4 h-4 text-gray-400" />
                    </button>
                    <a
                      href={config.testUrl || generateFormUrl('test')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 text-gray-400" />
                    </a>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="text-xs text-gray-400 mb-1">Production URL</div>
                      <div className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 text-sm font-mono">
                        {config.productionUrl || generateFormUrl('production')}
                      </div>
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(config.productionUrl || generateFormUrl('production'))}
                      className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <Copy className="w-4 h-4 text-gray-400" />
                    </button>
                    <a
                      href={config.productionUrl || generateFormUrl('production')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 text-gray-400" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'fields' && (
            <div className="space-y-4">
              {(!config.fields || config.fields.length === 0) ? (
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-4">No form fields configured yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {config.fields.map((field, index) => (
                    <div key={field.id} className="p-4 bg-gray-800 border border-gray-700 rounded-lg">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-300">
                            Field {index + 1}
                          </span>
                          <button
                            onClick={() => copyVariable(field.name)}
                            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300 font-mono"
                            title="Copy variable name"
                          >
                            {`{{formData.fields.${field.name}}}`}
                            <Copy className="w-3 h-3 inline ml-1" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => moveField(index, 'up')}
                            disabled={index === 0}
                            className="p-1 hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          </button>
                          <button
                            onClick={() => moveField(index, 'down')}
                            disabled={index === config.fields!.length - 1}
                            className="p-1 hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          </button>
                          <button
                            onClick={() => removeField(index)}
                            className="p-1 hover:bg-gray-700 rounded text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Field Name (for variables)</label>
                          <input
                            type="text"
                            value={field.name}
                            onChange={(e) => updateField(index, { name: e.target.value.replace(/\s+/g, '_') })}
                            className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white"
                            placeholder="field_name"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Field Type</label>
                          <select
                            value={field.type}
                            onChange={(e) => updateField(index, { type: e.target.value as any })}
                            className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white"
                          >
                            {FIELD_TYPES.map(type => (
                              <option key={type.value} value={type.value}>{type.label}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Label</label>
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => updateField(index, { label: e.target.value })}
                            className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white"
                            placeholder="Field Label"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Placeholder</label>
                          <input
                            type="text"
                            value={field.placeholder || ''}
                            onChange={(e) => updateField(index, { placeholder: e.target.value })}
                            className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white"
                            placeholder="Enter placeholder text"
                          />
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm text-gray-300">
                          <input
                            type="checkbox"
                            checked={field.required || false}
                            onChange={(e) => updateField(index, { required: e.target.checked })}
                            className="rounded border-gray-600 bg-gray-700 text-blue-500"
                          />
                          Required
                        </label>

                        {field.type === 'text' && (
                          <>
                            <input
                              type="number"
                              value={field.validation?.minLength || ''}
                              onChange={(e) => updateField(index, {
                                validation: { ...field.validation, minLength: parseInt(e.target.value) || undefined }
                              })}
                              className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white"
                              placeholder="Min"
                            />
                            <input
                              type="number"
                              value={field.validation?.maxLength || ''}
                              onChange={(e) => updateField(index, {
                                validation: { ...field.validation, maxLength: parseInt(e.target.value) || undefined }
                              })}
                              className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white"
                              placeholder="Max"
                            />
                          </>
                        )}

                        {field.type === 'number' && (
                          <>
                            <input
                              type="number"
                              value={field.validation?.min || ''}
                              onChange={(e) => updateField(index, {
                                validation: { ...field.validation, min: parseFloat(e.target.value) || undefined }
                              })}
                              className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white"
                              placeholder="Min"
                            />
                            <input
                              type="number"
                              value={field.validation?.max || ''}
                              onChange={(e) => updateField(index, {
                                validation: { ...field.validation, max: parseFloat(e.target.value) || undefined }
                              })}
                              className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white"
                              placeholder="Max"
                            />
                          </>
                        )}
                      </div>

                      {field.type === 'select' && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs text-gray-400">Options</label>
                            <button
                              onClick={() => addSelectOption(index)}
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs text-white"
                            >
                              Add Option
                            </button>
                          </div>
                          {field.options?.map((option, optIndex) => (
                            <div key={optIndex} className="flex items-center gap-2 mb-2">
                              <input
                                type="text"
                                value={option.label}
                                onChange={(e) => updateSelectOption(index, optIndex, { label: e.target.value })}
                                className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white"
                                placeholder="Option Label"
                              />
                              <input
                                type="text"
                                value={option.value}
                                onChange={(e) => updateSelectOption(index, optIndex, { value: e.target.value })}
                                className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white"
                                placeholder="Option Value"
                              />
                              <button
                                onClick={() => removeSelectOption(index, optIndex)}
                                className="p-1 hover:bg-gray-700 rounded text-red-400"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={addField}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Form Field
              </button>
            </div>
          )}

          {activeTab === 'response' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  After Form Submission
                </label>
                <select
                  value={config.responseSettings?.onSubmit || 'continue'}
                  onChange={(e) => setConfig({
                    ...config,
                    responseSettings: {
                      ...config.responseSettings,
                      onSubmit: e.target.value as any
                    }
                  })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                >
                  <option value="continue">Continue Workflow</option>
                  <option value="message">Show Message</option>
                  <option value="redirect">Redirect to URL</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Success Message
                </label>
                <textarea
                  value={config.responseSettings?.successMessage || ''}
                  onChange={(e) => setConfig({
                    ...config,
                    responseSettings: {
                      ...config.responseSettings,
                      successMessage: e.target.value
                    }
                  })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                  placeholder="Form submitted successfully!"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Error Message
                </label>
                <textarea
                  value={config.responseSettings?.errorMessage || ''}
                  onChange={(e) => setConfig({
                    ...config,
                    responseSettings: {
                      ...config.responseSettings,
                      errorMessage: e.target.value
                    }
                  })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                  placeholder="An error occurred. Please try again."
                  rows={2}
                />
              </div>

              {config.responseSettings?.onSubmit === 'redirect' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Redirect URL
                  </label>
                  <input
                    type="url"
                    value={config.responseSettings?.redirectUrl || ''}
                    onChange={(e) => setConfig({
                      ...config,
                      responseSettings: {
                        ...config.responseSettings,
                        redirectUrl: e.target.value
                      }
                    })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                    placeholder="https://example.com/thank-you"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <div className="flex gap-3">
            {onPreview && config.fields.length > 0 && (
              <button
                onClick={async () => {
                  await handleSave();
                  onPreview();
                }}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium transition-colors"
              >
                Preview Form
              </button>
            )}
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}