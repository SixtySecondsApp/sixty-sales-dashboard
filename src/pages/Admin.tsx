import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Users from '@/pages/admin/Users';
import PipelineSettings from '@/pages/admin/PipelineSettings';
import AuditLogs from '@/pages/admin/AuditLogs';
import SmartTasksAdmin from '@/pages/SmartTasksAdmin';
import ApiTesting from '@/pages/ApiTesting';
import { 
  UsersIcon, 
  PanelLeft, 
  Shield, 
  Zap, 
  Code2 
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
                value="api-testing" 
                className="flex items-center gap-2 data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-white"
              >
                <Code2 className="w-4 h-4" />
                API Testing
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

            <TabsContent value="api-testing" className="space-y-0">
              <ApiTesting />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
