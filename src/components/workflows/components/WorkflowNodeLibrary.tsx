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
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      <div className="p-4 border-b border-gray-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search nodes..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
          />
        </div>
      </div>
      
      {/* Node Library Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {!hasResults && searchQuery && (
          <div className="text-center py-8">
            <Search className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">No nodes found</p>
            <p className="text-gray-500 text-sm mt-1">Try searching for different keywords</p>
          </div>
        )}

        {/* AI & Intelligence (Moved to Top) */}
        {filteredAINodes.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">AI & Intelligence</h3>
            <div className="space-y-2">
              {filteredAINodes.map((node) => {
                const NodeIcon = iconMap[node.iconName] || Sparkles;
                return (
                  <div
                    key={node.type}
                    draggable
                    onDragStart={(e) => handleDragStart(e, node.nodeType || 'aiAgent', node)}
                    className="bg-purple-50 dark:bg-purple-600/20 border border-purple-200 dark:border-purple-600/30 rounded-lg p-3 cursor-move hover:bg-purple-100 dark:hover:bg-purple-600/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <NodeIcon className="w-4 h-4 text-purple-400" />
                      <div>
                        <div className="text-sm text-gray-900 dark:text-white">{node.label}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">{node.description}</div>
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
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Triggers</h3>
            <div className="space-y-2">
              {filteredTriggers.map((trigger) => {
                const TriggerIcon = iconMap[trigger.iconName] || Target;
                return (
                  <div
                    key={trigger.type}
                    draggable
                    onDragStart={(e) => handleDragStart(e, trigger.nodeType || 'trigger', trigger)}
                    className="bg-purple-50 dark:bg-purple-600/20 border border-purple-200 dark:border-purple-600/30 rounded-lg p-3 cursor-move hover:bg-purple-100 dark:hover:bg-purple-600/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <TriggerIcon className="w-4 h-4 text-purple-400" />
                      <div>
                        <div className="text-sm text-gray-900 dark:text-white">{trigger.label}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">{trigger.description}</div>
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
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Logic & Routing</h3>
            <div className="space-y-2">
              {filteredConditions.map((condition) => {
                const ConditionIcon = iconMap[condition.iconName] || GitBranch;
                return (
                  <div
                    key={condition.type}
                    draggable
                    onDragStart={(e) => handleDragStart(e, condition.nodeType || 'condition', condition)}
                    className="bg-blue-50 dark:bg-blue-600/20 border border-blue-200 dark:border-blue-600/30 rounded-lg p-3 cursor-move hover:bg-blue-100 dark:hover:bg-blue-600/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <ConditionIcon className="w-4 h-4 text-blue-400" />
                      <div>
                        <div className="text-sm text-gray-900 dark:text-white">{condition.label}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">{condition.condition}</div>
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
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Actions</h3>
            <div className="space-y-2">
              {filteredActions.map((action) => {
                const ActionIcon = iconMap[action.iconName] || CheckSquare;
                return (
                  <div
                    key={action.type}
                    draggable
                    onDragStart={(e) => handleDragStart(e, action.nodeType || 'action', action)}
                    className="bg-green-50 dark:bg-green-600/20 border border-green-200 dark:border-green-600/30 rounded-lg p-3 cursor-move hover:bg-green-100 dark:hover:bg-green-600/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <ActionIcon className="w-4 h-4 text-green-400" />
                      <div>
                        <div className="text-sm text-gray-900 dark:text-white">{action.label}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">{action.description}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
