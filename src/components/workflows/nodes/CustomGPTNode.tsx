import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Bot, CheckCircle, XCircle, Clock, PlayCircle, MessageSquare, Cpu } from 'lucide-react';

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
      className={`relative min-w-[140px] rounded-lg border-2 transition-all ${
        selected
          ? 'border-emerald-500 shadow-lg shadow-emerald-500/20 ring-offset-white dark:ring-offset-gray-950'
          : 'border-emerald-400/50 hover:border-emerald-400'
      } ${getExecutionStatusColor()} bg-emerald-600 dark:bg-emerald-600/20 backdrop-blur-sm border border-emerald-500 dark:border-emerald-500/30 shadow-sm dark:shadow-none`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-emerald-500 !border-emerald-600"
        style={{ width: 10, height: 10 }}
      />
      
      <div className="p-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="p-1 bg-gradient-to-br from-emerald-500/30 to-teal-500/30 rounded-md">
            <Bot className="w-3 h-3 text-emerald-300" />
          </div>
          <span className="text-xs font-semibold text-emerald-100">
            Custom GPT
          </span>
        </div>
        
        <div className="text-[10px] text-emerald-200/80 font-medium">
          {data.label || 'OpenAI Assistant'}
        </div>
        
        {data.config?.assistantName && (
          <div className="mt-1.5 flex items-center gap-1">
            <Cpu className="w-2.5 h-2.5 text-emerald-300/60" />
            <span className="text-[9px] text-emerald-300/60 truncate">
              {data.config.assistantName}
            </span>
          </div>
        )}

        {data.config?.threadId && !data.config.createNewThread && (
          <div className="mt-1 flex items-center gap-1">
            <MessageSquare className="w-2.5 h-2.5 text-emerald-300/60" />
            <span className="text-[8px] text-emerald-300/50 truncate">
              Thread: {data.config.threadId.slice(0, 8)}...
            </span>
          </div>
        )}

        {/* Execution Status Overlay */}
        {data.executionMode && (
          <div className="mt-2 flex items-center gap-2">
            {getExecutionStatusIcon()}
            <span className="text-[8px] text-emerald-200/70 capitalize">
              {data.executionStatus}
            </span>
          </div>
        )}

        {/* Execution Data Tooltip */}
        {data.executionMode && data.executionData && (
          <div className="mt-1 text-[8px] text-emerald-300/50 truncate">
            {data.executionData.threadId ? `Thread: ${data.executionData.threadId.slice(0, 8)}...` : 'Processing...'}
          </div>
        )}
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-emerald-500 !border-emerald-600"
        style={{ width: 10, height: 10 }}
      />
      
      {/* Configuration Indicator */}
      {data.config?.assistantId && (
        <div className="absolute -top-2 -right-2">
          <div className="relative">
            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
            <div className="absolute inset-0 w-3 h-3 bg-emerald-400 rounded-full animate-ping" />
          </div>
        </div>
      )}

      {/* OpenAI Badge */}
      <div className="absolute -bottom-1 -right-1 px-1 py-0.5 bg-black/60 rounded text-[7px] text-emerald-400 font-mono">
        OpenAI
      </div>
    </div>
  );
});

CustomGPTNode.displayName = 'CustomGPTNode';

export default CustomGPTNode;