/**
 * MetricDrillDownModal - Shows meetings filtered by a specific metric
 * Used for drilling down from KPI cards and comparison matrix
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Calendar,
  Building2,
  Smile,
  Frown,
  Meh,
  TrendingUp,
  AlertCircle,
  Clock,
  ExternalLink,
  Target,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  useMeetingsForDrillDown,
  type TimePeriod,
  type DrillDownMetricType,
  type MeetingSummary,
} from '@/lib/hooks/useTeamAnalytics';

interface MetricDrillDownModalProps {
  isOpen: boolean;
  onClose: () => void;
  metricType: DrillDownMetricType;
  period: TimePeriod;
  userId?: string;
  metricTitle: string;
  repName?: string;
}

// Metric type labels and icons
const metricConfig: Record<DrillDownMetricType, { label: string; icon: React.ElementType; color: string }> = {
  all: { label: 'All Meetings', icon: Calendar, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' },
  positive_sentiment: { label: 'Positive Sentiment', icon: Smile, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30' },
  negative_sentiment: { label: 'Negative Sentiment', icon: Frown, color: 'text-red-600 bg-red-50 dark:bg-red-900/30' },
  forward_movement: { label: 'Forward Movement', icon: TrendingUp, color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-900/30' },
  objection: { label: 'Objection Raised', icon: AlertCircle, color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/30' },
  positive_outcome: { label: 'Positive Outcome', icon: Target, color: 'text-green-600 bg-green-50 dark:bg-green-900/30' },
  negative_outcome: { label: 'Negative Outcome', icon: Target, color: 'text-red-600 bg-red-50 dark:bg-red-900/30' },
};

// Skeleton for loading state
function MeetingListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl animate-pulse"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
            <div className="flex gap-2">
              <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
              <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Sentiment badge component
function SentimentBadge({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 dark:bg-gray-700 rounded-full">
        <Meh className="w-3 h-3" />
        N/A
      </span>
    );
  }

  if (score > 0.2) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full">
        <Smile className="w-3 h-3" />
        {score.toFixed(2)}
      </span>
    );
  }

  if (score < -0.2) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400 rounded-full">
        <Frown className="w-3 h-3" />
        {score.toFixed(2)}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 dark:bg-gray-700 dark:text-gray-400 rounded-full">
      <Meh className="w-3 h-3" />
      {score.toFixed(2)}
    </span>
  );
}

// Outcome badge component
function OutcomeBadge({ outcome }: { outcome: string | null }) {
  if (!outcome) {
    return (
      <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 dark:bg-gray-700 rounded-full">
        Unknown
      </span>
    );
  }

  const outcomeStyles: Record<string, string> = {
    positive: 'text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400',
    negative: 'text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400',
    neutral: 'text-gray-700 bg-gray-100 dark:bg-gray-700 dark:text-gray-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-1 text-xs font-medium rounded-full capitalize',
        outcomeStyles[outcome.toLowerCase()] || outcomeStyles.neutral
      )}
    >
      {outcome}
    </span>
  );
}

// Single meeting row
function MeetingRow({
  meeting,
  onClick,
}: {
  meeting: MeetingSummary;
  onClick: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.005 }}
      onClick={onClick}
      className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all group"
    >
      <div className="flex items-center gap-4">
        {/* Date icon */}
        <div className="flex-shrink-0 p-2.5 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-gray-900 dark:text-white truncate">
              {meeting.title || 'Untitled Meeting'}
            </h4>
            <ExternalLink className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {format(parseISO(meeting.meetingDate), 'MMM d, yyyy')}
            </span>
            {meeting.companyName && (
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                {meeting.companyName}
              </span>
            )}
            {meeting.durationMinutes && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {meeting.durationMinutes}m
              </span>
            )}
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <SentimentBadge score={meeting.sentimentScore} />
          <OutcomeBadge outcome={meeting.outcome} />
          {meeting.hasForwardMovement && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-cyan-700 bg-cyan-100 dark:bg-cyan-900/30 dark:text-cyan-400 rounded-full">
              <TrendingUp className="w-3 h-3" />
              Fwd
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function MetricDrillDownModal({
  isOpen,
  onClose,
  metricType,
  period,
  userId,
  metricTitle,
  repName,
}: MetricDrillDownModalProps) {
  const navigate = useNavigate();
  const { data: meetings, isLoading, error } = useMeetingsForDrillDown(
    metricType,
    period,
    userId,
    isOpen
  );

  const config = metricConfig[metricType];
  const Icon = config.icon;

  const handleMeetingClick = (meetingId: string) => {
    onClose();
    navigate(`/meeting/${meetingId}`);
  };

  const periodLabel = period === 7 ? '7 days' : period === 30 ? '30 days' : '90 days';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className={cn('p-2.5 rounded-xl', config.color)}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {metricTitle}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {repName || 'All Team'} &middot; Last {periodLabel}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(85vh-120px)]">
              {error ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                  <p className="text-red-600 dark:text-red-400 text-center">
                    Failed to load meetings
                  </p>
                </div>
              ) : isLoading ? (
                <MeetingListSkeleton />
              ) : !meetings || meetings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Calendar className="w-12 h-12 text-gray-400 mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 text-center">
                    No meetings found for this filter
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Results summary */}
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {meetings.length} meeting{meetings.length !== 1 ? 's' : ''} found
                    </p>
                  </div>

                  {/* Meeting list */}
                  {meetings.map((meeting) => (
                    <MeetingRow
                      key={meeting.meetingId}
                      meeting={meeting}
                      onClick={() => handleMeetingClick(meeting.meetingId)}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
