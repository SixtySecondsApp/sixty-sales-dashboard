import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarEvent } from '@/pages/Calendar';
import { CalendarEvent as CalendarEventComponent } from './CalendarEvent';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Filter,
  Eye,
  EyeOff,
  Palette,
  Settings,
  Menu,
  X
} from 'lucide-react';
import { format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isToday,
  addMonths,
  subMonths,
  getDay,
  parseISO
} from 'date-fns';

interface CalendarSidebarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  events: CalendarEvent[];
  collapsed: boolean;
  onToggleCollapsed: (collapsed: boolean) => void;
  selectedCategories: string[];
  onCategoriesChange: (categories: string[]) => void;
  onEventClick?: (event: CalendarEvent) => void;
}

const categoryOptions = [
  { value: 'meeting', label: 'Meetings', color: 'bg-emerald-600', count: 0 },
  { value: 'call', label: 'Calls', color: 'bg-blue-500', count: 0 },
  { value: 'task', label: 'Tasks', color: 'bg-amber-500', count: 0 },
  { value: 'deal', label: 'Deals', color: 'bg-violet-500', count: 0 },
  { value: 'personal', label: 'Personal', color: 'bg-pink-500', count: 0 },
  { value: 'follow-up', label: 'Follow-ups', color: 'bg-cyan-500', count: 0 },
];

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const CalendarSidebar: React.FC<CalendarSidebarProps> = ({
  selectedDate,
  onDateSelect,
  events,
  collapsed,
  onToggleCollapsed,
  selectedCategories,
  onCategoriesChange,
  onEventClick,
}) => {
  const [miniCalendarDate, setMiniCalendarDate] = useState(selectedDate);
  const [showUpcoming, setShowUpcoming] = useState(true);
  const [showCategories, setShowCategories] = useState(true);

  // Calculate category counts
  const categoriesWithCounts = useMemo(() => {
    const counts = events.reduce((acc, event) => {
      acc[event.category] = (acc[event.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return categoryOptions.map(category => ({
      ...category,
      count: counts[category.value] || 0,
    }));
  }, [events]);

  // Get upcoming events (next 7 days)
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const weekFromNow = new Date();
    weekFromNow.setDate(now.getDate() + 7);

    return events
      .filter(event => event.start >= now && event.start <= weekFromNow)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 10);
  }, [events]);

  // Generate mini calendar days
  const miniCalendarDays = useMemo(() => {
    const monthStart = startOfMonth(miniCalendarDate);
    const monthEnd = endOfMonth(miniCalendarDate);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [miniCalendarDate]);

  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    return events.filter(event => isSameDay(event.start, date));
  };

  const handleCategoryToggle = (categoryValue: string) => {
    if (selectedCategories.includes(categoryValue)) {
      onCategoriesChange(selectedCategories.filter(c => c !== categoryValue));
    } else {
      onCategoriesChange([...selectedCategories, categoryValue]);
    }
  };

  const handleSelectAll = () => {
    if (selectedCategories.length === categoryOptions.length) {
      onCategoriesChange([]);
    } else {
      onCategoriesChange(categoryOptions.map(c => c.value));
    }
  };

  if (collapsed) {
    return (
      <div className="h-full flex flex-col items-center py-4 space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onToggleCollapsed(false)}
          className="text-gray-400 hover:text-gray-200"
        >
          <Menu className="w-5 h-5" />
        </Button>
        
        <div className="flex flex-col space-y-2">
          {categoriesWithCounts.map(category => (
            <motion.div
              key={category.value}
              whileHover={{ scale: 1.1 }}
              className="relative"
            >
              <div className={`w-3 h-3 rounded-full ${category.color} cursor-pointer`} />
              {category.count > 0 && (
                <Badge
                  variant="secondary"
                  className="absolute -top-2 -right-2 w-5 h-5 p-0 flex items-center justify-center text-xs bg-gray-800 text-gray-200"
                >
                  {category.count}
                </Badge>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-transparent overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800/50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Calendar</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleCollapsed(true)}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0 overflow-hidden">
        <div className="p-3 space-y-4 overflow-hidden">
          {/* Mini Calendar */}
          <Card className="bg-white dark:bg-gray-800/30 border-gray-200 dark:border-gray-700/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMiniCalendarDate(subMonths(miniCalendarDate, 1))}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 p-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-200">
                  {format(miniCalendarDate, 'MMMM yyyy')}
                </h3>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMiniCalendarDate(addMonths(miniCalendarDate, 1))}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 p-1"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="p-2">
              {/* Days of week header */}
              <div className="grid grid-cols-7 gap-1 mb-3">
                {DAYS_OF_WEEK.map(day => (
                  <div key={day} className="text-center text-xs font-medium text-gray-600 dark:text-gray-400 py-2">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar days */}
              <div className="grid grid-cols-7 gap-1">
                {miniCalendarDays.map(day => {
                  const isSelected = isSameDay(day, selectedDate);
                  const isCurrentMonth = isSameMonth(day, miniCalendarDate);
                  const dayEvents = getEventsForDate(day);
                  const hasEvents = dayEvents.length > 0;
                  
                  return (
                    <motion.button
                      key={day.toISOString()}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onDateSelect(day)}
                      className={`
                        relative py-2 px-1 text-sm rounded-md transition-colors h-8 flex items-center justify-center
                        ${isSelected
                          ? 'bg-emerald-600 text-white'
                          : isToday(day)
                          ? 'bg-emerald-100 dark:bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 font-semibold'
                          : isCurrentMonth
                          ? 'text-gray-900 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                          : 'text-gray-400 dark:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/30'
                        }
                      `}
                    >
                      {format(day, 'd')}
                      {hasEvents && (
                        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2">
                          <div className="w-1 h-1 bg-emerald-400 rounded-full" />
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Category Filters */}
          <Card className="bg-white dark:bg-gray-800/30 border-gray-200 dark:border-gray-700/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-200 flex items-center space-x-2">
                  <Palette className="w-4 h-4" />
                  <span>Categories</span>
                </h3>
                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 px-2 py-1"
                  >
                    {selectedCategories.length === categoryOptions.length ? 'None' : 'All'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCategories(!showCategories)}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 p-1"
                  >
                    {showCategories ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <AnimatePresence>
              {showCategories && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <CardContent className="space-y-2 pt-0">
                    {categoriesWithCounts.map(category => {
                      const isSelected = selectedCategories.length === 0 || selectedCategories.includes(category.value);
                      
                      return (
                        <motion.div
                          key={category.value}
                          whileHover={{ x: 2 }}
                          className="flex items-center justify-between p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700/30 cursor-pointer"
                          onClick={() => handleCategoryToggle(category.value)}
                        >
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2">
                              <div className={`w-3 h-3 rounded-full ${category.color} ${!isSelected ? 'opacity-30' : ''}`} />
                              <span className={`text-sm ${isSelected ? 'text-gray-900 dark:text-gray-200' : 'text-gray-500 dark:text-gray-500'}`}>
                                {category.label}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Badge
                              variant="secondary"
                              className={`text-xs ${isSelected ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-200' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500'}`}
                            >
                              {category.count}
                            </Badge>
                            {isSelected ? (
                              <Eye className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <EyeOff className="w-3 h-3 text-gray-500 dark:text-gray-500" />
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>

          {/* Upcoming Events */}
          <Card className="bg-white dark:bg-gray-800/30 border-gray-200 dark:border-gray-700/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-200">Upcoming</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowUpcoming(!showUpcoming)}
                  className="text-gray-400 hover:text-gray-200 p-1"
                >
                  {showUpcoming ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </Button>
              </div>
            </CardHeader>
            
            <AnimatePresence>
              {showUpcoming && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <CardContent className="pt-0 overflow-hidden">
                    {upcomingEvents.length > 0 ? (
                      <div className="space-y-1 overflow-hidden">
                        {upcomingEvents.map((event, index) => (
                          <motion.div
                            key={event.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="hover:bg-gray-700/30 rounded-md transition-colors cursor-pointer"
                            onClick={() => onEventClick?.(event)}
                          >
                            <CalendarEventComponent
                              event={event}
                              isInList={true}
                              showDetails={false}
                            />
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <Calendar className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No upcoming events</p>
                      </div>
                    )}
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
};