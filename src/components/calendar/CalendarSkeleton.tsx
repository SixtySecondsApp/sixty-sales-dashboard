/**
 * Calendar Loading Skeleton Component
 *
 * Displays loading placeholders while calendar data is being fetched.
 * Improves perceived performance and provides visual feedback.
 */

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

export interface CalendarSkeletonProps {
  view?: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek';
}

export const CalendarSkeleton: React.FC<CalendarSkeletonProps> = ({
  view = 'dayGridMonth',
}) => {
  if (view === 'dayGridMonth') {
    return <CalendarMonthSkeleton />;
  }

  if (view === 'timeGridWeek') {
    return <CalendarWeekSkeleton />;
  }

  if (view === 'timeGridDay') {
    return <CalendarDaySkeleton />;
  }

  return <CalendarListSkeleton />;
};

/**
 * Month View Skeleton
 */
const CalendarMonthSkeleton: React.FC = () => {
  return (
    <div className="w-full h-full p-4 bg-gray-50 dark:bg-gray-900">
      {/* Header Row (Days of Week) */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>

      {/* Calendar Grid (5 weeks) */}
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg border border-gray-200 dark:border-gray-800 p-2 space-y-1">
            <Skeleton className="h-4 w-8" />
            {/* Random number of events per day (0-3) */}
            {Array.from({ length: Math.floor(Math.random() * 4) }).map((_, j) => (
              <Skeleton key={j} className="h-6 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Week View Skeleton
 */
const CalendarWeekSkeleton: React.FC = () => {
  return (
    <div className="w-full h-full p-4 bg-gray-50 dark:bg-gray-900">
      {/* Time column + 7 day columns */}
      <div className="grid grid-cols-8 gap-2 h-full">
        {/* Time column */}
        <div className="space-y-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>

        {/* Day columns */}
        {Array.from({ length: 7 }).map((_, dayIndex) => (
          <div key={dayIndex} className="space-y-2">
            <Skeleton className="h-8 w-full mb-4" />
            {Array.from({ length: Math.floor(Math.random() * 5) + 1 }).map((_, eventIndex) => (
              <Skeleton
                key={eventIndex}
                className="w-full"
                style={{
                  height: `${Math.floor(Math.random() * 60) + 40}px`,
                  marginTop: `${Math.floor(Math.random() * 20)}px`,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Day View Skeleton
 */
const CalendarDaySkeleton: React.FC = () => {
  return (
    <div className="w-full h-full p-4 bg-gray-50 dark:bg-gray-900">
      <div className="grid grid-cols-2 gap-4 h-full">
        {/* Time column */}
        <div className="space-y-4">
          {Array.from({ length: 24 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>

        {/* Events column */}
        <div className="space-y-3">
          <Skeleton className="h-12 w-full mb-6" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton
              key={i}
              className="w-full"
              style={{ height: `${Math.floor(Math.random() * 80) + 60}px` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * List View Skeleton
 */
const CalendarListSkeleton: React.FC = () => {
  return (
    <div className="w-full p-4 space-y-3 bg-gray-50 dark:bg-gray-900">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-4 w-2/3" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        </Card>
      ))}
    </div>
  );
};

/**
 * Calendar Sidebar Skeleton
 */
export const CalendarSidebarSkeleton: React.FC = () => {
  return (
    <div className="w-80 border-r border-gray-200 dark:border-gray-800 p-4 space-y-6">
      {/* Mini Calendar */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-7 gap-1">
          {/* Days of week */}
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={`dow-${i}`} className="h-6 w-full" />
          ))}
          {/* Calendar grid */}
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={`day-${i}`} className="h-8 w-full" />
          ))}
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-3 rounded-lg border border-gray-200 dark:border-gray-800 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Event Card Skeleton
 */
export const EventCardSkeleton: React.FC = () => {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <div className="flex items-center gap-3 mt-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-28" />
      </div>
    </Card>
  );
};
