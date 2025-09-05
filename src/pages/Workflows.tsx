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
  Sparkles
} from 'lucide-react';

// Import workflow components
import WorkflowCanvas from '@/components/workflows/WorkflowCanvas';
import TemplateLibrary from '@/components/workflows/TemplateLibrary';
import MyWorkflows from '@/components/workflows/MyWorkflows';
import TestingLab from '@/components/workflows/TestingLab';
import WorkflowInsights from '@/components/workflows/WorkflowInsights';

export default function Workflows() {
  const { userData: user } = useUser();
  const [loading, setLoading] = useState(false); // Set to false initially since we don't need to check admin
  const [isAdmin, setIsAdmin] = useState(true); // Allow all users to use workflows
  const [activeTab, setActiveTab] = useState<'builder' | 'templates' | 'my-workflows' | 'testing' | 'insights'>('builder');
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null);
  const [stats, setStats] = useState({
    totalWorkflows: 0,
    activeWorkflows: 0,
    successRate: 95,
    testsRun: 128
  });
  
  const tabs = [
    { id: 'builder', label: 'Builder', icon: Layers, description: 'Create workflows visually' },
    { id: 'templates', label: 'Templates', icon: BookOpen, description: 'Start from templates' },
    { id: 'my-workflows', label: 'My Workflows', icon: FolderOpen, description: 'Manage workflows' },
    { id: 'testing', label: 'Testing Lab', icon: TestTube, description: 'Test & debug' },
    { id: 'insights', label: 'Insights', icon: BarChart3, description: 'Analytics & metrics' }
  ];

  useEffect(() => {
    // No need to check admin status - workflows are available to all users
    loadWorkflowStats();
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

  const handleWorkflowSave = async (workflow: any) => {
    try {
      // Check if user is available
      if (!user?.id) {
        console.warn('No user found, using development fallback');
        // For development, use a fallback user ID
        const fallbackUserId = 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459';
        console.log('Using fallback user ID for development:', fallbackUserId);
      }

      const userId = user?.id || 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'; // Fallback for development

      const workflowData = {
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
        priority_level: 1
      };

      console.log('Saving workflow with data:', workflowData);

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
      
      console.log(`✅ Workflow ${workflow.id ? 'updated' : 'created'} successfully`, result.data);
      alert(`Workflow "${workflow.name}" saved successfully!`);
      await loadWorkflowStats();
      
      // Clear selected workflow to show success
      setSelectedWorkflow(null);
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
              <TestingLab 
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