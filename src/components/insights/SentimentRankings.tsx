import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { TeamAnalyticsService, type LeaderboardEntry } from '@/lib/services/teamAnalyticsService';
import { Trophy, Medal, Award, Smile } from 'lucide-react';

interface SentimentRankingsProps {
  userId: string;
  orgId?: string | null;
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
      return 'bg-white dark:from-gray-800/60 dark:to-gray-800/40 dark:bg-gradient-to-br border-[#E2E8F0] dark:border-yellow-500/30 shadow-[0_4px_6px_-1px_rgba(234,179,8,0.1)] dark:shadow-black/10 ring-1 ring-yellow-200/50 dark:ring-0';
    case 2:
      return 'bg-white dark:from-gray-800/50 dark:to-gray-800/30 dark:bg-gradient-to-br border-[#E2E8F0] dark:border-gray-600/30 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)] dark:shadow-black/10';
    case 3:
      return 'bg-white dark:from-gray-800/50 dark:to-gray-800/30 dark:bg-gradient-to-br border-[#E2E8F0] dark:border-amber-500/30 shadow-[0_4px_6px_-1px_rgba(217,119,6,0.08)] dark:shadow-black/10 ring-1 ring-amber-200/50 dark:ring-0';
    default:
      return 'bg-white dark:bg-gray-800/40 border-[#E2E8F0] dark:border-gray-700/30 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]';
  }
};

const getSentimentBadge = (score: number) => {
  if (score > 0.5) return { label: 'Very Positive', color: 'bg-emerald-500/10 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-500/20' };
  if (score > 0.2) return { label: 'Positive', color: 'bg-green-500/10 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200/50 dark:border-green-500/20' };
  if (score > -0.2) return { label: 'Neutral', color: 'bg-amber-500/10 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200/50 dark:border-amber-500/20' };
  if (score > -0.5) return { label: 'Negative', color: 'bg-orange-500/10 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200/50 dark:border-orange-500/20' };
  return { label: 'Very Negative', color: 'bg-red-500/10 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200/50 dark:border-red-500/20' };
};

export function SentimentRankings({ userId, orgId }: SentimentRankingsProps) {
  const [rankings, setRankings] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      loadRankings();
    }
  }, [userId, orgId]);

  const loadRankings = async () => {
    try {
      setLoading(true);
      const data = await TeamAnalyticsService.getSentimentRankings(userId, orgId, 10);
      setRankings(data);
    } catch (error) {
      console.error('Error loading sentiment rankings:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900/40 backdrop-blur-xl rounded-2xl border border-[#E2E8F0] dark:border-gray-700/30 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)] dark:shadow-lg dark:shadow-black/10 overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E8F0] dark:border-gray-700/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 dark:from-emerald-900/40 dark:to-emerald-900/20 dark:bg-gradient-to-br border border-emerald-200/50 dark:border-emerald-500/20">
              <Smile className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-[#1E293B] dark:text-white">Sentiment Rankings</h3>
              <p className="text-sm text-[#64748B] dark:text-gray-400">Top performers by average sentiment score</p>
            </div>
          </div>
        </div>
        <div className="p-5">
          <div className="h-64 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-emerald-200 dark:border-emerald-500/30 border-t-emerald-500 animate-spin" />
              <p className="text-sm text-[#64748B] dark:text-gray-400">Loading rankings...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (rankings.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900/40 backdrop-blur-xl rounded-2xl border border-[#E2E8F0] dark:border-gray-700/30 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)] dark:shadow-lg dark:shadow-black/10 overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E8F0] dark:border-gray-700/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 dark:from-emerald-900/40 dark:to-emerald-900/20 dark:bg-gradient-to-br border border-emerald-200/50 dark:border-emerald-500/20">
              <Smile className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-[#1E293B] dark:text-white">Sentiment Rankings</h3>
              <p className="text-sm text-[#64748B] dark:text-gray-400">Top performers by average sentiment score</p>
            </div>
          </div>
        </div>
        <div className="p-5">
          <div className="h-64 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-gray-800/50 border border-emerald-200/30 dark:border-gray-700/30 flex items-center justify-center mx-auto mb-3">
                <Smile className="w-8 h-8 text-emerald-400" />
              </div>
              <p className="text-[#1E293B] dark:text-gray-300 font-medium">No team data available</p>
              <p className="text-sm text-[#64748B] dark:text-gray-400 mt-1">Complete some meetings to see rankings</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900/40 backdrop-blur-xl rounded-2xl border border-[#E2E8F0] dark:border-gray-700/30 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)] dark:shadow-lg dark:shadow-black/10 overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E2E8F0] dark:border-gray-700/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 dark:from-emerald-900/40 dark:to-emerald-900/20 dark:bg-gradient-to-br border border-emerald-200/50 dark:border-emerald-500/20">
              <Smile className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-[#1E293B] dark:text-white">Sentiment Rankings</h3>
              <p className="text-sm text-[#64748B] dark:text-gray-400">Score range: -1.0 to +1.0</p>
            </div>
          </div>
          <Badge className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-500/20">
            {rankings.length} members
          </Badge>
        </div>
      </div>
      <div className="p-4">
        <div className="space-y-2">
          {rankings.map((entry, index) => {
            const badge = getSentimentBadge(entry.value);
            return (
              <motion.div
                key={entry.userId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`p-4 rounded-xl border ${getRankColor(entry.rank)} transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.08),0_4px_6px_-2px_rgba(0,0,0,0.04)] dark:hover:shadow-black/20`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 dark:bg-gray-800/50 border border-[#E2E8F0] dark:border-gray-700/30">
                      {getRankIcon(entry.rank)}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-[#1E293B] dark:text-white">{entry.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={badge.color}>
                          {badge.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50 dark:from-emerald-900/40 dark:to-emerald-900/20 dark:bg-gradient-to-br border border-emerald-200/50 dark:border-emerald-500/20">
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      {entry.value > 0 ? '+' : ''}{entry.value.toFixed(2)}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}



















