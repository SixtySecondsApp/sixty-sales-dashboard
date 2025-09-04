import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase/clientV2';
import { useUser } from '@/lib/hooks/useUser';
import { isUserAdmin } from '@/lib/utils/adminUtils';
import { 
  Workflow,
  Zap, 
  Activity, 
  CheckCircle,
  AlertTriangle,
  Settings,
  Plus,
  Target,
  ArrowRight,
  CheckSquare,
  TestTube,
  Play,
  Info,
  Clock,
  TrendingUp,
  GitBranch,
  Save,
  Sparkles
} from 'lucide-react';

// Import workflow components
import StatsPanel from '@/components/workflows/StatsPanel';
import ActiveRulesList from '@/components/workflows/ActiveRulesList';
import VisualWorkflowBuilder from '@/components/workflows/VisualWorkflowBuilder';
import ExecutionMonitor from '@/components/workflows/ExecutionMonitor';
import TestingInterface from '@/components/workflows/TestingInterface';

export default function Workflows() {
  const { userData: user } = useUser();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null);
  const [isBuilderExpanded, setIsBuilderExpanded] = useState(false);
  const [stats, setStats] = useState({
    activeRules: 0,
    successRate: 0,
    totalExecutions: 0,
    recentExecutions: []
  });

  useEffect(() => {
    checkAdminStatus();
    loadWorkflowStats();
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) return;
    
    if (user.is_admin) {
      setIsAdmin(true);
      return;
    }
    
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
      
    if (profile) {
      setIsAdmin(isUserAdmin(profile));
    }
  };

  const loadWorkflowStats = async () => {
    try {
      setLoading(true);
      
      const { data: rules } = await supabase
        .from('user_automation_rules')
        .select('*');
        
      const { data: executions } = await supabase
        .from('automation_executions')
        .select('*')
        .order('executed_at', { ascending: false })
        .limit(50);
      
      const activeRules = rules?.filter(r => r.is_active).length || 0;
      const successfulExecutions = executions?.filter(e => e.execution_status === 'success').length || 0;
      const totalExecutions = executions?.length || 0;
      const successRate = totalExecutions > 0 
        ? Math.round((successfulExecutions / totalExecutions) * 100)
        : 0;

      setStats({
        activeRules,
        successRate,
        totalExecutions,
        recentExecutions: executions || []
      });
    } catch (error) {
      console.error('Error loading workflow stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewWorkflow = () => {
    setIsBuilderExpanded(true);
    setSelectedWorkflow(null);
  };

  const handleWorkflowSelect = (workflow: any) => {
    setSelectedWorkflow(workflow);
    setIsBuilderExpanded(true);
  };

  const handleSaveWorkflow = async (workflow: any) => {
    try {
      const { error } = await supabase
        .from('user_automation_rules')
        .insert({
          user_id: user?.id,
          rule_name: workflow.name,
          rule_description: workflow.description,
          trigger_type: workflow.trigger_type,
          trigger_conditions: workflow.trigger_config,
          action_type: workflow.action_type,
          action_config: workflow.action_config,
          is_active: workflow.is_active
        });

      if (error) throw error;
      
      await loadWorkflowStats();
      setIsBuilderExpanded(false);
      setSelectedWorkflow(null);
    } catch (error) {
      console.error('Failed to save workflow:', error);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <div className="p-8 flex items-center justify-center">
          <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-8 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-amber-400" />
            <h3 className="text-lg font-semibold mb-2">Admin Access Required</h3>
            <p className="text-gray-400">
              Workflow management is restricted to administrators only.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <div className="p-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#37bd7e]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="bg-gray-950 border-b border-gray-800/50 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Workflow className="w-8 h-8 text-[#37bd7e]" />
            <div>
              <h1 className="text-2xl font-bold text-white">Workflow Automation</h1>
              <p className="text-sm text-gray-400">Build, test, and manage automations</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors flex items-center">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </button>
            <button 
              onClick={handleNewWorkflow}
              className="px-6 py-2 bg-[#37bd7e] hover:bg-[#37bd7e]/90 text-white rounded-lg transition-colors flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Workflow
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid lg:grid-cols-[320px,1fr] gap-6">
          {/* Left Panel */}
          <div className="space-y-6">
            {/* Stats Panel */}
            <StatsPanel stats={stats} />
            
            {/* Active Rules List */}
            <ActiveRulesList 
              onSelectWorkflow={handleWorkflowSelect}
              onRefresh={loadWorkflowStats}
            />
          </div>

          {/* Main Content Area */}
          <div className="space-y-6">
            {/* Visual Workflow Builder */}
            <VisualWorkflowBuilder
              workflow={selectedWorkflow}
              isExpanded={isBuilderExpanded}
              onSave={handleSaveWorkflow}
              onClose={() => {
                setIsBuilderExpanded(false);
                setSelectedWorkflow(null);
              }}
            />

            {/* Bottom Grid: Execution Monitor & Testing */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Execution Monitor */}
              <ExecutionMonitor executions={stats.recentExecutions} />
              
              {/* Testing Interface */}
              <TestingInterface 
                workflow={selectedWorkflow}
                onTestComplete={loadWorkflowStats}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}