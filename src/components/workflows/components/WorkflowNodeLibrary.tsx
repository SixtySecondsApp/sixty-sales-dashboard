import React, { useState } from 'react';
import { Search, Target, GitBranch, CheckSquare, Sparkles, Image as ImageIcon } from 'lucide-react';
import { iconMap } from '../utils';
import { WORKFLOW_TRIGGERS, WORKFLOW_CONDITIONS, WORKFLOW_ACTIONS, WORKFLOW_AI_NODES } from '../constants';

export const WorkflowNodeLibrary: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const query = searchQuery.toLowerCase();

  const filteredTriggers = WORKFLOW_TRIGGERS.filter(trigger => 
    !searchQuery || 
    trigger.label.toLowerCase().includes(query) ||
    trigger.description.toLowerCase().includes(query)
  );

  const filteredConditions = WORKFLOW_CONDITIONS.filter(condition => 
    !searchQuery || 
    condition.label.toLowerCase().includes(query) ||
    condition.condition.toLowerCase().includes(query)
  );

  const filteredAINodes = WORKFLOW_AI_NODES.filter(node => 
    !searchQuery || 
    node.label.toLowerCase().includes(query) ||
    node.description.toLowerCase().includes(query)
  );

  const filteredActions = WORKFLOW_ACTIONS.filter(action => 
    !searchQuery || 
    action.label.toLowerCase().includes(query) ||
    action.description.toLowerCase().includes(query)
  );

  const hasResults = filteredTriggers.length > 0 || filteredConditions.length > 0 || filteredAINodes.length > 0 || filteredActions.length > 0;

  const handleDragStart = (e: React.DragEvent, type: string, data: any) => {
    e.dataTransfer.setData('nodeType', type);
    e.dataTransfer.setData('nodeData', JSON.stringify(data));
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="flex flex-col h-full bg-[#0f0f0f]">
      {/* Search Bar */}
      <div className="p-4 border-b border-zinc-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search nodes..."
            className="w-full pl-10 pr-4 py-2 bg-[#1e1e1e] border border-zinc-800 rounded-lg text-zinc-200 text-sm placeholder-zinc-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 outline-none transition-colors"
          />
        </div>
      </div>
      
      {/* Node Library Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {!hasResults && searchQuery && (
          <div className="text-center py-8">
            <Search className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 font-medium">No nodes found</p>
            <p className="text-zinc-500 text-sm mt-1">Try searching for different keywords</p>
          </div>
        )}

        {/* AI & Intelligence (Moved to Top) */}
        {filteredAINodes.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">AI & Intelligence</h3>
            <div className="space-y-2">
              {filteredAINodes.map((node) => {
                const NodeIcon = iconMap[node.iconName] || Sparkles;
                return (
                  <div
                    key={node.type}
                    draggable
                    onDragStart={(e) => handleDragStart(e, node.nodeType || 'aiAgent', node)}
                    className="bg-[#1e1e1e] border border-zinc-800 rounded-lg p-3 cursor-move hover:border-purple-500/50 hover:bg-[#252525] transition-all group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded bg-purple-500/10 border border-purple-500/20 group-hover:bg-purple-500/20 transition-colors">
                        <NodeIcon className="w-4 h-4 text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-zinc-200">{node.label}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">{node.description}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Triggers */}
        {filteredTriggers.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">Triggers</h3>
            <div className="space-y-2">
              {filteredTriggers.map((trigger) => {
                const TriggerIcon = iconMap[trigger.iconName] || Target;
                return (
                  <div
                    key={trigger.type}
                    draggable
                    onDragStart={(e) => handleDragStart(e, trigger.nodeType || 'trigger', trigger)}
                    className="bg-[#1e1e1e] border border-zinc-800 rounded-lg p-3 cursor-move hover:border-purple-500/50 hover:bg-[#252525] transition-all group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded bg-purple-500/10 border border-purple-500/20 group-hover:bg-purple-500/20 transition-colors">
                        <TriggerIcon className="w-4 h-4 text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-zinc-200">{trigger.label}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">{trigger.description}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Logic & Routing */}
        {filteredConditions.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">Logic & Routing</h3>
            <div className="space-y-2">
              {filteredConditions.map((condition) => {
                const ConditionIcon = iconMap[condition.iconName] || GitBranch;
                return (
                  <div
                    key={condition.type}
                    draggable
                    onDragStart={(e) => handleDragStart(e, condition.nodeType || 'condition', condition)}
                    className="bg-[#1e1e1e] border border-zinc-800 rounded-lg p-3 cursor-move hover:border-blue-500/50 hover:bg-[#252525] transition-all group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded bg-blue-500/10 border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors">
                        <ConditionIcon className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-zinc-200">{condition.label}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">{condition.condition}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        {filteredActions.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">Actions</h3>
            <div className="space-y-2">
              {filteredActions.map((action) => {
                const ActionIcon = iconMap[action.iconName] || CheckSquare;
                return (
                  <div
                    key={action.type}
                    draggable
                    onDragStart={(e) => handleDragStart(e, action.nodeType || 'action', action)}
                    className="bg-[#1e1e1e] border border-zinc-800 rounded-lg p-3 cursor-move hover:border-emerald-500/50 hover:bg-[#252525] transition-all group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded bg-emerald-500/10 border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-colors">
                        <ActionIcon className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-zinc-200">{action.label}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">{action.description}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Custom Scrollbar Styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #444; }
      `}</style>
    </div>
  );
};
