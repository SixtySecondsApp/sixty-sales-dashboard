import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ActivityHeatmapCellProps {
  date: Date;
  points: number;
  activities: {
    outbound: number;
    meetings: number;
    proposals: number;
    deals: number;
  };
  onClick?: () => void;
}

export function ActivityHeatmapCell({ date, points, activities, onClick }: ActivityHeatmapCellProps) {
  const getOpacity = () => {
    if (points === 0) return 0;
    if (points >= 100) return 1;
    return 0.1 + (points / 100) * 0.8;
  };

  const getBackground = () => {
    if (points >= 100) {
      return 'bg-gradient-to-r from-amber-400 to-amber-500 shadow-lg shadow-amber-500/20';
    }
    return 'bg-emerald-500';
  };

  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => onClick?.()}
      className={cn(
        'relative aspect-square rounded-lg overflow-hidden group transition-all duration-300',
        points > 0 ? 'hover:shadow-lg' : 'cursor-default'
      )}
    >
      <div className="absolute inset-0 bg-gray-200 dark:bg-gray-800/50" />
      <div
        className={cn(
          'absolute inset-0 transition-opacity duration-300',
          getBackground()
        )}
        style={{ opacity: getOpacity() }}
      />

      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] sm:text-xs font-medium text-gray-900 dark:text-white/90">
          {format(date, 'd')}
        </span>
      </div>

      {points > 0 && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-white dark:bg-gray-900/95 backdrop-blur-sm transition-opacity duration-300">
          <div className="text-center p-1">
            <div className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">{points} pts</div>
            <div className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">
              {format(date, 'MMM d')}
            </div>
            {(activities.outbound > 0 || activities.meetings > 0 || activities.proposals > 0 || activities.deals > 0) && (
              <div className="mt-1 space-y-0.5 text-[8px] sm:text-[10px]">
                {activities.outbound > 0 && (
                  <div className="text-blue-500 dark:text-blue-400">{activities.outbound} calls</div>
                )}
                {activities.meetings > 0 && (
                  <div className="text-violet-500 dark:text-violet-400">{activities.meetings} meets</div>
                )}
                {activities.proposals > 0 && (
                  <div className="text-orange-500 dark:text-orange-400">{activities.proposals} props</div>
                )}
                {activities.deals > 0 && (
                  <div className="text-emerald-500 dark:text-emerald-400">{activities.deals} deals</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </motion.button>
  );
}