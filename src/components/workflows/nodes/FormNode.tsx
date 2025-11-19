import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { FileText, Settings } from 'lucide-react';
import { ModernNodeCard } from './ModernNodeCard';

export interface FormField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'select' | 'checkbox' | 'textarea' | 'date' | 'tel' | 'url';
  required?: boolean;
  placeholder?: string;
  defaultValue?: any;
  options?: Array<{ label: string; value: string }>;
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

  const mapStatus = () => {
    if (data.executionMode) {
      switch (data.executionStatus) {
        case 'completed': return 'success';
        case 'failed': return 'failed';
        case 'running': return 'active';
        default: return 'idle';
      }
    }
    return data.testStatus === 'active' ? 'active' : 
           data.testStatus === 'success' ? 'success' : 
           data.testStatus === 'failed' ? 'failed' : undefined;
  };

  const ConfigBadge = !isConfigured ? (
    <div className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-300 text-[9px] rounded border border-yellow-500/30 font-bold mr-1">
      !
    </div>
  ) : null;

  return (
    <ModernNodeCard
      selected={selected}
      icon={FileText}
      title={data.config?.formTitle || data.label || 'Form Trigger'}
      subtitle={isConfigured ? `${fieldCount} field${fieldCount !== 1 ? 's' : ''}` : 'Configure form'}
      color="text-blue-400"
      status={mapStatus()}
      badge={ConfigBadge}
      handleLeft={false}
      handleRight={true}
      className="w-[280px]"
    >
      <div className="p-3 space-y-3 bg-[#1e1e1e]">
        {data.config?.formDescription && (
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Description</label>
            <div className="text-xs text-zinc-300 bg-zinc-900/50 p-2 rounded border border-zinc-800 min-h-[40px]">
              {data.config.formDescription}
            </div>
          </div>
        )}

        {isConfigured && (
          <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-500">
            <div className="flex flex-col gap-1">
              <span className="uppercase tracking-wider">Fields</span>
              <span className="text-zinc-300">{fieldCount}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="uppercase tracking-wider">Auth</span>
              <span className="text-zinc-300 capitalize">{data.config?.authentication || 'None'}</span>
            </div>
          </div>
        )}

        {!isConfigured && (
          <div className="flex items-center gap-2 text-[10px] text-yellow-400/80 bg-yellow-500/10 p-2 rounded border border-yellow-500/20">
            <Settings size={12} />
            <span>Needs configuration</span>
          </div>
        )}

        {data.executionMode && data.executionData && (
          <div className="pt-2 border-t border-zinc-800">
            <div className="text-[10px] text-zinc-500 mb-1">
              {data.executionData.submissionData ? 'Form data captured' : 'No submission data'}
            </div>
          </div>
        )}
      </div>
    </ModernNodeCard>
  );
});

FormNode.displayName = 'FormNode';

export default FormNode;
