import React from 'react';
import { Handle, Position } from 'reactflow';
import { CheckSquare, Brain, Users, Calendar, Target, AlertTriangle } from 'lucide-react';

interface ActionItemProcessorNodeProps {
  data: {
    label?: string;
    isConfigured?: boolean;
    config?: {
      // Core AI settings
      aiEnabled?: boolean;
      
      // Role-based categorization
      roleCategorization?: {
        enabled: boolean;
        salesRepKeywords: string[];
        clientKeywords: string[];
        defaultAssignee: 'sales_rep' | 'client' | 'system';
      };
      
      // Smart deadline calculation
      deadlineRules?: {
        enabled: boolean;
        urgentDays: number;
        highDays: number;
        mediumDays: number;
        lowDays: number;
        accountForWeekends: boolean;
        accountForHolidays: boolean;
      };
      
      // Task assignment logic
      assignmentRules?: {
        enabled: boolean;
        defaultSalesRep?: string;
        autoAssignToMeetingOwner: boolean;
        escalationRules: {
          urgentTasks: string[];
          highValueDeals: string[];
        };
      };
      
      // Sales workflow integration
      salesWorkflow?: {
        enabled: boolean;
        createFollowUpTasks: boolean;
        linkToDeals: boolean;
        updateDealStage: boolean;
        generateProposalTasks: boolean;
        trackClientEngagement: boolean;
      };
      
      // Legacy settings for backward compatibility
      priorityMapping?: {
        urgent: string;
        high: string;
        medium: string;
        low: string;
      };
      userMapping?: {
        [key: string]: string;
      };
      categoryOptions?: string[];
      calculateDeadlines?: boolean;
      accountForWeekends?: boolean;
    };
  };
  selected?: boolean;
}

const ActionItemProcessorNode: React.FC<ActionItemProcessorNodeProps> = ({ data, selected }) => {
  const isConfigured = data.isConfigured || false;
  const config = data.config || {};
  const aiEnabled = config.aiEnabled !== false;
  
  // Enhanced feature flags
  const roleCategorization = config.roleCategorization?.enabled || false;
  const smartDeadlines = config.deadlineRules?.enabled || config.calculateDeadlines || false;
  const assignmentRules = config.assignmentRules?.enabled || false;
  const salesWorkflow = config.salesWorkflow?.enabled || false;
  
  return (
    <div className={`bg-orange-600 dark:bg-orange-600/20 backdrop-blur-sm border border-orange-500 dark:border-orange-500/30 rounded-lg p-3 min-w-[200px] shadow-sm dark:shadow-none ${
      selected ? 'ring-2 ring-orange-500 ring-offset-2 ring-offset-white dark:ring-offset-gray-950' : ''
    } ${isConfigured ? 'opacity-100' : 'opacity-80'}`}>
      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-3 h-3 bg-white border-2 border-orange-500"
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        className="w-3 h-3 bg-white border-2 border-orange-500"
      />
      
      <div className="flex items-center gap-2 text-white mb-2">
        <div className="flex items-center gap-1">
          <CheckSquare className="w-5 h-5" />
          {aiEnabled && <Brain className="w-4 h-4 text-yellow-300" />}
          {salesWorkflow && <Target className="w-4 h-4 text-green-300" />}
        </div>
        <div className="font-semibold text-sm">Smart Action Processor</div>
      </div>
      
      <div className="text-xs text-orange-100 space-y-1">
        {/* AI Classification */}
        {aiEnabled && (
          <div className="bg-orange-700/50 px-2 py-1 rounded flex items-center gap-1">
            <Brain className="w-3 h-3" />
            <span>AI Classification</span>
          </div>
        )}
        
        {/* Role-based Categorization */}
        {roleCategorization && (
          <div className="bg-blue-600/50 px-2 py-1 rounded flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>Role Classification</span>
          </div>
        )}
        
        {/* Smart Deadlines */}
        {smartDeadlines && (
          <div className="bg-green-600/50 px-2 py-1 rounded flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>Smart Deadlines</span>
          </div>
        )}
        
        {/* Assignment Rules */}
        {assignmentRules && (
          <div className="bg-purple-600/50 px-2 py-1 rounded flex items-center gap-1">
            <Target className="w-3 h-3" />
            <span>Auto Assignment</span>
          </div>
        )}
        
        {/* Sales Workflow Integration */}
        {salesWorkflow && (
          <div className="bg-emerald-600/50 px-2 py-1 rounded flex items-center gap-1">
            <Target className="w-3 h-3" />
            <span>Sales Workflow</span>
          </div>
        )}
        
        {/* Enhanced Features Details */}
        <div className="space-y-1 mt-2">
          {roleCategorization && (
            <div className="space-y-0.5">
              <div className="text-[10px] text-orange-200">Role Categories:</div>
              <div className="flex gap-1">
                <span className="bg-blue-800/50 px-1 py-0.5 rounded text-[9px]">Sales Rep</span>
                <span className="bg-blue-800/50 px-1 py-0.5 rounded text-[9px]">Client</span>
                <span className="bg-blue-800/50 px-1 py-0.5 rounded text-[9px]">System</span>
              </div>
            </div>
          )}
          
          {smartDeadlines && (
            <div className="space-y-0.5">
              <div className="text-[10px] text-orange-200">Deadline Rules:</div>
              <div className="grid grid-cols-2 gap-1 text-[9px]">
                <span className="bg-red-800/50 px-1 py-0.5 rounded">
                  Urgent: {config.deadlineRules?.urgentDays || 1}d
                </span>
                <span className="bg-orange-800/50 px-1 py-0.5 rounded">
                  High: {config.deadlineRules?.highDays || 3}d
                </span>
                <span className="bg-yellow-800/50 px-1 py-0.5 rounded">
                  Medium: {config.deadlineRules?.mediumDays || 7}d
                </span>
                <span className="bg-green-800/50 px-1 py-0.5 rounded">
                  Low: {config.deadlineRules?.lowDays || 14}d
                </span>
              </div>
            </div>
          )}
          
          {assignmentRules && (
            <div className="space-y-0.5">
              <div className="text-[10px] text-orange-200">Assignment:</div>
              <div className="flex flex-wrap gap-1">
                {config.assignmentRules?.autoAssignToMeetingOwner && (
                  <span className="bg-purple-800/50 px-1 py-0.5 rounded text-[9px]">
                    Meeting Owner
                  </span>
                )}
                {config.assignmentRules?.escalationRules.urgentTasks.length > 0 && (
                  <span className="bg-red-800/50 px-1 py-0.5 rounded text-[9px]">
                    Escalation
                  </span>
                )}
              </div>
            </div>
          )}
          
          {salesWorkflow && (
            <div className="space-y-0.5">
              <div className="text-[10px] text-orange-200">Sales Features:</div>
              <div className="flex flex-wrap gap-1">
                {config.salesWorkflow?.linkToDeals && (
                  <span className="bg-emerald-800/50 px-1 py-0.5 rounded text-[9px]">
                    Deal Link
                  </span>
                )}
                {config.salesWorkflow?.generateProposalTasks && (
                  <span className="bg-emerald-800/50 px-1 py-0.5 rounded text-[9px]">
                    Proposals
                  </span>
                )}
                {config.salesWorkflow?.trackClientEngagement && (
                  <span className="bg-emerald-800/50 px-1 py-0.5 rounded text-[9px]">
                    Engagement
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Legacy category display */}
        {config.categoryOptions && config.categoryOptions.length > 0 && (
          <div className="mt-2 space-y-0.5">
            <div className="text-[10px] text-orange-200">Categories:</div>
            <div className="flex flex-wrap gap-1">
              {config.categoryOptions.slice(0, 2).map((cat, idx) => (
                <span key={idx} className="bg-orange-800/50 px-1 py-0.5 rounded text-[9px]">
                  {cat}
                </span>
              ))}
              {config.categoryOptions.length > 2 && (
                <span className="text-[9px] text-orange-300">
                  +{config.categoryOptions.length - 2}
                </span>
              )}
            </div>
          </div>
        )}
        
        {/* Legacy feature indicators */}
        <div className="space-y-1 mt-2">
          {(config.calculateDeadlines || smartDeadlines) && (
            <div className="flex items-center gap-1">
              <span className="text-orange-300">✓</span>
              <span className="text-[10px]">Smart deadlines</span>
            </div>
          )}
          {(config.accountForWeekends || config.deadlineRules?.accountForWeekends) && (
            <div className="flex items-center gap-1">
              <span className="text-orange-300">✓</span>
              <span className="text-[10px]">Skip weekends</span>
            </div>
          )}
          {config.deadlineRules?.accountForHolidays && (
            <div className="flex items-center gap-1">
              <span className="text-orange-300">✓</span>
              <span className="text-[10px]">Skip holidays</span>
            </div>
          )}
        </div>
      </div>
      
      {!isConfigured && (
        <div className="mt-2 text-yellow-300 text-[10px] flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          <span>Configure processing rules</span>
        </div>
      )}
    </div>
  );
};

export default ActionItemProcessorNode;