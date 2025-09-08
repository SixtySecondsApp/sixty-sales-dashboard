import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Sparkles } from 'lucide-react';

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
}

const AIAgentNode = memo(({ data, selected }: NodeProps<AIAgentNodeData>) => {
  return (
    <div
      className={`relative min-w-[120px] rounded-lg border-2 transition-all ${
        selected
          ? 'border-purple-500 shadow-lg shadow-purple-500/20'
          : 'border-purple-400/50 hover:border-purple-400'
      } bg-gradient-to-br from-purple-900/90 via-purple-800/90 to-purple-700/90 backdrop-blur-sm`}
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