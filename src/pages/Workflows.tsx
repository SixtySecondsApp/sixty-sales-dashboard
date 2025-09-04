import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/clientV2';
import { useUser } from '@/lib/hooks/useUser';
import { isUserAdmin } from '@/lib/utils/adminUtils';
import { 
  Zap, 
  Settings, 
  Activity, 
  BarChart3,
  CheckSquare,
  ArrowRight,
  Play,
  Pause,
  TrendingUp,
  Calendar,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Target,
  Bell,
  Workflow
} from 'lucide-react';

// Import the working components
import PipelineAutomationAdmin from '@/pages/PipelineAutomationAdmin';
import SmartTasksAdmin from '@/pages/SmartTasksAdmin';
import AutomationBuilder from '@/components/AutomationBuilder';

interface WorkflowStats {
  pipelineRules: {
    total: number;
    active: number;
    executions: number;
    successRate: number;
  };
  taskTemplates: {
    total: number;
    active: number;
    executions: number;
    successRate: number;
  };
  recentExecutions: Array<{
    id: string;
    type: 'pipeline' | 'task';
    ruleName: string;
    status: 'success' | 'failed' | 'pending';
    executedAt: string;
    dealName?: string;
    taskTitle?: string;
  }>;
}

export default function Workflows() {
  const { userData: user } = useUser();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<WorkflowStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAutomationBuilder, setShowAutomationBuilder] = useState(false);

  useEffect(() => {
    checkAdminStatus();
    loadWorkflowStats();
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) return;
    
    // Check if user has is_admin property directly
    if (user.is_admin) {
      setIsAdmin(true);
      return;
    }
    
    // Fall back to database check for real users
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
      
      // Load pipeline automation stats
      const { data: pipelineRules } = await supabase
        .from('user_automation_rules')
        .select('*');
        
      const { data: pipelineExecutions } = await supabase
        .from('automation_executions')
        .select('*')
        .order('executed_at', { ascending: false })
        .limit(50);
      
      // Load smart task stats
      const { data: taskTemplates } = await supabase
        .from('smart_task_templates')
        .select('*');

      // Calculate stats
      const pipelineStats = {
        total: pipelineRules?.length || 0,
        active: pipelineRules?.filter(r => r.is_active).length || 0,
        executions: pipelineExecutions?.length || 0,
        successRate: pipelineExecutions?.length > 0 
          ? (pipelineExecutions.filter(e => e.execution_status === 'success').length / pipelineExecutions.length) * 100
          : 0
      };

      const taskStats = {
        total: taskTemplates?.length || 0,
        active: taskTemplates?.filter(t => t.is_active).length || 0,
        executions: 0, // Would need task execution tracking
        successRate: 0
      };

      // Format recent executions
      const recentExecutions = pipelineExecutions?.slice(0, 10).map(exec => ({
        id: exec.id,
        type: 'pipeline' as const,
        ruleName: 'Pipeline Rule', // Would need to join with rules table
        status: exec.execution_status,
        executedAt: exec.executed_at,
        dealName: 'Deal' // Would need to join with deals table
      })) || [];

      setStats({
        pipelineRules: pipelineStats,
        taskTemplates: taskStats,
        recentExecutions
      });
    } catch (error) {
      console.error('Error loading workflow stats:', error);
      // Set mock stats for demo
      setStats({
        pipelineRules: { total: 0, active: 0, executions: 0, successRate: 0 },
        taskTemplates: { total: 0, active: 0, executions: 0, successRate: 0 },
        recentExecutions: []
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAutomationSave = async (automation: any) => {
    try {
      // Save to unified automation system
      const { data, error } = await supabase
        .from('user_automation_rules')
        .insert({
          user_id: user?.id,
          rule_name: automation.rule_name,
          rule_description: automation.rule_description,
          trigger_type: automation.trigger_type,
          trigger_conditions: automation.trigger_config,
          action_type: automation.action_type,
          action_config: automation.action_config,
          is_active: automation.is_active
        })
        .select()
        .single();

      if (error) throw error;

      // Refresh stats
      loadWorkflowStats();
      
      console.log('Automation saved:', data);
    } catch (error) {
      console.error('Failed to save automation:', error);
      throw error;
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-gray-100">
        <div className="p-8 flex items-center justify-center">
          <Card className="bg-gray-900/50 backdrop-blur-xl border-gray-800/50">
            <CardContent className="p-8 text-center">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-amber-400" />
              <h3 className="text-lg font-semibold mb-2">Admin Access Required</h3>
              <p className="text-gray-400">
                Workflow management is restricted to administrators only.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-gray-100">
        <div className="p-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#37bd7e]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-gray-100">
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Workflow className="w-8 h-8 text-[#37bd7e]" />
                Workflow Automation
              </h1>
              <p className="text-gray-400 mt-2">
                Manage pipeline automations and smart task templates
              </p>
            </div>
            
            <button
              onClick={() => setShowAutomationBuilder(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#37bd7e] to-purple-500 hover:from-[#37bd7e]/80 hover:to-purple-500/80 text-white rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <Zap className="w-5 h-5" />
              Create Automation
            </button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50">
              <TabsTrigger 
                value="overview" 
                className="flex items-center gap-2 data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-white"
              >
                <BarChart3 className="w-4 h-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger 
                value="pipeline" 
                className="flex items-center gap-2 data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-white"
              >
                <Zap className="w-4 h-4" />
                Pipeline Automation
              </TabsTrigger>
              <TabsTrigger 
                value="tasks" 
                className="flex items-center gap-2 data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-white"
              >
                <CheckSquare className="w-4 h-4" />
                Smart Tasks
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Stats Grid */}
              {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="bg-gray-900/50 backdrop-blur-xl border-gray-800/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-400">Pipeline Rules</p>
                          <p className="text-2xl font-bold">{stats.pipelineRules.total}</p>
                          <p className="text-xs text-[#37bd7e]">{stats.pipelineRules.active} active</p>
                        </div>
                        <Zap className="w-8 h-8 text-purple-400" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-900/50 backdrop-blur-xl border-gray-800/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-400">Task Templates</p>
                          <p className="text-2xl font-bold">{stats.taskTemplates.total}</p>
                          <p className="text-xs text-[#37bd7e]">{stats.taskTemplates.active} active</p>
                        </div>
                        <CheckSquare className="w-8 h-8 text-blue-400" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-900/50 backdrop-blur-xl border-gray-800/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-400">Total Executions</p>
                          <p className="text-2xl font-bold">{stats.pipelineRules.executions + stats.taskTemplates.executions}</p>
                          <p className="text-xs text-gray-400">All time</p>
                        </div>
                        <Activity className="w-8 h-8 text-green-400" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-900/50 backdrop-blur-xl border-gray-800/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-400">Success Rate</p>
                          <p className="text-2xl font-bold">{Math.round(stats.pipelineRules.successRate)}%</p>
                          <p className="text-xs text-gray-400">Pipeline automation</p>
                        </div>
                        <TrendingUp className="w-8 h-8 text-emerald-400" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Recent Activity */}
              <Card className="bg-gray-900/50 backdrop-blur-xl border-gray-800/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Recent Workflow Executions
                  </CardTitle>
                  <CardDescription>
                    Latest automation executions across all workflow types
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {stats?.recentExecutions.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No recent executions</p>
                      <p className="text-sm">Workflow executions will appear here as they run</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {stats?.recentExecutions.map((execution, index) => (
                        <div key={execution.id || index} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${
                              execution.status === 'success' ? 'bg-green-400' :
                              execution.status === 'failed' ? 'bg-red-400' :
                              'bg-yellow-400'
                            }`} />
                            
                            <div className="flex items-center gap-2">
                              {execution.type === 'pipeline' ? (
                                <Zap className="w-4 h-4 text-purple-400" />
                              ) : (
                                <CheckSquare className="w-4 h-4 text-blue-400" />
                              )}
                            </div>
                            
                            <div>
                              <p className="font-medium">{execution.ruleName}</p>
                              <p className="text-sm text-gray-400">
                                {execution.dealName || execution.taskTitle}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-gray-400">
                            <span>{new Date(execution.executedAt).toLocaleString()}</span>
                            <Badge variant={
                              execution.status === 'success' ? 'default' :
                              execution.status === 'failed' ? 'destructive' :
                              'secondary'
                            }>
                              {execution.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-gray-900/50 backdrop-blur-xl border-gray-800/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-purple-400" />
                      Pipeline Automation
                    </CardTitle>
                    <CardDescription>
                      Automate actions when deals move between pipeline stages
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span>Active Rules:</span>
                        <span className="text-[#37bd7e]">{stats?.pipelineRules.active || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Success Rate:</span>
                        <span className="text-[#37bd7e]">{Math.round(stats?.pipelineRules.successRate || 0)}%</span>
                      </div>
                      <button
                        onClick={() => setActiveTab('pipeline')}
                        className="w-full mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <Settings className="w-4 h-4" />
                        Manage Pipeline Rules
                      </button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-900/50 backdrop-blur-xl border-gray-800/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckSquare className="w-5 h-5 text-blue-400" />
                      Smart Tasks
                    </CardTitle>
                    <CardDescription>
                      Automatically create tasks based on activity triggers
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span>Active Templates:</span>
                        <span className="text-[#37bd7e]">{stats?.taskTemplates.active || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Tasks Created:</span>
                        <span className="text-[#37bd7e]">{stats?.taskTemplates.executions || 0}</span>
                      </div>
                      <button
                        onClick={() => setActiveTab('tasks')}
                        className="w-full mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <Settings className="w-4 h-4" />
                        Manage Task Templates
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Pipeline Automation Tab */}
            <TabsContent value="pipeline" className="space-y-0">
              <PipelineAutomationAdmin />
            </TabsContent>

            {/* Smart Tasks Tab */}
            <TabsContent value="tasks" className="space-y-0">
              <SmartTasksAdmin />
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      {/* Automation Builder Modal */}
      <AutomationBuilder
        isOpen={showAutomationBuilder}
        onClose={() => setShowAutomationBuilder(false)}
        onSave={handleAutomationSave}
      />
    </div>
  );
}