import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Profile from '@/pages/Profile';
import Preferences from '@/pages/Preferences';
import ProposalSettings from '@/pages/settings/ProposalSettings';

export default function Settings() {
  const [tab, setTab] = useState('account');

  return (
    <div className="min-h-screen">
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Manage your account and appearance</p>
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab} className="space-y-6">
            <TabsList className="bg-white border border-transparent shadow-sm dark:bg-gray-900/50 dark:backdrop-blur-xl dark:border-gray-800/50">
              <TabsTrigger value="account" className="data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white">Account</TabsTrigger>
              <TabsTrigger value="appearance" className="data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white">Appearance</TabsTrigger>
              <TabsTrigger value="proposals" className="data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white">Proposals</TabsTrigger>
            </TabsList>

            <TabsContent value="account" className="space-y-0">
              {/* Profile page contains its own layout and sections; we render it directly */}
              <Profile />
            </TabsContent>

            <TabsContent value="appearance" className="space-y-0">
              {/* Preferences page contains theme controls; we render it directly */}
              <Preferences />
            </TabsContent>

            <TabsContent value="proposals" className="space-y-0">
              <ProposalSettings />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}











