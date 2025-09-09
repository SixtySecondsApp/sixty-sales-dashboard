import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Users from '@/pages/admin/Users';
import PipelineSettings from '@/pages/admin/PipelineSettings';
import AuditLogs from '@/pages/admin/AuditLogs';
import SmartTasksAdmin from '@/pages/SmartTasksAdmin';
import PipelineAutomationAdmin from '@/pages/PipelineAutomationAdmin';
import ApiTesting from '@/pages/ApiTesting';
import FunctionTesting from '@/pages/admin/FunctionTesting';
import WorkflowsTestSuite from '@/components/admin/WorkflowsTestSuite';
import WorkflowsE2ETestSuite from '@/components/admin/WorkflowsE2ETestSuite';
import AIProviderSettings from '@/components/settings/AIProviderSettings';
import { GoogleWorkspaceSettings } from '@/components/admin/GoogleWorkspaceSettings';
import { 
  UsersIcon, 
  PanelLeft, 
  Shield, 
  Zap, 
  Code2,
  Target,
  Workflow,
  TestTube,
  FlaskConical,
  Sparkles,
  Building2
} from 'lucide-react';

export default function Admin() {
  const [activeTab, setActiveTab] = useState('users');
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-gray-100">
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Administration</h1>
              <p className="text-sm text-gray-400 mt-1">
                Manage users, settings, and system configuration
              </p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50">
              <TabsTrigger 
                value="users" 
                className="flex items-center gap-2 data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-white"
              >
                <UsersIcon className="w-4 h-4" />
                Users
              </TabsTrigger>
              <TabsTrigger 
                value="pipeline" 
                className="flex items-center gap-2 data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-white"
              >
                <PanelLeft className="w-4 h-4" />
                Pipeline Settings
              </TabsTrigger>
              <TabsTrigger 
                value="audit" 
                className="flex items-center gap-2 data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-white"
              >
                <Shield className="w-4 h-4" />
                Audit Logs
              </TabsTrigger>
              <TabsTrigger 
                value="smart-tasks" 
                className="flex items-center gap-2 data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-white"
              >
                <Zap className="w-4 h-4" />
                Smart Tasks
              </TabsTrigger>
              <TabsTrigger 
                value="ai-settings" 
                className="flex items-center gap-2 data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-white"
              >
                <Sparkles className="w-4 h-4" />
                AI Settings
              </TabsTrigger>
              <TabsTrigger 
                value="google-workspace" 
                className="flex items-center gap-2 data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-white"
              >
                <Building2 className="w-4 h-4" />
                Google Workspace
              </TabsTrigger>
              <TabsTrigger 
                value="pipeline-automation" 
                className="flex items-center gap-2 data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-white"
              >
                <Workflow className="w-4 h-4" />
                Pipeline Automation
              </TabsTrigger>
              <TabsTrigger 
                value="api-testing" 
                className="flex items-center gap-2 data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-white"
              >
                <Code2 className="w-4 h-4" />
                API Testing
              </TabsTrigger>
              <TabsTrigger 
                value="function-testing" 
                className="flex items-center gap-2 data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-white"
              >
                <Target className="w-4 h-4" />
                Function Testing
              </TabsTrigger>
              <TabsTrigger 
                value="workflows-test" 
                className="flex items-center gap-2 data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-white"
              >
                <TestTube className="w-4 h-4" />
                Workflows Test
              </TabsTrigger>
              <TabsTrigger 
                value="workflows-e2e" 
                className="flex items-center gap-2 data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-white"
              >
                <FlaskConical className="w-4 h-4" />
                E2E Tests
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="space-y-0">
              <Users />
            </TabsContent>

            <TabsContent value="pipeline" className="space-y-0">
              <PipelineSettings />
            </TabsContent>

            <TabsContent value="audit" className="space-y-0">
              <AuditLogs />
            </TabsContent>

            <TabsContent value="smart-tasks" className="space-y-0">
              <SmartTasksAdmin />
            </TabsContent>

            <TabsContent value="ai-settings" className="space-y-0">
              <AIProviderSettings />
            </TabsContent>

            <TabsContent value="google-workspace" className="space-y-0">
              <GoogleWorkspaceSettings />
            </TabsContent>

            <TabsContent value="pipeline-automation" className="space-y-0">
              <PipelineAutomationAdmin />
            </TabsContent>

            <TabsContent value="api-testing" className="space-y-0">
              <ApiTesting />
            </TabsContent>

            <TabsContent value="function-testing" className="space-y-0">
              <FunctionTesting />
            </TabsContent>

            <TabsContent value="workflows-test" className="space-y-0">
              <WorkflowsTestSuite />
            </TabsContent>

            <TabsContent value="workflows-e2e" className="space-y-0">
              <WorkflowsE2ETestSuite />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
