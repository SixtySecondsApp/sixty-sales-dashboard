import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Settings, CheckCircle, XCircle, Clock, PlayCircle, FileText, Database, Code, Plus, Edit2 } from 'lucide-react';

export interface AssistantManagerNodeData {
  label: string;
  config?: {
    operation?: 'create' | 'update';
    assistantId?: string;
    assistantName?: string;
    description?: string;
    model?: string;
    instructions?: string;
    tools?: {
      codeInterpreter?: boolean;
      fileSearch?: boolean;
      functions?: Array<{
        name: string;
        description: string;
        parameters: any;
      }>;
    };
    files?: Array<{
      id: string;
      name: string;
      size: number;
      type: string;
    }>;
    vectorStoreId?: string;
    vectorStoreName?: string;
    metadata?: Record<string, string>;
    temperature?: number;
    topP?: number;
    responseFormat?: 'text' | 'json_object';
  };
  executionMode?: boolean;
  executionData?: any;
  executionStatus?: 'pending' | 'running' | 'completed' | 'failed';
}

const AssistantManagerNode = memo(({ data, selected }: NodeProps<AssistantManagerNodeData>) => {
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

  const isCreateMode = data.config?.operation === 'create';
  const OperationIcon = isCreateMode ? Plus : Edit2;

  // Count enabled tools
  const enabledTools = [];
  if (data.config?.tools?.codeInterpreter) enabledTools.push('Code');
  if (data.config?.tools?.fileSearch) enabledTools.push('Files');
  if (data.config?.tools?.functions?.length) enabledTools.push(`${data.config.tools.functions.length} Fn`);

  return (
    <div
      className={`relative min-w-[140px] rounded-lg border-2 transition-all ${
        selected
          ? 'border-indigo-500 shadow-lg shadow-indigo-500/20'
          : 'border-indigo-400/50 hover:border-indigo-400'
      } ${getExecutionStatusColor()} bg-gradient-to-br from-indigo-900/90 via-purple-800/90 to-indigo-700/90 backdrop-blur-sm`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-indigo-500 !border-indigo-600"
        style={{ width: 10, height: 10 }}
      />
      
      <div className="p-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="p-1 bg-gradient-to-br from-indigo-500/30 to-purple-500/30 rounded-md">
            <Settings className="w-3 h-3 text-indigo-300" />
          </div>
          <span className="text-xs font-semibold text-indigo-100">
            Assistant Manager
          </span>
        </div>
        
        <div className="text-[10px] text-indigo-200/80 font-medium">
          {data.label || (isCreateMode ? 'Create Assistant' : 'Update Assistant')}
        </div>
        
        {/* Operation Badge */}
        <div className="mt-1.5 flex items-center gap-1">
          <OperationIcon className="w-2.5 h-2.5 text-indigo-300/60" />
          <span className="text-[9px] text-indigo-300/60 capitalize">
            {data.config?.operation || 'create'}
          </span>
        </div>

        {/* Assistant Name */}
        {data.config?.assistantName && (
          <div className="mt-1 text-[9px] text-indigo-300/60 truncate">
            {data.config.assistantName}
          </div>
        )}

        {/* Model */}
        {data.config?.model && (
          <div className="mt-1 text-[8px] text-indigo-300/50 truncate">
            Model: {data.config.model}
          </div>
        )}

        {/* Tools Indicators */}
        {enabledTools.length > 0 && (
          <div className="mt-1.5 flex items-center gap-1 flex-wrap">
            {data.config?.tools?.codeInterpreter && (
              <div className="px-1 py-0.5 bg-blue-900/30 rounded text-[7px] text-blue-400 flex items-center gap-0.5">
                <Code className="w-2 h-2" />
                Code
              </div>
            )}
            {data.config?.tools?.fileSearch && (
              <div className="px-1 py-0.5 bg-green-900/30 rounded text-[7px] text-green-400 flex items-center gap-0.5">
                <Database className="w-2 h-2" />
                Search
              </div>
            )}
            {data.config?.tools?.functions?.length && (
              <div className="px-1 py-0.5 bg-purple-900/30 rounded text-[7px] text-purple-400">
                {data.config.tools.functions.length} Fn
              </div>
            )}
          </div>
        )}

        {/* File Count */}
        {data.config?.files && data.config.files.length > 0 && (
          <div className="mt-1 flex items-center gap-1">
            <FileText className="w-2.5 h-2.5 text-indigo-300/50" />
            <span className="text-[8px] text-indigo-300/50">
              {data.config.files.length} file{data.config.files.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Execution Status Overlay */}
        {data.executionMode && (
          <div className="mt-2 flex items-center gap-2">
            {getExecutionStatusIcon()}
            <span className="text-[8px] text-indigo-200/70 capitalize">
              {data.executionStatus}
            </span>
          </div>
        )}

        {/* Execution Data */}
        {data.executionMode && data.executionData && (
          <div className="mt-1 text-[8px] text-indigo-300/50 truncate">
            {data.executionData.assistantId ? `ID: ${data.executionData.assistantId.slice(0, 8)}...` : 'Processing...'}
          </div>
        )}
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-indigo-500 !border-indigo-600"
        style={{ width: 10, height: 10 }}
      />
      
      {/* Configuration Indicator */}
      {(data.config?.assistantName || data.config?.assistantId) && (
        <div className="absolute -top-2 -right-2">
          <div className="relative">
            <div className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse" />
            <div className="absolute inset-0 w-3 h-3 bg-indigo-400 rounded-full animate-ping" />
          </div>
        </div>
      )}

      {/* OpenAI Badge */}
      <div className="absolute -bottom-1 -right-1 px-1 py-0.5 bg-black/60 rounded text-[7px] text-indigo-400 font-mono">
        OpenAI
      </div>
    </div>
  );
});

AssistantManagerNode.displayName = 'AssistantManagerNode';

export default AssistantManagerNode;