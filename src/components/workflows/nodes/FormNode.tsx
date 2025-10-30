import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { FileText, Settings, CheckCircle, XCircle, Clock, PlayCircle } from 'lucide-react';

export interface FormField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'select' | 'checkbox' | 'textarea' | 'date' | 'tel' | 'url';
  required?: boolean;
  placeholder?: string;
  defaultValue?: any;
  options?: Array<{ label: string; value: string }>; // For select fields
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    min?: number;
    max?: number;
  };
}

export interface FormNodeData {
  label: string;
  config?: {
    formTitle?: string;
    formDescription?: string;
    submitButtonText?: string;
    fields?: FormField[];
    authentication?: 'none' | 'basic' | 'apiKey';
    responseSettings?: {
      onSubmit?: 'continue' | 'redirect' | 'message';
      successMessage?: string;
      errorMessage?: string;
      redirectUrl?: string;
    };
    testUrl?: string;
    productionUrl?: string;
  };
  testStatus?: 'idle' | 'active' | 'success' | 'failed' | 'skipped' | 'waiting';
  lastSubmission?: any;
  executionMode?: boolean;
  executionData?: any;
  executionStatus?: 'pending' | 'running' | 'completed' | 'failed';
}

const FormNode = memo(({ data, selected }: NodeProps<FormNodeData>) => {
  const fieldCount = data.config?.fields?.length || 0;
  const hasUrls = data.config?.testUrl && data.config?.productionUrl;
  const isConfigured = fieldCount > 0 && hasUrls;

  const getExecutionStatusIcon = () => {
    if (!data.executionMode) return null;
    
    switch (data.executionStatus) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'running':
        return <PlayCircle className="w-4 h-4 text-blue-400 animate-pulse" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getExecutionStatusColor = () => {
    if (!data.executionMode) return '';
    
    switch (data.executionStatus) {
      case 'completed':
        return 'ring-2 ring-green-400/30';
      case 'failed':
        return 'ring-2 ring-red-400/30';
      case 'running':
        return 'ring-2 ring-blue-400/30 animate-pulse';
      default:
        return 'ring-2 ring-gray-400/30';
    }
  };
  
  return (
    <div
      className={`relative min-w-[120px] rounded-lg border-2 transition-all ${
        selected
          ? 'border-blue-500 shadow-lg shadow-blue-500/20 ring-offset-white dark:ring-offset-gray-950'
          : 'border-blue-400/50 hover:border-blue-400'
      } ${getExecutionStatusColor()} bg-blue-600 dark:bg-blue-600/20 backdrop-blur-sm border border-blue-500 dark:border-blue-500/30 shadow-sm dark:shadow-none`}
    >
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-blue-500 !border-blue-600"
        style={{ width: 10, height: 10 }}
      />
      
      <div className="p-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="p-1 bg-blue-500/20 rounded-md">
            <FileText className="w-3 h-3 text-blue-300" />
          </div>
          <span className="text-xs font-semibold text-blue-100">
            Form Trigger
          </span>
        </div>
        
        <div className="text-[10px] text-blue-200/80">
          {data.config?.formTitle || data.label || 'Configure Form'}
        </div>
        
        {isConfigured && (
          <div className="mt-1.5 space-y-0.5">
            <div className="text-[9px] text-blue-300/60">
              {fieldCount} field{fieldCount !== 1 ? 's' : ''} configured
            </div>
            {data.config?.authentication !== 'none' && (
              <div className="text-[9px] text-blue-300/60">
                Auth: {data.config?.authentication}
              </div>
            )}
            <div className="text-[9px] text-green-400/60">
              ✓ Forms ready
            </div>
          </div>
        )}
        
        {!isConfigured && (
          <div className="mt-1.5 flex items-center gap-1 text-[9px] text-yellow-400/80">
            <Settings className="w-2.5 h-2.5" />
            <span>Needs configuration</span>
          </div>
        )}
        
        {data.testStatus && data.testStatus !== 'idle' && (
          <div className={`mt-2 text-xs px-2 py-1 rounded ${
            data.testStatus === 'active' ? 'bg-yellow-500/20 text-yellow-300' :
            data.testStatus === 'success' ? 'bg-green-500/20 text-green-300' :
            data.testStatus === 'failed' ? 'bg-red-500/20 text-red-300' :
            'bg-gray-500/20 text-gray-300'
          }`}>
            {data.testStatus === 'active' ? 'Processing...' :
             data.testStatus === 'success' ? 'Form submitted' :
             data.testStatus === 'failed' ? 'Submission failed' :
             data.testStatus}
          </div>
        )}

        {/* Execution Status Overlay */}
        {data.executionMode && (
          <div className="mt-2 flex items-center gap-2">
            {getExecutionStatusIcon()}
            <span className="text-[8px] text-blue-200/70 capitalize">
              {data.executionStatus}
            </span>
          </div>
        )}

        {/* Execution Data Tooltip */}
        {data.executionMode && data.executionData && (
          <div className="mt-1 text-[8px] text-blue-300/50 truncate">
            {data.executionData.submissionData ? 'Form data captured' : 'No submission data'}
          </div>
        )}
      </div>
    </div>
  );
});

FormNode.displayName = 'FormNode';

export default FormNode;