import React from 'react';
import { Handle, Position } from 'reactflow';
import { Database } from 'lucide-react';

interface MeetingUpsertNodeProps {
  data: {
    label?: string;
    table?: string;
    upsertKey?: string;
    fields?: string[];
    isConfigured?: boolean;
    config?: {
      handleAttendees?: boolean;
      storeEmbedUrl?: boolean;
      processMetrics?: boolean;
      aiTrainingMetadata?: boolean;
      linkContacts?: boolean;
      enrichContacts?: boolean;
      createCompanies?: boolean;
      updateEngagement?: boolean;
    };
  };
  selected?: boolean;
}

const MeetingUpsertNode: React.FC<MeetingUpsertNodeProps> = ({ data, selected }) => {
  const isConfigured = data.isConfigured || false;
  const config = data.config || {};
  
  return (
    <div className={`bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-3 min-w-[180px] shadow-lg ${
      selected ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-900' : ''
    } ${isConfigured ? 'opacity-100' : 'opacity-80'}`}>
      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-3 h-3 bg-white border-2 border-blue-500"
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        className="w-3 h-3 bg-white border-2 border-blue-500"
      />
      
      <div className="flex items-center gap-2 text-white mb-2">
        <Database className="w-5 h-5" />
        <div className="font-semibold text-sm">Upsert Meeting</div>
      </div>
      
      <div className="text-xs text-blue-100 space-y-1">
        <div className="bg-blue-700/50 px-2 py-1 rounded">
          Table: {data.table || 'meetings'}
        </div>
        
        {data.upsertKey && (
          <div className="bg-blue-700/50 px-2 py-1 rounded">
            Key: {data.upsertKey}
          </div>
        )}
        
        <div className="space-y-1 mt-2">
          {config.handleAttendees && (
            <div className="flex items-center gap-1">
              <span className="text-blue-300">✓</span>
              <span className="text-[10px]">Process attendees</span>
            </div>
          )}
          {config.linkContacts && (
            <div className="flex items-center gap-1">
              <span className="text-green-400">🔗</span>
              <span className="text-[10px]">Link contacts</span>
            </div>
          )}
          {config.enrichContacts && (
            <div className="flex items-center gap-1">
              <span className="text-yellow-400">⚡</span>
              <span className="text-[10px]">Enrich contacts</span>
            </div>
          )}
          {config.createCompanies && (
            <div className="flex items-center gap-1">
              <span className="text-purple-400">🏢</span>
              <span className="text-[10px]">Create companies</span>
            </div>
          )}
          {config.updateEngagement && (
            <div className="flex items-center gap-1">
              <span className="text-orange-400">📊</span>
              <span className="text-[10px]">Update engagement</span>
            </div>
          )}
          {config.storeEmbedUrl && (
            <div className="flex items-center gap-1">
              <span className="text-blue-300">✓</span>
              <span className="text-[10px]">Store embed URL</span>
            </div>
          )}
          {config.processMetrics && (
            <div className="flex items-center gap-1">
              <span className="text-blue-300">✓</span>
              <span className="text-[10px]">Process metrics</span>
            </div>
          )}
          {config.aiTrainingMetadata && (
            <div className="flex items-center gap-1">
              <span className="text-blue-300">✓</span>
              <span className="text-[10px]">AI metadata</span>
            </div>
          )}
        </div>
      </div>
      
      {!isConfigured && (
        <div className="mt-2 text-yellow-300 text-[10px]">
          ⚠️ Configure fields
        </div>
      )}
    </div>
  );
};

export default MeetingUpsertNode;