import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase/clientV2';
import { useUser } from '@/lib/hooks/useUser';
import { format, subDays, startOfDay } from 'date-fns';
import { 
  TrendingUp, TrendingDown, Minus, Smile, Frown, Meh, 
  Calendar, Clock, Target, ArrowRight, BarChart3,
  Sparkles, AlertCircle, CheckCircle2, Video,
  ArrowUpRight, ArrowDownRight, Activity
} from 'lucide-react';

interface Meeting {
  id: string;
  title: string;
  meeting_start: string;
  duration_minutes: number;
  sentiment_score: number | null;
  sentiment_reasoning: string | null;
  talk_time_rep_pct: number | null;
  talk_time_customer_pct: number | null;
  company?: { name: string } | null;
}

interface SentimentStats {
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  avgScore: number;
  trend: 'improving' | 'stable' | 'declining';
  trendPercent: number;
}

const SENTIMENT_COLORS = {
  positive: '#10b981',
  neutral: '#f59e0b',
  negative: '#ef4444',
};


export default function MeetingSentimentAnalytics() {
  const { userData: user, isLoading: userLoading } = useUser();
  const navigate = useNavigate();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7' | '30' | '90' | '365'>('30');

  useEffect(() => {
    // Wait for user loading to complete before deciding what to do
    if (userLoading) {
      return;
    }

    if (user) {
      loadMeetings();
    }
  }, [user, userLoading, timeRange]);

  const loadMeetings = async () => {
    if (!user) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const days = parseInt(timeRange);
      const startDate = startOfDay(subDays(new Date(), days));

      const { data, error: queryError } = await supabase
        .from('meetings')
        .select(`
          id,
          title,
          meeting_start,
          duration_minutes,
          sentiment_score,
          sentiment_reasoning,
          talk_time_rep_pct,
          talk_time_customer_pct,
          company:companies!fk_meetings_company_id(name)
        `)
        .eq('owner_user_id', user.id)
        .gte('meeting_start', startDate.toISOString())
        .order('meeting_start', { ascending: false });

      if (queryError) {
        console.error('Supabase error:', queryError);
        throw new Error(`Failed to load meetings: ${queryError.message}`);
      }
      
      setMeetings(data || []);
    } catch (err) {
      console.error('Error loading meetings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load meetings');
    } finally {
      setLoading(false);
      setHasFetched(true);
    }
  };

  // Calculate stats
  const stats = useMemo((): SentimentStats => {
    const withSentiment = meetings.filter(m => m.sentiment_score !== null);
    
    if (withSentiment.length === 0) {
      return { total: 0, positive: 0, neutral: 0, negative: 0, avgScore: 0, trend: 'stable', trendPercent: 0 };
    }

    const positive = withSentiment.filter(m => (m.sentiment_score ?? 0) > 0.2).length;
    const negative = withSentiment.filter(m => (m.sentiment_score ?? 0) < -0.2).length;
    const neutral = withSentiment.length - positive - negative;
    const avgScore = withSentiment.reduce((sum, m) => sum + (m.sentiment_score ?? 0), 0) / withSentiment.length;

    // Calculate trend (compare first half vs second half)
    const sorted = [...withSentiment].sort((a, b) => 
      new Date(a.meeting_start).getTime() - new Date(b.meeting_start).getTime()
    );
    const mid = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, mid);
    const secondHalf = sorted.slice(mid);

    const firstAvg = firstHalf.length > 0 
      ? firstHalf.reduce((sum, m) => sum + (m.sentiment_score ?? 0), 0) / firstHalf.length 
      : 0;
    const secondAvg = secondHalf.length > 0 
      ? secondHalf.reduce((sum, m) => sum + (m.sentiment_score ?? 0), 0) / secondHalf.length 
      : 0;

    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    let trendPercent = 0;
    
    if (firstAvg !== 0) {
      trendPercent = ((secondAvg - firstAvg) / Math.abs(firstAvg)) * 100;
    }
    
    if (secondAvg > firstAvg + 0.1) trend = 'improving';
    else if (secondAvg < firstAvg - 0.1) trend = 'declining';

    return { total: withSentiment.length, positive, neutral, negative, avgScore, trend, trendPercent };
  }, [meetings]);

  // Chart data - sentiment over time
  const trendData = useMemo(() => {
    const withSentiment = meetings.filter(m => m.sentiment_score !== null);
    const grouped = withSentiment.reduce((acc: Record<string, { scores: number[], count: number }>, meeting) => {
      const date = format(new Date(meeting.meeting_start), 'MMM d');
      if (!acc[date]) {
        acc[date] = { scores: [], count: 0 };
      }
      acc[date].scores.push(meeting.sentiment_score ?? 0);
      acc[date].count++;
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([date, data]) => ({
        date,
        sentiment: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
        meetings: data.count,
      }))
      .reverse();
  }, [meetings]);

  // Pie chart data - sentiment distribution
  const distributionData = useMemo(() => [
    { name: 'Positive', value: stats.positive, color: SENTIMENT_COLORS.positive },
    { name: 'Neutral', value: stats.neutral, color: SENTIMENT_COLORS.neutral },
    { name: 'Negative', value: stats.negative, color: SENTIMENT_COLORS.negative },
  ].filter(d => d.value > 0), [stats]);

  // Recent meetings with sentiment
  const recentMeetings = useMemo(() => 
    meetings.filter(m => m.sentiment_score !== null).slice(0, 5),
  [meetings]);

  // Best and worst meetings
  const bestMeeting = useMemo(() => 
    [...meetings].filter(m => m.sentiment_score !== null)
      .sort((a, b) => (b.sentiment_score ?? 0) - (a.sentiment_score ?? 0))[0],
  [meetings]);

  const worstMeeting = useMemo(() => 
    [...meetings].filter(m => m.sentiment_score !== null)
      .sort((a, b) => (a.sentiment_score ?? 0) - (b.sentiment_score ?? 0))[0],
  [meetings]);

  const getSentimentIcon = (score: number | null) => {
    if (score === null) return <Meh className="w-5 h-5 text-gray-400" />;
    if (score > 0.2) return <Smile className="w-5 h-5 text-emerald-500" />;
    if (score < -0.2) return <Frown className="w-5 h-5 text-red-500" />;
    return <Meh className="w-5 h-5 text-amber-500" />;
  };

  const getSentimentLabel = (score: number | null) => {
    if (score === null) return 'Unknown';
    if (score > 0.5) return 'Very Positive';
    if (score > 0.2) return 'Positive';
    if (score > -0.2) return 'Neutral';
    if (score > -0.5) return 'Negative';
    return 'Very Negative';
  };

  const getSentimentColor = (score: number | null) => {
    if (score === null) return 'bg-gray-100 text-gray-600';
    if (score > 0.2) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    if (score < -0.2) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 dark:text-gray-100">{label}</p>
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            Sentiment: {payload[0].value.toFixed(2)}
          </p>
          {payload[0].payload.meetings && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {payload[0].payload.meetings} meeting{payload[0].payload.meetings !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  // Skeleton components
  const StatCardSkeleton = () => (
    <div className="bg-white/80 dark:bg-gray-900/40 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-700/30 shadow-sm dark:shadow-lg dark:shadow-black/10 p-5">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-3 w-20 bg-gray-200/80 dark:bg-gray-700/50 rounded animate-pulse" />
          <div className="h-8 w-16 bg-gray-200/80 dark:bg-gray-700/50 rounded animate-pulse" />
        </div>
        <div className="p-3 rounded-xl bg-gray-100/80 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/30">
          <div className="w-6 h-6 bg-gray-200/80 dark:bg-gray-700/50 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );

  const ChartCardSkeleton = ({ tall = false }: { tall?: boolean }) => (
    <div className="bg-white/80 dark:bg-gray-900/40 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-700/30 shadow-sm dark:shadow-lg dark:shadow-black/10 h-full">
      <div className="p-6 border-b border-gray-200/50 dark:border-gray-700/30">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gray-100/80 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/30">
            <div className="w-5 h-5 bg-gray-200/80 dark:bg-gray-700/50 rounded animate-pulse" />
          </div>
          <div className="h-5 w-32 bg-gray-200/80 dark:bg-gray-700/50 rounded animate-pulse" />
        </div>
        <div className="h-4 w-48 bg-gray-200/80 dark:bg-gray-700/50 rounded animate-pulse mt-2" />
      </div>
      <div className="p-6">
        <div className={`${tall ? 'h-[300px]' : 'h-[200px]'} bg-gray-100/50 dark:bg-gray-800/30 rounded-xl animate-pulse`} />
      </div>
    </div>
  );

  const MeetingItemSkeleton = () => (
    <div className="p-3 rounded-xl border border-gray-200/50 dark:border-gray-700/30 bg-gray-50/50 dark:bg-gray-800/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="w-5 h-5 bg-gray-200/80 dark:bg-gray-700/50 rounded-full animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 bg-gray-200/80 dark:bg-gray-700/50 rounded animate-pulse" />
            <div className="h-3 w-1/2 bg-gray-200/80 dark:bg-gray-700/50 rounded animate-pulse" />
          </div>
        </div>
        <div className="h-5 w-16 bg-gray-200/80 dark:bg-gray-700/50 rounded-full animate-pulse" />
      </div>
    </div>
  );

  const HighlightSkeleton = () => (
    <div className="p-4 rounded-xl border border-gray-200/50 dark:border-gray-700/30 bg-gray-50/50 dark:bg-gray-800/30">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 rounded-lg bg-gray-100/80 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/30">
          <div className="w-4 h-4 bg-gray-200/80 dark:bg-gray-700/50 rounded animate-pulse" />
        </div>
        <div className="h-3 w-20 bg-gray-200/80 dark:bg-gray-700/50 rounded animate-pulse" />
      </div>
      <div className="h-5 w-3/4 bg-gray-200/80 dark:bg-gray-700/50 rounded animate-pulse mb-3" />
      <div className="flex items-center justify-between">
        <div className="h-3 w-24 bg-gray-200/80 dark:bg-gray-700/50 rounded animate-pulse" />
        <div className="h-5 w-12 bg-gray-200/80 dark:bg-gray-700/50 rounded-full animate-pulse" />
      </div>
    </div>
  );

  const DashboardSkeleton = () => (
    <div className="min-h-screen text-gray-900 dark:text-gray-100">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header Skeleton */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-2">
              <div className="h-8 w-64 bg-gray-200/80 dark:bg-gray-700/50 rounded animate-pulse" />
              <div className="h-4 w-48 bg-gray-200/80 dark:bg-gray-700/50 rounded animate-pulse" />
            </div>
            <div className="h-10 w-36 bg-gray-200/80 dark:bg-gray-700/50 rounded-lg animate-pulse" />
          </div>
        </div>

        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>

        {/* Charts Row Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ChartCardSkeleton tall />
          </div>
          <ChartCardSkeleton />
        </div>

        {/* Second Row Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Recent Meetings Skeleton */}
          <div className="bg-white/80 dark:bg-gray-900/40 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-700/30 shadow-sm dark:shadow-lg dark:shadow-black/10">
            <div className="p-6 border-b border-gray-200/50 dark:border-gray-700/30">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gray-100/80 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/30">
                  <div className="w-5 h-5 bg-gray-200/80 dark:bg-gray-700/50 rounded animate-pulse" />
                </div>
                <div className="h-5 w-32 bg-gray-200/80 dark:bg-gray-700/50 rounded animate-pulse" />
              </div>
              <div className="h-4 w-48 bg-gray-200/80 dark:bg-gray-700/50 rounded animate-pulse mt-2" />
            </div>
            <div className="p-4 space-y-3">
              <MeetingItemSkeleton />
              <MeetingItemSkeleton />
              <MeetingItemSkeleton />
              <MeetingItemSkeleton />
              <MeetingItemSkeleton />
            </div>
          </div>

          {/* Highlights Skeleton */}
          <div className="bg-white/80 dark:bg-gray-900/40 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-700/30 shadow-sm dark:shadow-lg dark:shadow-black/10">
            <div className="p-6 border-b border-gray-200/50 dark:border-gray-700/30">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gray-100/80 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/30">
                  <div className="w-5 h-5 bg-gray-200/80 dark:bg-gray-700/50 rounded animate-pulse" />
                </div>
                <div className="h-5 w-32 bg-gray-200/80 dark:bg-gray-700/50 rounded animate-pulse" />
              </div>
              <div className="h-4 w-48 bg-gray-200/80 dark:bg-gray-700/50 rounded animate-pulse mt-2" />
            </div>
            <div className="p-4 space-y-4">
              <HighlightSkeleton />
              <HighlightSkeleton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Show skeleton while user is loading OR while fetching meetings (but only if we haven't fetched yet)
  if (userLoading || (loading && !hasFetched)) {
    return <DashboardSkeleton />;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Authentication Required</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">Please sign in to view sentiment analytics.</p>
          <Button onClick={() => navigate('/login')}>Sign In</Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Error Loading Data</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
          <Button onClick={() => loadMeetings()}>Try Again</Button>
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                Meeting Sentiment Analytics
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Understand the emotional tone and trends of your meetings
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
                <SelectTrigger className="w-[140px] bg-white dark:bg-gray-800">
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="365">Last year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          {/* Total Meetings */}
          <Card className="bg-white/80 dark:bg-gray-900/40 backdrop-blur-xl rounded-2xl border border-blue-200/50 dark:border-blue-500/20 shadow-sm dark:shadow-lg dark:shadow-black/10 hover:border-blue-300/50 dark:hover:border-blue-400/30 transition-all duration-300 group">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">Total Analyzed</p>
                  <p className="text-3xl font-bold text-blue-700 dark:text-blue-300 mt-1">{stats.total}</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-100/80 dark:bg-blue-500/20 border border-blue-200/50 dark:border-blue-500/30 group-hover:border-blue-300 dark:group-hover:border-blue-400/40 transition-all duration-300">
                  <Video className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Avg Sentiment */}
          <Card className="bg-white/80 dark:bg-gray-900/40 backdrop-blur-xl rounded-2xl border border-emerald-200/50 dark:border-emerald-500/20 shadow-sm dark:shadow-lg dark:shadow-black/10 hover:border-emerald-300/50 dark:hover:border-emerald-400/30 transition-all duration-300 group">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Avg Sentiment</p>
                  <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                    {stats.avgScore > 0 ? '+' : ''}{stats.avgScore.toFixed(2)}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-100/80 dark:bg-emerald-500/20 border border-emerald-200/50 dark:border-emerald-500/30 group-hover:border-emerald-300 dark:group-hover:border-emerald-400/40 transition-all duration-300">
                  {getSentimentIcon(stats.avgScore)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Positive Rate */}
          <Card className="bg-white/80 dark:bg-gray-900/40 backdrop-blur-xl rounded-2xl border border-green-200/50 dark:border-green-500/20 shadow-sm dark:shadow-lg dark:shadow-black/10 hover:border-green-300/50 dark:hover:border-green-400/30 transition-all duration-300 group">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">Positive Rate</p>
                  <p className="text-3xl font-bold text-green-700 dark:text-green-300 mt-1">
                    {stats.total > 0 ? Math.round((stats.positive / stats.total) * 100) : 0}%
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-green-100/80 dark:bg-green-500/20 border border-green-200/50 dark:border-green-500/30 group-hover:border-green-300 dark:group-hover:border-green-400/40 transition-all duration-300">
                  <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Trend */}
          <Card className={`bg-white/80 dark:bg-gray-900/40 backdrop-blur-xl rounded-2xl shadow-sm dark:shadow-lg dark:shadow-black/10 transition-all duration-300 group ${
            stats.trend === 'improving'
              ? 'border border-emerald-200/50 dark:border-emerald-500/20 hover:border-emerald-300/50 dark:hover:border-emerald-400/30'
              : stats.trend === 'declining'
              ? 'border border-red-200/50 dark:border-red-500/20 hover:border-red-300/50 dark:hover:border-red-400/30'
              : 'border border-gray-200/50 dark:border-gray-700/30 hover:border-gray-300/50 dark:hover:border-gray-600/40'
          }`}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-xs font-medium uppercase tracking-wide ${
                    stats.trend === 'improving' ? 'text-emerald-600 dark:text-emerald-400'
                    : stats.trend === 'declining' ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-600 dark:text-gray-400'
                  }`}>Trend</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className={`text-xl font-bold capitalize ${
                      stats.trend === 'improving' ? 'text-emerald-700 dark:text-emerald-300'
                      : stats.trend === 'declining' ? 'text-red-700 dark:text-red-300'
                      : 'text-gray-700 dark:text-gray-300'
                    }`}>{stats.trend}</p>
                  </div>
                </div>
                <div className={`p-3 rounded-xl border transition-all duration-300 ${
                  stats.trend === 'improving'
                    ? 'bg-emerald-100/80 dark:bg-emerald-500/20 border-emerald-200/50 dark:border-emerald-500/30 group-hover:border-emerald-300 dark:group-hover:border-emerald-400/40'
                    : stats.trend === 'declining'
                    ? 'bg-red-100/80 dark:bg-red-500/20 border-red-200/50 dark:border-red-500/30 group-hover:border-red-300 dark:group-hover:border-red-400/40'
                    : 'bg-gray-100/80 dark:bg-gray-800/50 border-gray-200/50 dark:border-gray-700/30 group-hover:border-gray-300 dark:group-hover:border-gray-600/40'
                }`}>
                  {stats.trend === 'improving' ? (
                    <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  ) : stats.trend === 'declining' ? (
                    <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
                  ) : (
                    <Minus className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Trend Chart - Takes 2 columns */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2"
          >
            <Card className="h-full bg-white/80 dark:bg-gray-900/40 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-700/30 shadow-sm dark:shadow-lg dark:shadow-black/10">
              <CardHeader className="border-b border-gray-200/50 dark:border-gray-700/30">
                <CardTitle className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-100/80 dark:bg-emerald-500/20 border border-emerald-200/50 dark:border-emerald-500/30">
                    <Activity className="w-5 h-5 text-emerald-500" />
                  </div>
                  Sentiment Over Time
                </CardTitle>
                <CardDescription>
                  Track how meeting sentiment changes over the selected period
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {trendData.length > 0 ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData}>
                        <defs>
                          <linearGradient id="sentimentGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                        <XAxis dataKey="date" className="text-xs" tick={{ fill: '#9ca3af' }} />
                        <YAxis domain={[-1, 1]} className="text-xs" tick={{ fill: '#9ca3af' }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="sentiment"
                          stroke="#10b981"
                          strokeWidth={3}
                          fill="url(#sentimentGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[300px] flex items-center justify-center">
                    <div className="text-center">
                      <div className="inline-flex p-3 rounded-xl bg-gray-100/80 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/30 mb-3">
                        <BarChart3 className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500 dark:text-gray-400">No sentiment data available for this period</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Distribution Pie Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="h-full bg-white/80 dark:bg-gray-900/40 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-700/30 shadow-sm dark:shadow-lg dark:shadow-black/10">
              <CardHeader className="border-b border-gray-200/50 dark:border-gray-700/30">
                <CardTitle className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-100/80 dark:bg-emerald-500/20 border border-emerald-200/50 dark:border-emerald-500/30">
                    <Target className="w-5 h-5 text-emerald-500" />
                  </div>
                  Sentiment Distribution
                </CardTitle>
                <CardDescription>
                  Breakdown of positive, neutral, and negative meetings
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {distributionData.length > 0 ? (
                  <>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={distributionData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {distributionData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-3 mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/30">
                      {distributionData.map((item) => (
                        <div key={item.name} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50/80 dark:bg-gray-800/30 border border-gray-200/30 dark:border-gray-700/20">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="text-sm text-gray-600 dark:text-gray-400">{item.name}</span>
                          </div>
                          <span className="text-sm font-medium">{item.value} ({Math.round((item.value / stats.total) * 100)}%)</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-[300px] flex items-center justify-center">
                    <div className="text-center">
                      <div className="inline-flex p-3 rounded-xl bg-gray-100/80 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/30 mb-3">
                        <Target className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500 dark:text-gray-400">No data available</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Second Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Recent Meetings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-white/80 dark:bg-gray-900/40 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-700/30 shadow-sm dark:shadow-lg dark:shadow-black/10">
              <CardHeader className="border-b border-gray-200/50 dark:border-gray-700/30">
                <CardTitle className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-100/80 dark:bg-emerald-500/20 border border-emerald-200/50 dark:border-emerald-500/30">
                    <Clock className="w-5 h-5 text-emerald-500" />
                  </div>
                  Recent Meetings
                </CardTitle>
                <CardDescription>
                  Latest meetings with sentiment analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                {recentMeetings.length > 0 ? (
                  <div className="space-y-3">
                    {recentMeetings.map((meeting) => (
                      <motion.div
                        key={meeting.id}
                        whileHover={{ scale: 1.01 }}
                        className="p-3 rounded-xl border border-gray-200/50 dark:border-gray-700/30 bg-gray-50/50 dark:bg-gray-800/30 hover:bg-white/80 dark:hover:bg-gray-800/50 hover:border-gray-300/50 dark:hover:border-gray-600/40 cursor-pointer transition-all duration-300"
                        onClick={() => navigate(`/meetings/${meeting.id}`)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {getSentimentIcon(meeting.sentiment_score)}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                {meeting.title}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {format(new Date(meeting.meeting_start), 'MMM d, yyyy')}
                                {meeting.company?.name && ` • ${meeting.company.name}`}
                              </p>
                            </div>
                          </div>
                          <Badge className={getSentimentColor(meeting.sentiment_score)}>
                            {getSentimentLabel(meeting.sentiment_score)}
                          </Badge>
                        </div>
                      </motion.div>
                    ))}
                    <Button
                      variant="ghost"
                      className="w-full mt-2 rounded-xl hover:bg-gray-100/80 dark:hover:bg-gray-800/50 transition-all duration-300"
                      onClick={() => navigate('/meetings')}
                    >
                      View all meetings
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center">
                    <div className="text-center">
                      <div className="inline-flex p-3 rounded-xl bg-gray-100/80 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/30 mb-3">
                        <Clock className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500 dark:text-gray-400">No meetings with sentiment data</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Highlights */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="bg-white/80 dark:bg-gray-900/40 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-700/30 shadow-sm dark:shadow-lg dark:shadow-black/10">
              <CardHeader className="border-b border-gray-200/50 dark:border-gray-700/30">
                <CardTitle className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-100/80 dark:bg-emerald-500/20 border border-emerald-200/50 dark:border-emerald-500/30">
                    <Sparkles className="w-5 h-5 text-emerald-500" />
                  </div>
                  Meeting Highlights
                </CardTitle>
                <CardDescription>
                  Best and worst performing meetings
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {/* Best Meeting */}
                {bestMeeting && (
                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    className="p-4 rounded-xl bg-white/60 dark:bg-emerald-900/20 backdrop-blur-sm border border-emerald-200/50 dark:border-emerald-500/30 cursor-pointer hover:border-emerald-300/60 dark:hover:border-emerald-400/40 hover:shadow-md transition-all duration-300"
                    onClick={() => navigate(`/meetings/${bestMeeting.id}`)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 rounded-lg bg-emerald-100/80 dark:bg-emerald-500/20 border border-emerald-200/50 dark:border-emerald-500/30">
                        <ArrowUpRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase">Best Meeting</p>
                      </div>
                    </div>
                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{bestMeeting.title}</p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {format(new Date(bestMeeting.meeting_start), 'MMM d, yyyy')}
                      </p>
                      <Badge className="bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/30">
                        +{(bestMeeting.sentiment_score ?? 0).toFixed(2)}
                      </Badge>
                    </div>
                  </motion.div>
                )}

                {/* Worst Meeting */}
                {worstMeeting && worstMeeting.id !== bestMeeting?.id && (
                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    className="p-4 rounded-xl bg-white/60 dark:bg-red-900/20 backdrop-blur-sm border border-red-200/50 dark:border-red-500/30 cursor-pointer hover:border-red-300/60 dark:hover:border-red-400/40 hover:shadow-md transition-all duration-300"
                    onClick={() => navigate(`/meetings/${worstMeeting.id}`)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 rounded-lg bg-red-100/80 dark:bg-red-500/20 border border-red-200/50 dark:border-red-500/30">
                        <ArrowDownRight className="w-4 h-4 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-red-600 dark:text-red-400 uppercase">Needs Attention</p>
                      </div>
                    </div>
                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{worstMeeting.title}</p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {format(new Date(worstMeeting.meeting_start), 'MMM d, yyyy')}
                      </p>
                      <Badge className="bg-red-100/80 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200/50 dark:border-red-500/30">
                        {(worstMeeting.sentiment_score ?? 0).toFixed(2)}
                      </Badge>
                    </div>
                  </motion.div>
                )}

                {/* Empty state if no highlights */}
                {!bestMeeting && !worstMeeting && (
                  <div className="h-[200px] flex items-center justify-center">
                    <div className="text-center">
                      <div className="inline-flex p-3 rounded-xl bg-gray-100/80 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/30 mb-3">
                        <Sparkles className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500 dark:text-gray-400">No meeting highlights yet</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Empty State */}
        {meetings.length === 0 && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="bg-white/60 dark:bg-gray-900/30 backdrop-blur-xl rounded-2xl p-8 border border-gray-200/50 dark:border-gray-700/30 shadow-sm dark:shadow-lg dark:shadow-black/10 max-w-lg mx-auto">
              <div className="inline-flex p-4 rounded-2xl bg-emerald-100/80 dark:bg-emerald-500/20 border border-emerald-200/50 dark:border-emerald-500/30 mb-5">
                <BarChart3 className="w-10 h-10 text-emerald-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                No Meeting Data Yet
              </h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
                Sync your meetings from Fathom to see sentiment analytics. We'll analyze each meeting and show you insights about the emotional tone of your conversations.
              </p>
              <Button
                onClick={() => navigate('/meetings')}
                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all duration-300 px-6"
              >
                Go to Meetings
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
