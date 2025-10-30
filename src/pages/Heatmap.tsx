import { useState } from 'react';
import { motion } from 'framer-motion';
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from 'date-fns';
import { ActivityHeatmapCell } from '@/components/ActivityHeatmapCell';
import { useUser } from '@/lib/hooks/useUser';
import { useActivities } from '@/lib/hooks/useActivities';
import { useActivityFilters } from '@/lib/hooks/useActivityFilters';
import { useNavigate } from 'react-router-dom';

export default function Heatmap() {
  const { userData } = useUser();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { activities } = useActivities();
  
  const startDate = startOfMonth(currentMonth);
  const endDate = endOfMonth(currentMonth);
  
  const { setFilters } = useActivityFilters();
  const navigate = useNavigate();

  const firstDayOfMonth = getDay(startDate);
  const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });
  
  // Calculate empty days at the start (if month doesn't start on Monday)
  const emptyDays = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  const totalDays = emptyDays + daysInMonth.length;
  const totalWeeks = Math.ceil(totalDays / 7);

  const calculateDayPoints = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayActivities = activities.filter(a => 
      format(new Date(a.date), 'yyyy-MM-dd') === dateStr
    );

    const outboundCalls = dayActivities
      .filter(a => a.type === 'outbound')
      .reduce((sum, a) => sum + (a.quantity || 1), 0);
    const meetings = dayActivities
      .filter(a => a.type === 'meeting')
      .reduce((sum, a) => sum + (a.quantity || 1), 0);
    const proposals = dayActivities
      .filter(a => a.type === 'proposal')
      .reduce((sum, a) => sum + (a.quantity || 1), 0);
    const deals = dayActivities
      .filter(a => a.type === 'sale')
      .reduce((sum, a) => sum + (a.quantity || 1), 0);

    return {
      points: outboundCalls * 1 + meetings * 5 + proposals * 10 + deals * 20,
      activities: {
        outbound: outboundCalls,
        meetings: meetings,
        proposals: proposals,
        deals: deals
      }
    };
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 p-4 sm:p-6 lg:p-8 mt-12 lg:mt-0 flex flex-col">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Activity Heatmap</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Track your daily sales performance</p>
        </div>

        {/* Month Navigation and Legend */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <span className="text-base sm:text-lg font-medium text-emerald-600 dark:text-emerald-500">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <button
              onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
          <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700/50 shadow-sm dark:shadow-none">
            Outbound: 1pt | Meeting: 5pts | Proposal: 10pts | Deal: 20pts
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 bg-white dark:bg-gray-900/80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700/50 shadow-sm dark:shadow-none p-3 sm:p-4 overflow-hidden flex flex-col">
          <div className="grid grid-cols-[30px_repeat(7,1fr)] gap-1 flex-1 min-h-0">
            {/* Header row */}
            <div className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm py-2" />
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} className="text-gray-600 dark:text-gray-400 text-xs text-center py-2">{day}</div>
            ))}

            {/* Calendar grid */}
            {Array.from({ length: totalWeeks }).map((_, week) => (
              <React.Fragment key={`week-${week}`}>
                <div className="text-gray-600 dark:text-gray-400 text-xs text-right pr-2 flex items-center justify-end">
                  W{week + 1}
                </div>
                {Array.from({ length: 7 }).map((_, day) => {
                  const dayNumber = week * 7 + day - emptyDays + 1;
                  const currentDate = new Date(startDate);
                  currentDate.setDate(dayNumber);

                  if (dayNumber <= 0 || dayNumber > daysInMonth.length) {
                    return <div key={`empty-${week}-${day}`} className="aspect-square" />;
                  }

                  const { points, activities } = calculateDayPoints(currentDate);
                  return (
                    <ActivityHeatmapCell
                      key={format(currentDate, 'yyyy-MM-dd')}
                      date={currentDate}
                      points={points}
                      activities={activities}
                      onClick={() => {
                        if (points > 0) {
                          setFilters({ 
                            searchQuery: '',
                            type: undefined,
                            dateRange: {
                              start: new Date(currentDate.getTime()),
                              end: new Date(currentDate.getTime() + 24 * 60 * 60 * 1000 - 1)
                            }
                          });
                          navigate('/activity');
                        }
                      }}
                    />
                  );
                })}
              </React.Fragment>
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs text-gray-600 dark:text-gray-400 mt-3 p-2 bg-gray-100 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700/50">
            <span>Less</span>
            <div className="w-3 h-3 rounded bg-gray-300 dark:bg-gray-800" />
            <div className="w-3 h-3 rounded bg-emerald-500 opacity-20" />
            <div className="w-3 h-3 rounded bg-emerald-500 opacity-40" />
            <div className="w-3 h-3 rounded bg-emerald-500 opacity-60" />
            <div className="w-3 h-3 rounded bg-emerald-500 opacity-80" />
            <div className="w-3 h-3 rounded bg-emerald-500" />
            <div className="w-3 h-3 rounded bg-gradient-to-r from-amber-400 to-amber-500 shadow-sm" />
            <span>More</span>
            <span className="ml-2 text-amber-500 dark:text-amber-400">★ 100+ points</span>
          </div>
        </div>
      </div>
    </div>
  );
}