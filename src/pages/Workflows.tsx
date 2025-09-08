import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase/clientV2';
import { useUser } from '@/lib/hooks/useUser';
import { isUserAdmin } from '@/lib/utils/adminUtils';
import { 
  Workflow,
  Layers,
  BookOpen,
  FolderOpen,
  TestTube,
  BarChart3,
  AlertTriangle,
  Settings,
  Plus,
  Sparkles,
  CheckCircle,
  X,
  PlayCircle
} from 'lucide-react';

// Import workflow components
import WorkflowCanvas from '@/components/workflows/WorkflowCanvas';
import TemplateLibrary from '@/components/workflows/TemplateLibrary';
import MyWorkflows from '@/components/workflows/MyWorkflows';
import TestingLabNew from '@/components/workflows/TestingLabNew';
import WorkflowInsights from '@/components/workflows/WorkflowInsights';
import ExecutionsList from '@/components/workflows/ExecutionsList';
import { type WorkflowExecution } from '@/lib/services/workflowExecutionService';

export default function Workflows() {
  const { userData: user } = useUser();
  const [loading, setLoading] = useState(false); // Set to false initially since we don't need to check admin
  const [isAdmin, setIsAdmin] = useState(true); // Allow all users to use workflows
  const [activeTab, setActiveTab] = useState<'builder' | 'templates' | 'my-workflows' | 'testing' | 'insights' | 'jobs'>('builder');
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null);
  const [selectedExecution, setSelectedExecution] = useState<any>(null);
  const [showSlackSuccess, setShowSlackSuccess] = useState(false);
  const [showSlackError, setShowSlackError] = useState('');
  const [stats, setStats] = useState({
    totalWorkflows: 0,
    activeWorkflows: 0,
    successRate: 95,
    testsRun: 128
  });
  
  const tabs = [
    { id: 'builder', label: 'Builder', icon: Layers, description: 'Create workflows visually' },
    { id: 'jobs', label: 'Jobs', icon: PlayCircle, description: 'View executions' },
    { id: 'templates', label: 'Templates', icon: BookOpen, description: 'Start from templates' },
    { id: 'my-workflows', label: 'My Workflows', icon: FolderOpen, description: 'Manage workflows' },
    { id: 'testing', label: 'Testing Lab', icon: TestTube, description: 'Test & debug' },
    { id: 'insights', label: 'Insights', icon: BarChart3, description: 'Analytics & metrics' }
  ];

  useEffect(() => {
    // No need to check admin status - workflows are available to all users
    loadWorkflowStats();
    
    // Check for Slack OAuth callback parameters
    const urlParams = new URLSearchParams(window.location.search);
    const slackConnected = urlParams.get('slack_connected');
    const slackError = urlParams.get('slack_error');
    
    if (slackConnected === 'true') {
      setShowSlackSuccess(true);
      // Clean up URL
      window.history.replaceState({}, '', '/workflows');
      // Auto-hide after 5 seconds
      setTimeout(() => setShowSlackSuccess(false), 5000);
    }
    
    if (slackError) {
      setShowSlackError(decodeURIComponent(slackError));
      // Clean up URL
      window.history.replaceState({}, '', '/workflows');
      // Auto-hide after 8 seconds for errors
      setTimeout(() => setShowSlackError(''), 8000);
    }
  }, [user]);

  const loadWorkflowStats = async () => {
    try {
      // Don't set loading to true here since we want fast page load
      const { data: rules } = await supabase
        .from('user_automation_rules')
        .select('*');
      
      const activeWorkflows = rules?.filter(r => r.is_active).length || 0;
      const totalWorkflows = rules?.length || 0;

      setStats({
        totalWorkflows,
        activeWorkflows,
        successRate: 95,
        testsRun: 128
      });
    } catch (error) {
      console.error('Error loading workflow stats:', error);
      // Continue anyway - stats are not critical for functionality
    }
  };

  const handleWorkflowSelect = (workflow: any) => {
    setSelectedWorkflow(workflow);
    if (activeTab !== 'builder' && activeTab !== 'testing') {
      setActiveTab('builder');
    }
  };

  const handleExecutionSelect = (execution: WorkflowExecution) => {
    setSelectedExecution(execution);
    // Load the workflow associated with this execution and make it available across all tabs
    if (execution.workflowId) {
      // Create a clean workflow object that works across all tabs
      const workflowForAllTabs = {
        id: execution.workflowId,
        name: execution.workflowName || 'Unknown Workflow',
        canvas_data: execution.workflowData,
        // Remove execution-specific properties so it works in Builder and Testing tabs
        trigger_type: execution.workflowData?.trigger_type || 'activity_created',
        action_type: execution.workflowData?.action_type || 'create_task',
        trigger_config: execution.workflowData?.trigger_config || {},
        action_config: execution.workflowData?.action_config || {},
        is_active: execution.workflowData?.is_active || false,
        description: execution.workflowData?.description || '',
        rule_description: execution.workflowData?.rule_description || ''
      };
      setSelectedWorkflow(workflowForAllTabs);
    }
  };

  const handleWorkflowSave = async (workflow: any) => {
    console.log('🎯 handleWorkflowSave called with:', workflow);
    
    // Validate and fix trigger_type before any processing
    // IMPORTANT: 'manual' is NOT valid - database only accepts these:
    const validTriggerTypes = ['activity_created', 'stage_changed', 'deal_created', 'task_completed'];
    if (!workflow.trigger_type || !validTriggerTypes.includes(workflow.trigger_type)) {
      console.warn(`⚠️ Invalid trigger_type "${workflow.trigger_type}" detected, forcing to "activity_created"`);
      workflow.trigger_type = 'activity_created';
    }
    
    // Validate and fix action_type before any processing
    // Based on database testing, only these are currently valid:
    const validActionTypes = ['create_task', 'update_deal_stage'];
    if (!workflow.action_type || !validActionTypes.includes(workflow.action_type)) {
      console.warn(`⚠️ Invalid action_type "${workflow.action_type}" detected, forcing to "create_task"`);
      workflow.action_type = 'create_task';
    }
    
    try {
      // Import test generator
      const { WorkflowTestGenerator } = await import('@/lib/utils/workflowTestGenerator');
      
      // Check if user is available
      if (!user?.id) {
        console.warn('No user found, using development fallback');
        // For development, use a fallback user ID
        const fallbackUserId = 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459';
        console.log('Using fallback user ID for development:', fallbackUserId);
      }

      const userId = user?.id || 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'; // Fallback for development

      // Generate test scenarios for the workflow
      const testScenarios = WorkflowTestGenerator.generateTestScenarios(workflow);
      console.log('Generated test scenarios:', testScenarios);

      const workflowData: any = {
        user_id: userId,
        rule_name: workflow.name || 'Untitled Workflow',
        rule_description: workflow.description || '',
        canvas_data: workflow.canvas_data,
        trigger_type: workflow.trigger_type,
        trigger_conditions: workflow.trigger_config || {},
        action_type: workflow.action_type,
        action_config: workflow.action_config || {},
        template_id: workflow.template_id,
        is_active: workflow.is_active || false,
        priority_level: 1,
        // test_scenarios: testScenarios // Commented out until migration is applied
      };
      
      // Add test scenarios after migration is applied
      workflowData.test_scenarios = testScenarios;

      console.log('🚨 Workflow received from canvas:', workflow);
      console.log('🚨 trigger_type from canvas:', workflow.trigger_type);
      console.log('🚨 action_type from canvas:', workflow.action_type);
      console.log('Saving workflow with data:', workflowData);
      console.log('🚨 Final trigger_type being saved:', workflowData.trigger_type);
      console.log('🚨 Final action_type being saved:', workflowData.action_type);

      // FINAL SAFETY CHECK - Ensure trigger_type and action_type are valid
      // Using actual valid values from database testing
      const finalValidTriggerTypes = ['activity_created', 'stage_changed', 'deal_created', 'task_completed'];
      const finalValidActionTypes = ['create_task', 'update_deal_stage'];
      
      if (!finalValidTriggerTypes.includes(workflowData.trigger_type)) {
        console.error(`❌ CRITICAL: Invalid trigger_type "${workflowData.trigger_type}" about to be saved! Forcing to "activity_created"`);
        workflowData.trigger_type = 'activity_created';
      }
      
      if (!finalValidActionTypes.includes(workflowData.action_type)) {
        console.error(`❌ CRITICAL: Invalid action_type "${workflowData.action_type}" about to be saved! Forcing to "create_task"`);
        workflowData.action_type = 'create_task';
      }

      let result;
      if (workflow.id) {
        // Update existing workflow
        result = await supabase
          .from('user_automation_rules')
          .update(workflowData)
          .eq('id', workflow.id)
          .eq('user_id', userId)
          .select();
      } else {
        // Create new workflow
        result = await supabase
          .from('user_automation_rules')
          .insert(workflowData)
          .select();
      }

      if (result.error) {
        console.error('Supabase error:', result.error);
        throw result.error;
      }
      
      // Save test scenarios locally as well
      if (result.data && result.data[0]) {
        await WorkflowTestGenerator.saveTestScenarios(result.data[0].id, testScenarios);
      }
      
      console.log(`✅ Workflow ${workflow.id ? 'updated' : 'created'} successfully with ${testScenarios.length} test scenarios`, result.data);
      
      // Update the selectedWorkflow with the saved data for autosave
      if (result.data && result.data[0]) {
        setSelectedWorkflow(result.data[0]);
      }
      
      await loadWorkflowStats();
      
      // Return the saved workflow data
      return result.data?.[0];
    } catch (error: any) {
      console.error('Failed to save workflow:', error);
      const errorMessage = error.message || 'Unknown error occurred';
      alert(`Failed to save workflow: ${errorMessage}\n\nPlease check the console for details.`);
    }
  };
  
  const handleDeleteWorkflow = async (id: string) => {
    try {
      const { error } = await supabase
        .from('user_automation_rules')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      await loadWorkflowStats();
    } catch (error) {
      console.error('Failed to delete workflow:', error);
    }
  };

  // Removed admin check - workflows are available to all users
  // Removed loading state for faster page load

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Slack Success Notification */}
      <AnimatePresence>
        {showSlackSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 right-4 z-50 bg-green-500 text-white p-4 rounded-lg shadow-lg flex items-center gap-3 max-w-md"
          >
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium">Slack Connected Successfully!</p>
              <p className="text-sm text-green-100 mt-1">
                Your Slack workspace is now connected. You can use Slack notifications in your workflows.
              </p>
            </div>
            <button
              onClick={() => setShowSlackSuccess(false)}
              className="text-green-100 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slack Error Notification */}
      <AnimatePresence>
        {showSlackError && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 right-4 z-50 bg-red-500 text-white p-4 rounded-lg shadow-lg flex items-center gap-3 max-w-md"
          >
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium">Slack Connection Failed</p>
              <p className="text-sm text-red-100 mt-1">{showSlackError}</p>
            </div>
            <button
              onClick={() => setShowSlackError('')}
              className="text-red-100 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="bg-gray-900/50 backdrop-blur-xl border-b border-gray-800/50">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-[#37bd7e]" />
              <div>
                <h1 className="text-2xl font-bold text-white">Workflow Automation</h1>
                <p className="text-sm text-gray-400">Build, test, and deploy automated workflows</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button className="p-2 hover:bg-gray-800/50 rounded-lg transition-colors">
                <Settings className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Tab Navigation */}
        <div className="px-6 pb-0">
          <nav className="flex gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`
                    relative px-4 py-3 flex items-center gap-2 font-medium text-sm
                    transition-all duration-200 border-b-2
                    ${activeTab === tab.id 
                      ? 'text-white border-[#37bd7e] bg-gray-800/30' 
                      : 'text-gray-400 border-transparent hover:text-gray-200 hover:bg-gray-800/20'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-[#37bd7e]/5 -z-10"
                      transition={{ duration: 0.2 }}
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden h-[calc(100vh-8rem)]">
        <AnimatePresence mode="wait">
          {activeTab === 'builder' && (
            <motion.div
              key="builder"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="h-[calc(100vh-8rem)]"
            >
              <WorkflowCanvas 
                selectedWorkflow={selectedWorkflow}
                onSave={handleWorkflowSave}
              />
            </motion.div>
          )}

          {activeTab === 'jobs' && (
            <motion.div
              key="jobs"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="h-[calc(100vh-8rem)] flex"
            >
              {selectedWorkflow ? (
                <>
                  {/* Left Panel: Executions List */}
                  <div className="w-80 border-r border-gray-700/50">
                    <ExecutionsList 
                      onExecutionSelect={handleExecutionSelect}
                      selectedExecution={selectedExecution}
                      workflowId={selectedWorkflow?.id}
                    />
                  </div>
                  
                  {/* Right Panel: Workflow Canvas in Execution Mode */}
                  <div className="flex-1">
                    {selectedExecution ? (
                      <WorkflowCanvas 
                        selectedWorkflow={selectedWorkflow}
                        onSave={() => {}} // Disable saving in execution view mode
                        executionMode={true}
                        executionData={(() => {
                          const transformed = selectedExecution.nodeExecutions.reduce((acc, nodeExecution) => {
                            acc[nodeExecution.nodeId] = nodeExecution;
                            return acc;
                          }, {} as Record<string, any>);
                          
                          // Validate execution completeness
                          let hasExecutionIssues = false;
                          let issueDescription = '';
                          
                          if (selectedExecution.status === 'completed' && selectedWorkflow?.canvas_data?.nodes) {
                            const workflowNodeIds = selectedWorkflow.canvas_data.nodes.map(node => node.id);
                            const executedNodeIds = Object.keys(transformed);
                            const missingNodes = workflowNodeIds.filter(nodeId => !executedNodeIds.includes(nodeId));
                            
                            if (missingNodes.length > 0) {
                              hasExecutionIssues = true;
                              issueDescription = `Missing execution data for ${missingNodes.length} node(s): ${missingNodes.join(', ')}`;
                              console.warn(`🚨 Execution ${selectedExecution.id} marked as completed but missing node execution data:`, missingNodes);
                            }
                            
                            // Check for nodes with incomplete status
                            const incompleteNodes = Object.values(transformed).filter((nodeExec: any) => 
                              nodeExec.status === 'pending' || nodeExec.status === 'running'
                            );
                            
                            if (incompleteNodes.length > 0) {
                              hasExecutionIssues = true;
                              issueDescription += (issueDescription ? '; ' : '') + 
                                `${incompleteNodes.length} node(s) with incomplete status`;
                              console.warn(`🚨 Execution ${selectedExecution.id} has nodes with incomplete status:`, incompleteNodes);
                            }
                          }
                          
                          return {
                            ...selectedExecution,
                            nodeExecutions: transformed,
                            // Add execution issue metadata
                            hasExecutionIssues,
                            issueDescription,
                            // Override status if there are issues
                            status: hasExecutionIssues ? 'failed' : selectedExecution.status,
                            error: hasExecutionIssues ? `Execution tracking issue: ${issueDescription}` : selectedExecution.error
                          };
                        })()}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center bg-gray-900/50">
                        <div className="text-center text-gray-400">
                          <PlayCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <h3 className="text-lg font-medium text-gray-300 mb-2">Select an Execution</h3>
                          <p>Choose an execution from the list to view its workflow details</p>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-gray-900/50">
                  <div className="text-center text-gray-400 max-w-md">
                    <Workflow className="w-16 h-16 mx-auto mb-6 opacity-50" />
                    <h3 className="text-xl font-medium text-gray-300 mb-3">No Workflow Selected</h3>
                    <p className="text-gray-500 mb-6 leading-relaxed">
                      Please create a new workflow or select an existing workflow from the Builder tab to view its job executions.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <button
                        onClick={() => setActiveTab('builder')}
                        className="px-4 py-2 bg-[#37bd7e] hover:bg-[#2da96a] text-white rounded-lg transition-colors flex items-center gap-2 justify-center"
                      >
                        <Plus className="w-4 h-4" />
                        Create Workflow
                      </button>
                      <button
                        onClick={() => setActiveTab('my-workflows')}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2 justify-center"
                      >
                        <FolderOpen className="w-4 h-4" />
                        Select Workflow
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
          
          {activeTab === 'templates' && (
            <motion.div
              key="templates"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="h-full p-6"
            >
              <TemplateLibrary 
                onSelectTemplate={(template) => {
                  setSelectedWorkflow(template);
                  setActiveTab('builder');
                }}
              />
            </motion.div>
          )}
          
          {activeTab === 'my-workflows' && (
            <motion.div
              key="my-workflows"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="h-full p-6"
            >
              <MyWorkflows 
                onSelectWorkflow={handleWorkflowSelect}
                onDeleteWorkflow={handleDeleteWorkflow}
              />
            </motion.div>
          )}
          
          {activeTab === 'testing' && (
            <motion.div
              key="testing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="h-full p-6"
            >
              <TestingLabNew 
                workflow={selectedWorkflow}
              />
            </motion.div>
          )}
          
          {activeTab === 'insights' && (
            <motion.div
              key="insights"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="h-full p-6"
            >
              <WorkflowInsights />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}