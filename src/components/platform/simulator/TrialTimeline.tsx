/**
 * TrialTimeline Component
 * Visual timeline showing the complete trial journey with expandable day cards
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { DayCard } from './DayCard';
import type { TrialTimelineData } from './types';

interface TrialTimelineProps {
  timelineData: TrialTimelineData;
  currentDay: number;
  onDaySelect: (day: number) => void;
}

export function TrialTimeline({ timelineData, currentDay, onDaySelect }: TrialTimelineProps) {
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([0, currentDay]));

  const toggleDay = (day: number) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) {
        next.delete(day);
      } else {
        next.add(day);
      }
      return next;
    });
  };

  const days = Object.keys(timelineData)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="space-y-4 w-full overflow-x-hidden">
      {/* Timeline Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 w-full overflow-x-hidden">
        <div className="flex-1 min-w-0 overflow-x-hidden">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white break-words">Trial Timeline</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1 break-words">
            Complete journey through the {days[days.length - 1]}-day free trial
          </p>
        </div>
        <div className="flex-shrink-0 text-left sm:text-right">
          <p className="text-sm text-gray-500 dark:text-gray-400">Current Day</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{currentDay}</p>
        </div>
      </div>

      {/* Timeline Visual */}
      <div className="relative mb-8 w-full overflow-x-hidden">
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-purple-500 to-red-500" />
        <div className="space-y-6 w-full overflow-x-hidden">
          {days.map((day, index) => {
            const data = timelineData[day];
            const isExpanded = expandedDays.has(day);
            const isPast = day < currentDay;
            const isCurrent = day === currentDay;

            return (
              <motion.div
                key={day}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative pl-16"
              >
                {/* Timeline Dot */}
                <div
                  className={`
                    absolute left-6 top-6 w-4 h-4 rounded-full border-2 transition-all
                    ${
                      isCurrent
                        ? 'bg-blue-500 border-blue-500 ring-4 ring-blue-500/20'
                        : isPast
                          ? 'bg-green-500 border-green-500'
                          : 'bg-gray-300 dark:bg-gray-600 border-gray-400 dark:border-gray-500'
                    }
                  `}
                />

                {/* Day Card */}
                <DayCard
                  day={day}
                  data={data}
                  isExpanded={isExpanded}
                  onToggle={() => toggleDay(day)}
                  currentDay={currentDay}
                />
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

