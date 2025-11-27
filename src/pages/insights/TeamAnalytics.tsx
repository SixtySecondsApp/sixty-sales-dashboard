import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TeamAnalyticsService, type TeamAggregates, type LeaderboardEntry } from '@/lib/services/teamAnalyticsService';
import { useUser } from '@/lib/hooks/useUser';
import { 
  Users, TrendingUp, TrendingDown, BarChart3, Trophy, 
  Smile, Frown, Clock, Activity, Award, Target
} from 'lucide-react';
import { TalkTimeLeaderboard } from '@/components/insights/TalkTimeLeaderboard';
import { SentimentRankings } from '@/components/insights/SentimentRankings';
import { MeetingVolumeRankings } from '@/components/insights/MeetingVolumeRankings';

export default function TeamAnalytics() {
  const { userData: user } = useUser();
  const [loading, setLoading] = useState(true);
  const [aggregates, setAggregates] = useState<TeamAggregates | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadTeamData();
    }
  }, [user]);

  const loadTeamData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      const data = await TeamAnalyticsService.getTeamAggregates(user.id);
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading team analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
            <Activity className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Error Loading Data</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
                Team Analytics
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Track team performance and meeting metrics
              </p>
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
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">Total Meetings</p>
                    <p className="text-3xl font-bold text-blue-700 dark:text-blue-300 mt-1">{aggregates.totalMeetings}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-200 dark:border-emerald-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Avg Sentiment</p>
                    <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                      {aggregates.avgSentiment > 0 ? '+' : ''}{aggregates.avgSentiment.toFixed(2)}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Smile className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wide">Avg Talk Time</p>
                    <p className="text-3xl font-bold text-purple-700 dark:text-purple-300 mt-1">
                      {aggregates.avgTalkTime.toFixed(1)}%
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">Team Members</p>
                    <p className="text-3xl font-bold text-amber-700 dark:text-amber-300 mt-1">{aggregates.totalTeamMembers}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <Users className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Leaderboards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Tabs defaultValue="talk-time" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="talk-time" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Talk Time
              </TabsTrigger>
              <TabsTrigger value="sentiment" className="flex items-center gap-2">
                <Smile className="w-4 h-4" />
                Sentiment
              </TabsTrigger>
              <TabsTrigger value="volume" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Volume
              </TabsTrigger>
            </TabsList>

            <TabsContent value="talk-time" className="space-y-0">
              <TalkTimeLeaderboard userId={user?.id || ''} />
            </TabsContent>

            <TabsContent value="sentiment" className="space-y-0">
              <SentimentRankings userId={user?.id || ''} />
            </TabsContent>

            <TabsContent value="volume" className="space-y-0">
              <MeetingVolumeRankings userId={user?.id || ''} />
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}



