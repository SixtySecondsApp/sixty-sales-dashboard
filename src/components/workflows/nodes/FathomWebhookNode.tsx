import React from 'react';
import { Handle, Position } from 'reactflow';
import { Webhook } from 'lucide-react';

interface FathomWebhookNodeProps {
  data: {
    label?: string;
    webhookUrl?: string;
    payloadTypes?: string[];
    isConfigured?: boolean;
    config?: {
      acceptedTopics?: string[];
      extractFathomId?: boolean;
      validatePayload?: boolean;
    };
  };
  selected?: boolean;
}

const FathomWebhookNode: React.FC<FathomWebhookNodeProps> = ({ data, selected }) => {
  const isConfigured = data.isConfigured || false;
  
  return (
    <div className={`bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg p-2 min-w-[120px] shadow-lg ${
      selected ? 'ring-2 ring-purple-400 ring-offset-2 ring-offset-gray-900' : ''
    } ${isConfigured ? 'opacity-100' : 'opacity-80'}`}>
      <Handle 
        type="source" 
        position={Position.Right} 
        id="payload"
        className="w-2.5 h-2.5 bg-white border-2 border-purple-500"
      />
      
      <div className="flex items-center gap-1.5 text-white">
        <Webhook className="w-4 h-4" />
        <div className="font-semibold text-xs">Fathom Webhook</div>
      </div>
      
      {data.payloadTypes && data.payloadTypes.length > 0 && (
        <div className="text-[10px] text-purple-200 mt-1">
          {data.payloadTypes.length} event{data.payloadTypes.length > 1 ? 's' : ''}
        </div>
      )}
      
      {!isConfigured && (
        <div className="mt-1 text-yellow-300 text-[10px]">
          ⚠️ Setup
        </div>
      )}
    </div>
  );
};

export default FathomWebhookNode;