import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TeamAnalyticsService, type LeaderboardEntry } from '@/lib/services/teamAnalyticsService';
import { Trophy, Medal, Award, BarChart3 } from 'lucide-react';

interface MeetingVolumeRankingsProps {
  userId: string;
}

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Trophy className="w-5 h-5 text-yellow-500" />;
    case 2:
      return <Medal className="w-5 h-5 text-gray-400" />;
    case 3:
      return <Award className="w-5 h-5 text-amber-600" />;
    default:
      return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-gray-400">{rank}</span>;
  }
};

const getRankColor = (rank: number) => {
  switch (rank) {
    case 1:
      return 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-800';
    case 2:
      return 'bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900/20 dark:to-slate-900/20 border-gray-200 dark:border-gray-800';
    case 3:
      return 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800';
    default:
      return 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700';
  }
};

export function MeetingVolumeRankings({ userId }: MeetingVolumeRankingsProps) {
  const [rankings, setRankings] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      loadRankings();
    }
  }, [userId]);

  const loadRankings = async () => {
    try {
      setLoading(true);
      const data = await TeamAnalyticsService.getMeetingVolumeRankings(userId, 10);
      setRankings(data);
    } catch (error) {
      console.error('Error loading meeting volume rankings:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-500" />
            Meeting Volume Rankings
          </CardTitle>
          <CardDescription>
            Top performers by total number of meetings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (rankings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-500" />
            Meeting Volume Rankings
          </CardTitle>
          <CardDescription>
            Top performers by total number of meetings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No team data available yet</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-500" />
          Meeting Volume Rankings
        </CardTitle>
        <CardDescription>
          Top performers by total number of meetings (last 30 days)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {rankings.map((entry, index) => (
            <motion.div
              key={entry.userId}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`p-4 rounded-lg border ${getRankColor(entry.rank)} transition-all hover:shadow-md`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex items-center justify-center w-10">
                    {getRankIcon(entry.rank)}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{entry.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {entry.value} meeting{entry.value !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                      {entry.value}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}



