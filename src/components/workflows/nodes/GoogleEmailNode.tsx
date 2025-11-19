import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Mail, Settings } from 'lucide-react';
import { ModernNodeCard } from './ModernNodeCard';

export interface GoogleEmailNodeData {
  label: string;
  description?: string;
  config?: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    isHtml?: boolean;
    attachments?: string[];
  };
  testStatus?: string;
  executionMode?: boolean;
  executionData?: any;
  executionStatus?: 'pending' | 'running' | 'completed' | 'failed';
}

const GoogleEmailNode = memo(({ data, selected }: NodeProps<GoogleEmailNodeData>) => {
  const isConfigured = data.config && data.config.to && data.config.to.length > 0 && data.config.subject;

  const mapStatus = () => {
    if (data.executionMode) {
      switch (data.executionStatus) {
        case 'completed': return 'success';
        case 'failed': return 'failed';
        case 'running': return 'active';
        default: return 'idle';
      }
    }
    return data.testStatus === 'active' ? 'active' : undefined;
  };

  const ConfigBadge = !isConfigured ? (
    <div className="px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 text-[9px] rounded border border-yellow-200 dark:border-yellow-500/30 font-bold mr-1">
      !
    </div>
  ) : null;

  return (
    <ModernNodeCard
      selected={selected}
      icon={Mail}
      title={data.label || 'Send Gmail'}
      subtitle={isConfigured ? `To: ${data.config?.to[0]}${data.config?.to.length > 1 ? ` +${data.config.to.length - 1}` : ''}` : 'Configure email'}
      color="text-blue-400"
      status={mapStatus()}
      badge={ConfigBadge}
      className="w-[300px]"
    >
      <div className="p-3 space-y-3 bg-white dark:bg-[#1e1e1e]">
        {data.config?.subject && (
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider">Subject</label>
            <div className="text-xs text-gray-700 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-900/50 p-2 rounded border border-gray-200 dark:border-zinc-800">
              {data.config.subject}
            </div>
          </div>
        )}

        {data.config?.body && (
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider">Body</label>
            <div className="text-xs text-gray-700 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-900/50 p-2 rounded border border-gray-200 dark:border-zinc-800 min-h-[60px] max-h-[100px] overflow-y-auto custom-scrollbar">
              {data.config.body}
            </div>
          </div>
        )}

        {!isConfigured && (
          <div className="flex items-center gap-2 text-[10px] text-yellow-600 dark:text-yellow-400/80 bg-yellow-50 dark:bg-yellow-500/10 p-2 rounded border border-yellow-200 dark:border-yellow-500/20">
            <Settings size={12} />
            <span>Needs configuration</span>
          </div>
        )}

        {isConfigured && data.config && (
          <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500 dark:text-zinc-500 pt-2 border-t border-gray-200 dark:border-zinc-800">
            <div className="flex flex-col gap-1">
              <span className="uppercase tracking-wider">Recipients</span>
              <span className="text-gray-700 dark:text-zinc-300">{data.config.to?.length || 0}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="uppercase tracking-wider">Format</span>
              <span className="text-gray-700 dark:text-zinc-300">{data.config.isHtml ? 'HTML' : 'Text'}</span>
            </div>
          </div>
        )}
      </div>
    </ModernNodeCard>
  );
});

GoogleEmailNode.displayName = 'GoogleEmailNode';

export default GoogleEmailNode;
