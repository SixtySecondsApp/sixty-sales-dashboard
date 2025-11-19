import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { CheckSquare, Brain, Users, Calendar, Target, Settings, AlertTriangle } from 'lucide-react';
import { ModernNodeCard } from './ModernNodeCard';

export interface ActionItemProcessorNodeData {
  label?: string;
  isConfigured?: boolean;
  config?: {
    aiEnabled?: boolean;
    roleCategorization?: {
      enabled: boolean;
      salesRepKeywords: string[];
      clientKeywords: string[];
      defaultAssignee: 'sales_rep' | 'client' | 'system';
    };
    deadlineRules?: {
      enabled: boolean;
      urgentDays: number;
      highDays: number;
      mediumDays: number;
      lowDays: number;
      accountForWeekends: boolean;
      accountForHolidays: boolean;
    };
    assignmentRules?: {
      enabled: boolean;
      defaultSalesRep?: string;
      autoAssignToMeetingOwner: boolean;
      escalationRules: {
        urgentTasks: string[];
        highValueDeals: string[];
      };
    };
    salesWorkflow?: {
      enabled: boolean;
      createFollowUpTasks: boolean;
      linkToDeals: boolean;
      updateDealStage: boolean;
      generateProposalTasks: boolean;
      trackClientEngagement: boolean;
    };
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
  testStatus?: string;
  executionMode?: boolean;
  executionData?: any;
  executionStatus?: 'pending' | 'running' | 'completed' | 'failed';
}

const ActionItemProcessorNode = memo(({ data, selected }: NodeProps<ActionItemProcessorNodeData>) => {
  const isConfigured = data.isConfigured || false;
  const config = data.config || {};
  const aiEnabled = config.aiEnabled !== false;
  
  const roleCategorization = config.roleCategorization?.enabled || false;
  const smartDeadlines = config.deadlineRules?.enabled || config.calculateDeadlines || false;
  const assignmentRules = config.assignmentRules?.enabled || false;
  const salesWorkflow = config.salesWorkflow?.enabled || false;

  const mapStatus = () => {
    if (data.executionMode) {
      switch (data.executionStatus) {
        case 'completed': return 'success';
        case 'failed': return 'failed';
        case 'running': return 'active';
        default: return 'idle';
      }
    }
    return data.testStatus === 'active' ? 'active' : undefined;
  };

  const enabledFeatures = [];
  if (aiEnabled) enabledFeatures.push({ name: 'AI Classification', icon: Brain, color: 'yellow' });
  if (roleCategorization) enabledFeatures.push({ name: 'Role Classification', icon: Users, color: 'blue' });
  if (smartDeadlines) enabledFeatures.push({ name: 'Smart Deadlines', icon: Calendar, color: 'green' });
  if (assignmentRules) enabledFeatures.push({ name: 'Auto Assignment', icon: Target, color: 'purple' });
  if (salesWorkflow) enabledFeatures.push({ name: 'Sales Workflow', icon: Target, color: 'emerald' });

  const ConfigBadge = !isConfigured ? (
    <div className="px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 text-[9px] rounded border border-yellow-200 dark:border-yellow-500/30 font-bold mr-1">
      !
    </div>
  ) : null;

  return (
    <ModernNodeCard
      selected={selected}
      icon={CheckSquare}
      title={data.label || 'Smart Action Processor'}
      subtitle={enabledFeatures.length > 0 ? `${enabledFeatures.length} feature${enabledFeatures.length !== 1 ? 's' : ''} enabled` : 'Configure processor'}
      color="text-orange-400"
      status={mapStatus()}
      badge={ConfigBadge}
      className="w-[320px]"
    >
      <div className="p-3 space-y-3 bg-white dark:bg-[#1e1e1e]">
        {enabledFeatures.length > 0 && (
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider">Features</label>
            <div className="flex flex-wrap gap-1">
              {enabledFeatures.map((feature, idx) => {
                const colorClasses = {
                  yellow: 'bg-yellow-100 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/20 text-yellow-700 dark:text-yellow-300',
                  blue: 'bg-blue-100 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-300',
                  green: 'bg-green-100 dark:bg-green-500/10 border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-300',
                  purple: 'bg-purple-100 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20 text-purple-700 dark:text-purple-300',
                  emerald: 'bg-emerald-100 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                };
                const FeatureIcon = feature.icon;
                return (
                  <div key={idx} className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] ${colorClasses[feature.color as keyof typeof colorClasses]}`}>
                    <FeatureIcon size={8} />
                    {feature.name}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {smartDeadlines && config.deadlineRules && (
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider">Deadline Rules</label>
            <div className="grid grid-cols-2 gap-1 text-[9px]">
              <div className="bg-red-100 dark:bg-red-500/10 px-1.5 py-1 rounded border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300">
                Urgent: {config.deadlineRules.urgentDays || 1}d
              </div>
              <div className="bg-orange-100 dark:bg-orange-500/10 px-1.5 py-1 rounded border border-orange-200 dark:border-orange-500/20 text-orange-700 dark:text-orange-300">
                High: {config.deadlineRules.highDays || 3}d
              </div>
              <div className="bg-yellow-100 dark:bg-yellow-500/10 px-1.5 py-1 rounded border border-yellow-200 dark:border-yellow-500/20 text-yellow-700 dark:text-yellow-300">
                Medium: {config.deadlineRules.mediumDays || 7}d
              </div>
              <div className="bg-green-100 dark:bg-green-500/10 px-1.5 py-1 rounded border border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-300">
                Low: {config.deadlineRules.lowDays || 14}d
              </div>
            </div>
          </div>
        )}

        {!isConfigured && (
          <div className="flex items-center gap-2 text-[10px] text-yellow-600 dark:text-yellow-400/80 bg-yellow-50 dark:bg-yellow-500/10 p-2 rounded border border-yellow-200 dark:border-yellow-500/20">
            <AlertTriangle size={12} />
            <span>Configure processing rules</span>
          </div>
        )}
      </div>
    </ModernNodeCard>
  );
});

ActionItemProcessorNode.displayName = 'ActionItemProcessorNode';

export default ActionItemProcessorNode;
