/**
 * Settings - User Settings Page (Tier 1)
 *
 * Simplified settings page for all authenticated users.
 * Contains only user-specific settings:
 * - Account (profile)
 * - Appearance (theme)
 * - Proposals
 * - AI Personalization
 * - Email Sync
 *
 * Org-level settings (Team, Branding) moved to /org/*
 * Platform-level settings (View Mode) moved to /platform/*
 */

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Profile from '@/pages/Profile';
import Preferences from '@/pages/Preferences';
import ProposalSettings from '@/pages/settings/ProposalSettings';
import AIPersonalizationSettings from '@/pages/settings/AIPersonalizationSettings';
import { EmailSyncPanel } from '@/components/health/EmailSyncPanel';

export default function Settings() {
  const [tab, setTab] = useState('account');

  return (
    <div className="min-h-screen">
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#1E293B] dark:text-gray-100">Settings</h1>
              <p className="text-sm text-[#64748B] dark:text-gray-400 mt-1">Manage your account and preferences</p>
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab} className="space-y-6">
            <TabsList className="bg-[#E2E8F0] dark:bg-gray-900/50 border border-[#E2E8F0] dark:border-gray-800/50 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)] dark:shadow-none dark:backdrop-blur-xl">
              <TabsTrigger value="account" className="data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-[#1E293B] dark:data-[state=active]:text-white">Account</TabsTrigger>
              <TabsTrigger value="appearance" className="data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-[#1E293B] dark:data-[state=active]:text-white">Appearance</TabsTrigger>
              <TabsTrigger value="proposals" className="data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-[#1E293B] dark:data-[state=active]:text-white">Proposals</TabsTrigger>
              <TabsTrigger value="ai-personalization" className="data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-[#1E293B] dark:data-[state=active]:text-white">AI Personalization</TabsTrigger>
              <TabsTrigger value="email-sync" className="data-[state=active]:bg-[#37bd7e]/10 data-[state=active]:text-[#1E293B] dark:data-[state=active]:text-white">Email Sync</TabsTrigger>
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

            <TabsContent value="ai-personalization" className="space-y-0">
              <AIPersonalizationSettings />
            </TabsContent>

            <TabsContent value="email-sync" className="space-y-6">
              <EmailSyncPanel />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
