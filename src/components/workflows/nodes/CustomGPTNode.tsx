import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Bot, MessageSquare, Cpu } from 'lucide-react';
import { ModernNodeCard } from './ModernNodeCard';

export interface CustomGPTNodeData {
  label: string;
  config?: {
    assistantId?: string;
    assistantName?: string;
    threadId?: string;
    createNewThread?: boolean;
    message?: string;
    imageFiles?: string[];
    imageUrls?: string[];
    toolChoice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
    temperature?: number;
    maxPromptTokens?: number;
    maxCompletionTokens?: number;
    responseFormat?: 'text' | 'json_object';
    truncationStrategy?: {
      type: 'auto' | 'last_messages';
      lastMessages?: number;
    };
  };
  executionMode?: boolean;
  executionData?: any;
  executionStatus?: 'pending' | 'running' | 'completed' | 'failed';
}

const CustomGPTNode = memo(({ data, selected }: NodeProps<CustomGPTNodeData>) => {
  
  const mapStatus = () => {
    if (!data.executionMode) return undefined;
    switch (data.executionStatus) {
      case 'completed': return 'success';
      case 'failed': return 'failed';
      case 'running': return 'active';
      default: return 'idle';
    }
  };

  return (
    <ModernNodeCard
      selected={selected}
      icon={Bot}
      title={data.label || 'Custom GPT'}
      subtitle={data.config?.assistantName || 'OpenAI Assistant'}
      color="text-emerald-600 dark:text-emerald-400"
      status={mapStatus()}
      handleLeft={true}
      handleRight={true}
      badge={
        <div className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[9px] rounded border border-emerald-200 dark:border-emerald-500/30 font-bold mr-1">
          OpenAI
        </div>
      }
      className="w-[320px]"
    >
      <div className="p-3 space-y-3 bg-white dark:bg-[#1e1e1e]">
        {data.config?.message && (
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider">Message</label>
            <div className="text-xs text-gray-700 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-900/50 p-2 rounded border border-gray-200 dark:border-zinc-800 min-h-[60px] max-h-[100px] overflow-y-auto custom-scrollbar font-mono">
              {data.config.message}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500 dark:text-zinc-500">
          {data.config?.threadId && !data.config.createNewThread && (
            <div className="flex items-center gap-1.5">
              <MessageSquare size={10} />
              <span className="truncate text-gray-700 dark:text-zinc-300">Thread: {data.config.threadId.slice(0, 8)}...</span>
            </div>
          )}

          {data.config?.assistantId && (
            <div className="flex items-center gap-1.5">
              <Cpu size={10} />
              <span className="truncate text-gray-700 dark:text-zinc-300">{data.config.assistantId.slice(0, 12)}...</span>
            </div>
          )}
        </div>

        {data.config?.temperature !== undefined && (
          <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-zinc-500 pt-2 border-t border-gray-200 dark:border-zinc-800">
            <span>Temperature: {data.config.temperature}</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
              {data.config.responseFormat || 'text'}
            </span>
          </div>
        )}

        {/* Execution Status */}
        {data.executionMode && (
          <div className="pt-2 border-t border-gray-200 dark:border-zinc-800">
             <div className="flex justify-between items-center text-[10px] text-gray-500 dark:text-zinc-500 mb-1">
                <span className="capitalize">{data.executionStatus}</span>
                {data.executionData?.threadId && (
                  <span className="text-gray-700 dark:text-zinc-300">{data.executionData.threadId.slice(0,8)}...</span>
                )}
             </div>
             {data.executionData?.output && (
               <div className="bg-green-50 dark:bg-green-500/10 p-2 rounded border border-green-200 dark:border-green-500/20 text-[10px] text-green-700 dark:text-green-300 font-mono break-words max-h-[80px] overflow-y-auto custom-scrollbar">
                  {typeof data.executionData.output === 'string' 
                    ? data.executionData.output
                    : JSON.stringify(data.executionData.output, null, 2)
                  }
               </div>
             )}
          </div>
        )}
      </div>
    </ModernNodeCard>
  );
});

CustomGPTNode.displayName = 'CustomGPTNode';

export default CustomGPTNode;
