import React from 'react';
import { Handle, Position } from 'reactflow';
import { Target } from 'lucide-react';
import { StatusIndicator } from '../../StatusIndicator';
import { iconMap, mapTestStatusToNodeStatus } from '../../utils';

export const TriggerNode = ({ data, selected }: any) => {
  const Icon = data.iconName ? iconMap[data.iconName] : Target;
  const status = data.testStatus;
  const nodeStatus = mapTestStatusToNodeStatus(status || 'idle');
  const isActive = status === 'active';
  
  return (
    <div className={`bg-purple-600 rounded-lg p-3 min-w-[144px] border-2 shadow-lg relative transition-all duration-300 ${
      isActive ? 'border-yellow-400 shadow-yellow-400/50 shadow-xl scale-105' : 'border-purple-500'
    } ${selected ? 'ring-2 ring-purple-300' : ''}`}>
      {nodeStatus !== 'idle' && (
        <StatusIndicator 
          status={nodeStatus}
          variant="badge"
          position="top-right"
          size="sm"
        />
      )}
      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 bg-white border-2 border-purple-500" />
      <div className="flex items-center gap-1.5 text-white">
        <Icon className="w-6 h-6" />
        <div>
          <div className="text-sm font-semibold">{data.label}</div>
          <div className="text-xs opacity-80">{data.description}</div>
        </div>
      </div>
    </div>
  );
};

