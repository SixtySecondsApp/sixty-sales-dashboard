import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Sparkles, CheckCircle, XCircle, Clock, PlayCircle } from 'lucide-react';

export interface AIAgentNodeData {
  label: string;
  config?: {
    modelProvider?: 'openai' | 'anthropic' | 'openrouter';
    model?: string;
    systemPrompt?: string;
    userPrompt?: string;
    temperature?: number;
    maxTokens?: number;
  };
  executionMode?: boolean;
  executionData?: any;
  executionStatus?: 'pending' | 'running' | 'completed' | 'failed';
}

const AIAgentNode = memo(({ data, selected }: NodeProps<AIAgentNodeData>) => {
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
          ? 'border-purple-500 shadow-lg shadow-purple-500/20'
          : 'border-purple-400/50 hover:border-purple-400'
      } ${getExecutionStatusColor()} bg-gradient-to-br from-purple-900/90 via-purple-800/90 to-purple-700/90 backdrop-blur-sm`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-purple-500 !border-purple-600"
        style={{ width: 10, height: 10 }}
      />
      
      <div className="p-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="p-1 bg-purple-500/20 rounded-md">
            <Sparkles className="w-3 h-3 text-purple-300" />
          </div>
          <span className="text-xs font-semibold text-purple-100">
            AI Agent
          </span>
        </div>
        
        <div className="text-[10px] text-purple-200/80">
          {data.label || 'AI Processing'}
        </div>
        
        {data.config?.model && (
          <div className="mt-1.5 text-[9px] text-purple-300/60 truncate">
            {data.config.modelProvider}: {data.config.model}
          </div>
        )}

        {/* Execution Status Overlay */}
        {data.executionMode && (
          <div className="mt-2 flex items-center gap-2">
            {getExecutionStatusIcon()}
            <span className="text-[8px] text-purple-200/70 capitalize">
              {data.executionStatus}
            </span>
          </div>
        )}

        {/* Execution Data Tooltip */}
        {data.executionMode && data.executionData && (
          <div className="mt-1 text-[8px] text-purple-300/50 truncate">
            {data.executionData.output ? 'Output available' : 'No output'}
          </div>
        )}
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-purple-500 !border-purple-600"
        style={{ width: 10, height: 10 }}
      />
      
      {data.config && (
        <div className="absolute -top-2 -right-2 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
      )}
    </div>
  );
});

AIAgentNode.displayName = 'AIAgentNode';

export default AIAgentNode;