import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TeamAnalyticsService, type TeamAggregates, type LeaderboardEntry } from '@/lib/services/teamAnalyticsService';
import { useUser } from '@/lib/hooks/useUser';
import { useOrg } from '@/lib/contexts/OrgContext';
import {
  Users, BarChart3,
  Smile, Clock, Activity
} from 'lucide-react';
import { TalkTimeLeaderboard } from '@/components/insights/TalkTimeLeaderboard';
import { SentimentRankings } from '@/components/insights/SentimentRankings';
import { MeetingVolumeRankings } from '@/components/insights/MeetingVolumeRankings';

// Skeleton components for loading state
const StatCardSkeleton = () => (
  <div className="bg-white dark:bg-gray-900/40 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-gray-700/30 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05),0_2px_4px_-1px_rgba(0,0,0,0.03)] dark:shadow-lg dark:shadow-black/10 p-5">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700/50 rounded animate-pulse" />
        <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700/50 rounded animate-pulse" />
      </div>
      <div className="p-3 rounded-xl bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/30">
        <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700/50 rounded animate-pulse" />
      </div>
    </div>
  </div>
);

const LeaderboardSkeleton = () => (
  <div className="bg-white dark:bg-gray-900/40 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-gray-700/30 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05),0_2px_4px_-1px_rgba(0,0,0,0.03)] dark:shadow-lg dark:shadow-black/10 overflow-hidden">
    <div className="p-5 border-b border-gray-200 dark:border-gray-700/30">
      <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700/50 rounded animate-pulse mb-2" />
      <div className="h-3 w-60 bg-gray-200 dark:bg-gray-700/50 rounded animate-pulse" />
    </div>
    <div className="p-5 space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-transparent">
          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700/50 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700/50 rounded animate-pulse" />
            <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700/50 rounded animate-pulse" />
          </div>
          <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-700/50 animate-pulse" />
        </div>
      ))}
    </div>
  </div>
);

export default function TeamAnalytics() {
  const { userData: user } = useUser();
  const { activeOrgId } = useOrg();
  const [loading, setLoading] = useState(true);
  const [aggregates, setAggregates] = useState<TeamAggregates | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadTeamData();
    }
  }, [user, activeOrgId]);

  const loadTeamData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      // Pass activeOrgId to filter by organization
      const data = await TeamAnalyticsService.getTeamAggregates(user.id, activeOrgId);
      setAggregates(data);
    } catch (err) {
      console.error('Error loading team data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load team analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-gradient-to-br dark:from-gray-950 dark:to-gray-900">
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          {/* Header skeleton */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gray-200 dark:bg-gray-700/50 animate-pulse" />
            <div className="space-y-2">
              <div className="h-7 w-48 bg-gray-200 dark:bg-gray-700/50 rounded animate-pulse" />
              <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700/50 rounded animate-pulse" />
            </div>
          </div>

          {/* Stat cards skeleton */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>

          {/* Tabs skeleton */}
          <div className="bg-white dark:bg-gray-900/30 backdrop-blur-xl rounded-xl p-1.5 border border-gray-200 dark:border-gray-700/30 shadow-sm mb-6">
            <div className="grid grid-cols-3 gap-1">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700/30 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>

          {/* Leaderboard skeleton */}
          <LeaderboardSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-gradient-to-br dark:from-gray-950 dark:to-gray-900 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-900/40 backdrop-blur-xl rounded-2xl border border-red-200 dark:border-red-800/30 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05),0_2px_4px_-1px_rgba(0,0,0,0.03)] dark:shadow-black/10 p-8 max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700/30 flex items-center justify-center mx-auto mb-4">
            <Activity className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Error Loading Data</h2>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-gradient-to-br dark:from-gray-950 dark:to-gray-900 text-gray-900 dark:text-gray-100">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl blur-xl opacity-40 dark:opacity-30" />
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 dark:shadow-blue-500/25">
                <Users className="w-7 h-7 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">
                <span className="text-gray-900 dark:bg-gradient-to-r dark:from-white dark:via-gray-100 dark:to-white dark:bg-clip-text dark:text-transparent">
                  Team
                </span>{' '}
                <span className="bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-500 bg-clip-text text-transparent">
                  Analytics
                </span>
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Track team performance and meeting metrics
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Aggregate Stats */}
        {aggregates && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
          >
            {/* Total Meetings */}
            <div className="group bg-white dark:bg-gray-900/40 rounded-2xl border border-[#E2E8F0] dark:border-blue-500/20 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)] dark:shadow-lg dark:shadow-black/10 p-5 hover:shadow-[0_8px_12px_-3px_rgba(0,0,0,0.08)] dark:hover:shadow-black/20 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-[#64748B] dark:text-blue-400 uppercase tracking-wide">Total Meetings</p>
                  <p className="text-3xl font-bold text-[#1E293B] dark:text-white mt-1">{aggregates.totalMeetings}</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/30 group-hover:scale-110 transition-transform duration-300">
                  <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </div>

            {/* Avg Sentiment */}
            <div className="group bg-white dark:bg-gray-900/40 rounded-2xl border border-[#E2E8F0] dark:border-emerald-500/20 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)] dark:shadow-lg dark:shadow-black/10 p-5 hover:shadow-[0_8px_12px_-3px_rgba(0,0,0,0.08)] dark:hover:shadow-black/20 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-[#64748B] dark:text-emerald-400 uppercase tracking-wide">Avg Sentiment</p>
                  <p className="text-3xl font-bold text-[#1E293B] dark:text-white mt-1">
                    {aggregates.avgSentiment > 0 ? '+' : ''}{aggregates.avgSentiment.toFixed(2)}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 group-hover:scale-110 transition-transform duration-300">
                  <Smile className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </div>

            {/* Avg Talk Time */}
            <div className="group bg-white dark:bg-gray-900/40 rounded-2xl border border-[#E2E8F0] dark:border-purple-500/20 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)] dark:shadow-lg dark:shadow-black/10 p-5 hover:shadow-[0_8px_12px_-3px_rgba(0,0,0,0.08)] dark:hover:shadow-black/20 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-[#64748B] dark:text-purple-400 uppercase tracking-wide">Avg Talk Time</p>
                  <p className="text-3xl font-bold text-[#1E293B] dark:text-white mt-1">
                    {aggregates.avgTalkTime.toFixed(1)}%
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-900/30 group-hover:scale-110 transition-transform duration-300">
                  <Clock className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </div>

            {/* Team Members */}
            <div className="group bg-white dark:bg-gray-900/40 rounded-2xl border border-[#E2E8F0] dark:border-amber-500/20 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)] dark:shadow-lg dark:shadow-black/10 p-5 hover:shadow-[0_8px_12px_-3px_rgba(0,0,0,0.08)] dark:hover:shadow-black/20 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-[#64748B] dark:text-amber-400 uppercase tracking-wide">Team Members</p>
                  <p className="text-3xl font-bold text-[#1E293B] dark:text-white mt-1">{aggregates.totalTeamMembers}</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/30 group-hover:scale-110 transition-transform duration-300">
                  <Users className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Leaderboards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Tabs defaultValue="talk-time" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 bg-[#E2E8F0] dark:bg-gray-900/30 p-1 rounded-xl dark:border dark:border-gray-700/30">
              <TabsTrigger
                value="talk-time"
                className="flex items-center gap-2 rounded-lg text-[#64748B] dark:text-gray-400 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800/80 data-[state=active]:text-[#1E293B] dark:data-[state=active]:text-white data-[state=active]:shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)] transition-all duration-200"
              >
                <Clock className="w-4 h-4" />
                Talk Time
              </TabsTrigger>
              <TabsTrigger
                value="sentiment"
                className="flex items-center gap-2 rounded-lg text-[#64748B] dark:text-gray-400 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800/80 data-[state=active]:text-[#1E293B] dark:data-[state=active]:text-white data-[state=active]:shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)] transition-all duration-200"
              >
                <Smile className="w-4 h-4" />
                Sentiment
              </TabsTrigger>
              <TabsTrigger
                value="volume"
                className="flex items-center gap-2 rounded-lg text-[#64748B] dark:text-gray-400 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800/80 data-[state=active]:text-[#1E293B] dark:data-[state=active]:text-white data-[state=active]:shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)] transition-all duration-200"
              >
                <BarChart3 className="w-4 h-4" />
                Volume
              </TabsTrigger>
            </TabsList>

            <TabsContent value="talk-time" className="space-y-0">
              <TalkTimeLeaderboard userId={user?.id || ''} orgId={activeOrgId} />
            </TabsContent>

            <TabsContent value="sentiment" className="space-y-0">
              <SentimentRankings userId={user?.id || ''} orgId={activeOrgId} />
            </TabsContent>

            <TabsContent value="volume" className="space-y-0">
              <MeetingVolumeRankings userId={user?.id || ''} orgId={activeOrgId} />
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}



















