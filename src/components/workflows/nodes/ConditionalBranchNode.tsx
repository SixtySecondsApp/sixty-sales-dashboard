import React from 'react';
import { Handle, Position } from 'reactflow';
import { GitBranch } from 'lucide-react';

interface ConditionalBranchNodeProps {
  data: {
    label?: string;
    conditions?: Array<{
      id: string;
      field: string;
      operator: string;
      value: string;
      output: string;
    }>;
    isConfigured?: boolean;
  };
  selected?: boolean;
}

const ConditionalBranchNode: React.FC<ConditionalBranchNodeProps> = ({ data, selected }) => {
  const conditions = data.conditions || [];
  const isConfigured = data.isConfigured || false;
  
  return (
    <div className={`bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg p-3 min-w-[160px] shadow-lg ${
      selected ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-900' : ''
    } ${isConfigured ? 'opacity-100' : 'opacity-80'}`}>
      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-3 h-3 bg-white border-2 border-blue-500"
      />
      
      {/* Multiple output handles for different branches */}
      <Handle 
        type="source" 
        position={Position.Right} 
        id="transcript"
        style={{ top: '25%' }}
        className="w-3 h-3 bg-yellow-400 border-2 border-yellow-600"
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        id="summary"
        style={{ top: '50%' }}
        className="w-3 h-3 bg-green-400 border-2 border-green-600"
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        id="action_items"
        style={{ top: '75%' }}
        className="w-3 h-3 bg-orange-400 border-2 border-orange-600"
      />
      
      <div className="flex items-center gap-2 text-white mb-2">
        <GitBranch className="w-5 h-5" />
        <div className="font-semibold text-sm">Branch</div>
      </div>
      
      <div className="text-xs text-blue-100 space-y-1">
        {conditions.length > 0 ? (
          <div className="space-y-1">
            {conditions.slice(0, 3).map((condition, idx) => (
              <div key={idx} className="bg-blue-700/50 px-2 py-1 rounded text-[10px]">
                {condition.field} {condition.operator} {condition.value}
              </div>
            ))}
            {conditions.length > 3 && (
              <div className="text-[10px] text-blue-200">
                +{conditions.length - 3} more
              </div>
            )}
          </div>
        ) : (
          <div className="text-blue-200">No conditions</div>
        )}
      </div>
      
      {!isConfigured && (
        <div className="mt-2 text-yellow-300 text-[10px]">
          ⚠️ Configure branches
        </div>
      )}
      
      {/* Branch labels */}
      <div className="absolute -right-20 top-[25%] -translate-y-1/2 text-[10px] text-yellow-400">
        Transcript
      </div>
      <div className="absolute -right-16 top-[50%] -translate-y-1/2 text-[10px] text-green-400">
        Summary
      </div>
      <div className="absolute -right-16 top-[75%] -translate-y-1/2 text-[10px] text-orange-400">
        Actions
      </div>
    </div>
  );
};

export default ConditionalBranchNode;