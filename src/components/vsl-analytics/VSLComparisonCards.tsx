import { motion } from 'framer-motion';
import { Play, Clock, Users, TrendingUp, ExternalLink, Crown } from 'lucide-react';
import { VSLMetrics, formatWatchTime, formatPercentage, getVariantColorClasses } from '@/lib/hooks/useVSLAnalytics';

interface VSLComparisonCardsProps {
  variants: VSLMetrics[];
  bestPerformer?: string;
  isLoading?: boolean;
}

interface MetricCardProps {
  variant: VSLMetrics;
  isBestPerformer: boolean;
  index: number;
}

function MetricCard({ variant, isBestPerformer, index }: MetricCardProps) {
  const colorClasses = getVariantColorClasses(variant.variantId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className={`relative bg-gray-800/50 backdrop-blur-sm border rounded-xl p-6 ${
        isBestPerformer ? 'border-brand-violet/50 ring-2 ring-brand-violet/20' : 'border-gray-700/50'
      }`}
    >
      {/* Best Performer Badge */}
      {isBestPerformer && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-violet text-white text-xs font-semibold">
            <Crown className="w-3 h-3" />
            Best Performer
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${colorClasses}`}>
            <Play className="w-3 h-3" />
            {variant.name}
          </span>
          <p className="text-gray-500 text-sm mt-2">{variant.route}</p>
        </div>
        <a
          href={variant.route}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
          title="Open VSL page"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Total Views */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-gray-400 text-xs">
            <Users className="w-3.5 h-3.5" />
            Total Views
          </div>
          <p className="text-2xl font-bold text-white">
            {variant.totalViews.toLocaleString()}
          </p>
        </div>

        {/* Unique Viewers */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-gray-400 text-xs">
            <Users className="w-3.5 h-3.5" />
            Unique Viewers
          </div>
          <p className="text-2xl font-bold text-white">
            {variant.uniqueViewers.toLocaleString()}
          </p>
        </div>

        {/* Avg Watch Time */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-gray-400 text-xs">
            <Clock className="w-3.5 h-3.5" />
            Avg Watch Time
          </div>
          <p className="text-2xl font-bold text-white">
            {formatWatchTime(variant.avgWatchTime)}
          </p>
        </div>

        {/* Completion Rate */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-gray-400 text-xs">
            <TrendingUp className="w-3.5 h-3.5" />
            Completion Rate
          </div>
          <p className="text-2xl font-bold text-white">
            {formatPercentage(variant.completionRate)}
          </p>
        </div>
      </div>

      {/* Progress Bar for Completion */}
      <div className="mt-4 pt-4 border-t border-gray-700/50">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
          <span>Completion Progress</span>
          <span>{formatPercentage(variant.completionRate)}</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${variant.completionRate}%` }}
            transition={{ duration: 0.8, delay: index * 0.1 + 0.3 }}
            className={`h-full rounded-full ${
              isBestPerformer
                ? 'bg-gradient-to-r from-brand-blue to-brand-violet'
                : 'bg-gray-500'
            }`}
          />
        </div>
      </div>
    </motion.div>
  );
}

function LoadingCard({ index }: { index: number }) {
  return (
    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6 animate-pulse">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="h-6 w-24 bg-gray-700 rounded-md" />
          <div className="h-4 w-16 bg-gray-700 rounded mt-2" />
        </div>
        <div className="h-8 w-8 bg-gray-700 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-20 bg-gray-700 rounded" />
            <div className="h-8 w-16 bg-gray-700 rounded" />
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-gray-700/50">
        <div className="h-2 bg-gray-700 rounded-full" />
      </div>
    </div>
  );
}

export function VSLComparisonCards({ variants, bestPerformer, isLoading }: VSLComparisonCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[0, 1, 2].map((index) => (
          <LoadingCard key={index} index={index} />
        ))}
      </div>
    );
  }

  if (!variants.length) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-8 text-center">
        <Play className="w-12 h-12 text-gray-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">No VSL Data Available</h3>
        <p className="text-gray-400 text-sm">
          Analytics data will appear here once videos start getting views.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {variants.map((variant, index) => (
        <MetricCard
          key={variant.variantId}
          variant={variant}
          isBestPerformer={variant.variantId === bestPerformer}
          index={index}
        />
      ))}
    </div>
  );
}

export default VSLComparisonCards;
