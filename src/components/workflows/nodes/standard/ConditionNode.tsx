import React from 'react';
import { Handle, Position } from 'reactflow';
import { GitBranch } from 'lucide-react';
import { StatusIndicator } from '../../StatusIndicator';
import { mapTestStatusToNodeStatus } from '../../utils';

export const ConditionNode = ({ data, selected }: any) => {
  const status = data.testStatus;
  const nodeStatus = mapTestStatusToNodeStatus(status || 'idle');
  const isActive = status === 'active';
  
  return (
    <div className={`bg-blue-600 rounded-lg p-3 min-w-[132px] border-2 shadow-lg relative transition-all duration-300 ${
      isActive ? 'border-yellow-400 shadow-yellow-400/50 shadow-xl scale-105' : 'border-blue-500'
    } ${selected ? 'ring-2 ring-blue-300' : ''}`}>
      {nodeStatus !== 'idle' && (
        <StatusIndicator 
          status={nodeStatus}
          variant="badge"
          position="top-right"
          size="sm"
        />
      )}
      <Handle type="target" position={Position.Left} className="w-2.5 h-2.5 bg-white border-2 border-blue-500" />
      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 bg-white border-2 border-blue-500" id="true" style={{top: '35%'}} />
      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 bg-white border-2 border-blue-500" id="false" style={{top: '65%'}} />
      <div className="flex items-center gap-1.5 text-white">
        <GitBranch className="w-6 h-6" />
        <div>
          <div className="text-sm font-semibold">{data.label}</div>
          <div className="text-xs opacity-80">{data.condition || 'If condition met'}</div>
        </div>
      </div>
    </div>
  );
};

