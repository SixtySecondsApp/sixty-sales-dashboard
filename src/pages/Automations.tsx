import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Play, 
  Pause, 
  Activity, 
  Clock, 
  Target, 
  Zap,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Settings,
  BarChart3,
  FileText,
  Bell
} from 'lucide-react';
import { supabase } from '@/lib/supabase/clientV2';
import { useDealStages } from '@/lib/hooks/deals/useDealStages';
import { AutomationRuleBuilder } from '@/components/automation/AutomationRuleBuilder';

interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  fromStage?: string;
  toStage: string;
  isEnabled: boolean;
  executionOrder: number;
  actions: any[];
  createdAt: string;
  updatedAt: string;
}

interface ExecutionLog {
  id: string;
  ruleId: string;
  dealId: string;
  fromStage?: string;
  toStage: string;
  status: 'success' | 'failed' | 'partial';
  executedAt: string;
  executionTime: number;
  actions: any[];
  errorMessage?: string;
}

interface AutomationStats {
  totalRules: number;
  activeRules: number;
  totalExecutions: number;
  successfulExecutions: number;
  averageExecutionTime: number;
  topRules: Array<{ ruleId: string; ruleName: string; executions: number }>;
}

export default function Automations() {
  const { data: dealStages } = useDealStages();
  const [activeTab, setActiveTab] = useState('rules');
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>([]);
  const [stats, setStats] = useState<AutomationStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadRules(),
        loadExecutionLogs(),
        loadStats()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadRules = async () => {
    try {
      const { data, error } = await supabase
        .from('user_automation_rules')
        .select('*')
        .order('execution_order', { ascending: true });

      if (error) throw error;

      setRules(data?.map(rule => ({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        fromStage: rule.from_stage,
        toStage: rule.to_stage,
        isEnabled: rule.is_enabled,
        executionOrder: rule.execution_order,
        actions: rule.actions,
        createdAt: rule.created_at,
        updatedAt: rule.updated_at
      })) || []);
    } catch (error) {
      console.error('Failed to load automation rules:', error);
    }
  };

  const loadExecutionLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('automation_executions')
        .select('*')
        .order('executed_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setExecutionLogs(data?.map(log => ({
        id: log.id,
        ruleId: log.rule_id,
        dealId: log.deal_id,
        fromStage: log.from_stage,
        toStage: log.to_stage,
        status: log.status,
        executedAt: log.executed_at,
        executionTime: log.execution_time_ms,
        actions: log.actions_executed,
        errorMessage: log.error_message
      })) || []);
    } catch (error) {
      console.error('Failed to load execution logs:', error);
    }
  };

  const loadStats = async () => {
    try {
      // Calculate stats from rules and executions
      const totalRules = rules.length;
      const activeRules = rules.filter(rule => rule.isEnabled).length;
      const totalExecutions = executionLogs.length;
      const successfulExecutions = executionLogs.filter(log => log.status === 'success').length;
      const averageExecutionTime = executionLogs.length > 0 
        ? executionLogs.reduce((sum, log) => sum + log.executionTime, 0) / executionLogs.length
        : 0;

      // Calculate top rules by execution count
      const ruleExecutionCounts = executionLogs.reduce((acc, log) => {
        acc[log.ruleId] = (acc[log.ruleId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topRules = Object.entries(ruleExecutionCounts)
        .map(([ruleId, count]) => ({
          ruleId,
          ruleName: rules.find(r => r.id === ruleId)?.name || 'Unknown Rule',
          executions: count
        }))
        .sort((a, b) => b.executions - a.executions)
        .slice(0, 5);

      setStats({
        totalRules,
        activeRules,
        totalExecutions,
        successfulExecutions,
        averageExecutionTime,
        topRules
      });
    } catch (error) {
      console.error('Failed to calculate stats:', error);
    }
  };

  const toggleRuleStatus = async (ruleId: string, isEnabled: boolean) => {
    try {
      const { error } = await supabase
        .from('user_automation_rules')
        .update({ is_enabled: isEnabled })
        .eq('id', ruleId);

      if (error) throw error;

      setRules(prev => prev.map(rule => 
        rule.id === ruleId ? { ...rule, isEnabled } : rule
      ));
    } catch (error) {
      console.error('Failed to toggle rule status:', error);
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this automation rule?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('user_automation_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;

      setRules(prev => prev.filter(rule => rule.id !== ruleId));
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  };

  const handleSaveRule = async (rule: any) => {
    await loadRules();
    setShowBuilder(false);
    setEditingRule(null);
  };

  const getStageNames = () => {
    if (!dealStages) return {};
    return dealStages.reduce((acc, stage) => {
      acc[stage.id] = stage.name;
      return acc;
    }, {} as Record<string, string>);
  };

  const stageNames = getStageNames();

  if (showBuilder || editingRule) {
    return (
      <AutomationRuleBuilder
        rule={editingRule || undefined}
        onSave={handleSaveRule}
        onCancel={() => {
          setShowBuilder(false);
          setEditingRule(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-gray-100">
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Zap className="w-6 h-6 text-[#37bd7e]" />
                Pipeline Automations
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Manage automated workflows for your sales pipeline
              </p>
            </div>
            <Button 
              onClick={() => setShowBuilder(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Automation Rule
            </Button>
          </div>

          {/* Stats Overview */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gray-900/50 backdrop-blur-xl border-gray-800/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Total Rules</p>
                      <p className="text-2xl font-bold">{stats.totalRules}</p>
                    </div>
                    <Settings className="w-8 h-8 text-gray-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-900/50 backdrop-blur-xl border-gray-800/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Active Rules</p>
                      <p className="text-2xl font-bold text-[#37bd7e]">{stats.activeRules}</p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-[#37bd7e]" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-900/50 backdrop-blur-xl border-gray-800/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Total Executions</p>
                      <p className="text-2xl font-bold">{stats.totalExecutions}</p>
                    </div>
                    <Activity className="w-8 h-8 text-blue-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-900/50 backdrop-blur-xl border-gray-800/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Success Rate</p>
                      <p className="text-2xl font-bold">
                        {stats.totalExecutions > 0 
                          ? Math.round((stats.successfulExecutions / stats.totalExecutions) * 100)
                          : 0}%
                      </p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-green-400" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50">
              <TabsTrigger 
                value="rules" 
                className="flex items-center gap-2 data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-white"
              >
                <Settings className="w-4 h-4" />
                Rules
              </TabsTrigger>
              <TabsTrigger 
                value="logs" 
                className="flex items-center gap-2 data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-white"
              >
                <Activity className="w-4 h-4" />
                Execution Logs
              </TabsTrigger>
              <TabsTrigger 
                value="analytics" 
                className="flex items-center gap-2 data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-white"
              >
                <BarChart3 className="w-4 h-4" />
                Analytics
              </TabsTrigger>
            </TabsList>

            {/* Rules Tab */}
            <TabsContent value="rules" className="space-y-4">
              {rules.length === 0 ? (
                <Card className="bg-gray-900/50 backdrop-blur-xl border-gray-800/50">
                  <CardContent className="p-8 text-center">
                    <Zap className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <h3 className="text-lg font-semibold mb-2">No automation rules yet</h3>
                    <p className="text-gray-400 mb-4">
                      Create your first automation rule to get started
                    </p>
                    <Button onClick={() => setShowBuilder(true)}>
                      Create First Rule
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {rules.map((rule) => (
                    <Card key={rule.id} className="bg-gray-900/50 backdrop-blur-xl border-gray-800/50">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <Badge variant={rule.isEnabled ? 'default' : 'secondary'}>
                                {rule.isEnabled ? 'Active' : 'Inactive'}
                              </Badge>
                              <span className="text-sm text-gray-400">Order: {rule.executionOrder}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={rule.isEnabled}
                              onCheckedChange={(checked) => toggleRuleStatus(rule.id, checked)}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingRule(rule)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteRule(rule.id)}
                              className="text-red-400 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div>
                          <CardTitle className="text-lg">{rule.name}</CardTitle>
                          {rule.description && (
                            <CardDescription>{rule.description}</CardDescription>
                          )}
                        </div>
                      </CardHeader>
                      
                      <CardContent>
                        <div className="space-y-4">
                          {/* Trigger */}
                          <div className="flex items-center gap-2 text-sm">
                            <Target className="w-4 h-4 text-[#37bd7e]" />
                            <span>
                              When deal moves from{' '}
                              <Badge variant="outline">
                                {rule.fromStage ? stageNames[rule.fromStage] : 'Any stage'}
                              </Badge>
                              {' to '}
                              <Badge variant="outline">
                                {stageNames[rule.toStage]}
                              </Badge>
                            </span>
                          </div>
                          
                          {/* Actions */}
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Actions ({rule.actions.length}):</p>
                            <div className="flex flex-wrap gap-2">
                              {rule.actions.map((action, index) => {
                                const getActionIcon = () => {
                                  switch (action.type) {
                                    case 'create_activity': return <FileText className="w-3 h-3" />;
                                    case 'create_task': return <Clock className="w-3 h-3" />;
                                    case 'send_notification': return <Bell className="w-3 h-3" />;
                                    default: return <Settings className="w-3 h-3" />;
                                  }
                                };
                                
                                const getActionLabel = () => {
                                  switch (action.type) {
                                    case 'create_activity': return 'Create Activity';
                                    case 'create_task': return 'Create Task';
                                    case 'send_notification': return 'Send Notification';
                                    case 'update_field': return 'Update Field';
                                    default: return action.type;
                                  }
                                };
                                
                                return (
                                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                                    {getActionIcon()}
                                    {getActionLabel()}
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Execution Logs Tab */}
            <TabsContent value="logs" className="space-y-4">
              <Card className="bg-gray-900/50 backdrop-blur-xl border-gray-800/50">
                <CardHeader>
                  <CardTitle>Recent Executions</CardTitle>
                  <CardDescription>
                    Latest automation rule executions and their results
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {executionLogs.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No execution logs yet</p>
                      <p className="text-sm">Logs will appear here when rules are executed</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {executionLogs.slice(0, 20).map((log) => {
                        const rule = rules.find(r => r.id === log.ruleId);
                        
                        return (
                          <div key={log.id} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${
                                log.status === 'success' ? 'bg-green-400' :
                                log.status === 'failed' ? 'bg-red-400' :
                                'bg-yellow-400'
                              }`} />
                              
                              <div>
                                <p className="font-medium">{rule?.name || 'Unknown Rule'}</p>
                                <p className="text-sm text-gray-400">
                                  {log.fromStage ? stageNames[log.fromStage] : 'Any'} → {stageNames[log.toStage]}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm text-gray-400">
                              <span>{log.executionTime}ms</span>
                              <span>{new Date(log.executedAt).toLocaleString()}</span>
                              <Badge variant={
                                log.status === 'success' ? 'default' :
                                log.status === 'failed' ? 'destructive' :
                                'secondary'
                              }>
                                {log.status}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-4">
              {stats && (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="bg-gray-900/50 backdrop-blur-xl border-gray-800/50">
                      <CardHeader>
                        <CardTitle>Top Performing Rules</CardTitle>
                        <CardDescription>
                          Rules with the most executions
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {stats.topRules.length === 0 ? (
                          <p className="text-gray-400 text-center py-4">No execution data available</p>
                        ) : (
                          <div className="space-y-3">
                            {stats.topRules.map((rule, index) => (
                              <div key={rule.ruleId} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <Badge variant="outline">{index + 1}</Badge>
                                  <span>{rule.ruleName}</span>
                                </div>
                                <Badge variant="secondary">{rule.executions} executions</Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="bg-gray-900/50 backdrop-blur-xl border-gray-800/50">
                      <CardHeader>
                        <CardTitle>Performance Metrics</CardTitle>
                        <CardDescription>
                          System performance and reliability
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span>Success Rate</span>
                            <Badge variant="default">
                              {stats.totalExecutions > 0 
                                ? Math.round((stats.successfulExecutions / stats.totalExecutions) * 100)
                                : 0}%
                            </Badge>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span>Average Execution Time</span>
                            <Badge variant="secondary">
                              {Math.round(stats.averageExecutionTime)}ms
                            </Badge>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span>Failed Executions</span>
                            <Badge variant="destructive">
                              {stats.totalExecutions - stats.successfulExecutions}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}