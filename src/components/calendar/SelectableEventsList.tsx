import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { format, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckSquare,
  Square,
  Tag
} from 'lucide-react';
import { CalendarEvent } from '@/pages/Calendar';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

interface SelectableEventsListProps {
  events: CalendarEvent[];
  selectedIds: Set<string>;
  onToggleEvent: (eventId: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  dateRange?: { start: Date; end: Date };
}

const categoryColors = {
  meeting: 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30',
  call: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  task: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  deal: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  personal: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  'follow-up': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
};

const categoryLabels = {
  meeting: 'Meeting',
  call: 'Phone Call',
  task: 'Task',
  deal: 'Deal Activity',
  personal: 'Personal',
  'follow-up': 'Follow-up',
};

export const SelectableEventsList: React.FC<SelectableEventsListProps> = ({
  events,
  selectedIds,
  onToggleEvent,
  onSelectAll,
  onClearSelection,
  dateRange,
}) => {
  // Filter events by date range if provided
  const filteredEvents = useMemo(() => {
    if (!dateRange) return events;

    return events.filter(event => {
      const eventDate = new Date(event.start);
      return isWithinInterval(eventDate, {
        start: startOfDay(dateRange.start),
        end: endOfDay(dateRange.end)
      });
    });
  }, [events, dateRange]);

  // Group events by date
  const groupedEvents = useMemo(() => {
    const groups: { [key: string]: CalendarEvent[] } = {};

    filteredEvents.forEach(event => {
      const dateKey = format(new Date(event.start), 'yyyy-MM-dd');
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(event);
    });

    // Sort groups by date
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, events]) => ({
        date,
        events: events.sort((a, b) =>
          new Date(a.start).getTime() - new Date(b.start).getTime()
        )
      }));
  }, [filteredEvents]);

  const allSelected = filteredEvents.length > 0 && filteredEvents.every(e => selectedIds.has(e.id));
  const someSelected = filteredEvents.some(e => selectedIds.has(e.id)) && !allSelected;

  return (
    <div className="space-y-6 p-4">
      {/* Select All Header */}
      <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={allSelected}
            onCheckedChange={() => allSelected ? onClearSelection() : onSelectAll()}
            className={cn(
              "border-gray-600",
              someSelected && "data-[state=checked]:bg-[#37bd7e]/50"
            )}
          />
          <div>
            <p className="text-sm font-medium">
              {allSelected ? 'All events selected' : someSelected ? 'Some events selected' : 'Select all events'}
            </p>
            <p className="text-xs text-gray-400">
              {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} in list
            </p>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <Badge className="bg-[#37bd7e]/20 text-[#37bd7e] border-[#37bd7e]/30">
            {selectedIds.size} selected
          </Badge>
        )}
      </div>

      {/* Events List */}
      <div className="space-y-6">
        {groupedEvents.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No events found</p>
          </div>
        ) : (
          groupedEvents.map(({ date, events }) => (
            <div key={date} className="space-y-3">
              {/* Date Header */}
              <div className="flex items-center gap-2 text-sm font-medium text-gray-400">
                <Calendar className="w-4 h-4" />
                {format(new Date(date), 'EEEE, MMMM d, yyyy')}
              </div>

              {/* Events for this date */}
              <div className="space-y-2">
                {events.map((event, index) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div
                      onClick={() => onToggleEvent(event.id)}
                      className={cn(
                        "flex items-start gap-4 p-4 rounded-lg border transition-all cursor-pointer",
                        selectedIds.has(event.id)
                          ? "bg-[#37bd7e]/10 border-[#37bd7e]/50"
                          : "bg-gray-800/30 border-gray-700 hover:bg-gray-800/50 hover:border-gray-600"
                      )}
                    >
                      {/* Checkbox */}
                      <Checkbox
                        checked={selectedIds.has(event.id)}
                        onCheckedChange={() => onToggleEvent(event.id)}
                        className="mt-0.5 border-gray-600"
                        onClick={(e) => e.stopPropagation()}
                      />

                      {/* Event Details */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="font-medium">{event.title}</h3>
                            {event.description && (
                              <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                                {event.description}
                              </p>
                            )}
                          </div>
                          <Badge className={categoryColors[event.category]}>
                            {categoryLabels[event.category]}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {event.allDay ? (
                              'All day'
                            ) : (
                              <>
                                {format(new Date(event.start), 'h:mm a')}
                                {event.end && ` - ${format(new Date(event.end), 'h:mm a')}`}
                              </>
                            )}
                          </div>

                          {event.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {event.location}
                            </div>
                          )}

                          {event.attendees && event.attendees.length > 0 && (
                            <div className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}
                            </div>
                          )}

                          {event.priority && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs",
                                event.priority === 'high' && "border-red-500/50 text-red-400",
                                event.priority === 'medium' && "border-yellow-500/50 text-yellow-400",
                                event.priority === 'low' && "border-green-500/50 text-green-400"
                              )}
                            >
                              {event.priority}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
