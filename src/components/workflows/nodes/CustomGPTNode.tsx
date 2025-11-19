import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Bot, Cpu, MessageSquare } from 'lucide-react';
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
      color="text-emerald-400"
      status={mapStatus()}
      handleLeft={true}
      handleRight={true}
      badge={
        <div className="bg-emerald-500/10 text-emerald-400 text-[9px] px-1.5 py-0.5 rounded border border-emerald-500/20">
          OpenAI
        </div>
      }
    >
      <div className="p-3 space-y-2 bg-zinc-900/50">
        {data.config?.threadId && !data.config.createNewThread && (
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
            <MessageSquare size={10} />
            <span className="truncate">Thread: {data.config.threadId.slice(0, 8)}...</span>
          </div>
        )}

        {data.config?.assistantId && (
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
            <Cpu size={10} />
            <span className="truncate">{data.config.assistantId}</span>
          </div>
        )}

        {/* Execution Status */}
        {data.executionMode && (
          <div className="pt-2 border-t border-zinc-800">
             <div className="flex justify-between items-center text-[10px] text-zinc-500 mb-1">
                <span className="capitalize">{data.executionStatus}</span>
                {data.executionData?.threadId && (
                  <span>{data.executionData.threadId.slice(0,8)}...</span>
                )}
             </div>
          </div>
        )}
      </div>
    </ModernNodeCard>
  );
});

CustomGPTNode.displayName = 'CustomGPTNode';

export default CustomGPTNode;
