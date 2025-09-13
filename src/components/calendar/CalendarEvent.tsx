import React from 'react';
import { CalendarEvent as CalendarEventType } from '@/pages/Calendar';
import {
  Phone,
  Users,
  CheckCircle,
  Clock,
  MapPin,
  AlertTriangle,
  Star,
  User
} from 'lucide-react';

interface CalendarEventProps {
  event: CalendarEventType;
  isInList?: boolean;
  showDetails?: boolean;
}

const categoryIcons = {
  meeting: Users,
  call: Phone,
  task: CheckCircle,
  deal: Star,
  personal: User,
  'follow-up': Clock,
};

const priorityColors = {
  high: 'text-red-400',
  medium: 'text-yellow-400',
  low: 'text-green-400',
};

export const CalendarEvent: React.FC<CalendarEventProps> = ({ 
  event, 
  isInList = false, 
  showDetails = false 
}) => {
  const Icon = categoryIcons[event.category];
  const priorityColor = event.priority ? priorityColors[event.priority] : 'text-gray-400';

  if (isInList) {
    return (
      <div className="flex items-center gap-2 p-2.5 hover:bg-gray-800/50 rounded-lg transition-colors group overflow-hidden">
        <div className="flex-shrink-0">
          <div className="w-2 h-2 rounded-full" style={{
            backgroundColor: event.color || getCategoryColor(event.category)
          }} />
        </div>
        
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-start gap-1.5">
            <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-1">
                <h4 className="text-xs font-medium text-gray-200 flex-1 line-clamp-2 leading-relaxed break-words">
                  {event.title}
                </h4>
                {event.priority === 'high' && (
                  <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
                )}
              </div>
              
              <div className="mt-1 space-y-0.5">
                <div className="text-xs text-gray-400">
                  {event.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                
                {event.location && (
                  <div className="flex items-start gap-1">
                    <MapPin className="w-3 h-3 text-gray-500 flex-shrink-0 mt-0.5" />
                    <span className="text-xs text-gray-500 line-clamp-2 break-words">
                      {event.location}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {event.description && showDetails && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
              {event.description}
            </p>
          )}
          
          {event.attendees && event.attendees.length > 0 && showDetails && (
            <div className="flex items-center space-x-1 mt-2">
              <Users className="w-3 h-3 text-gray-500" />
              <span className="text-xs text-gray-500">
                {event.attendees.length} attendee{event.attendees.length > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex-shrink-0 hidden group-hover:block transition-all">
          <div className="text-xs text-gray-500 capitalize">
            {event.category.slice(0, 3)}
          </div>
        </div>
      </div>
    );
  }

  // Calendar grid view
  return (
    <div className="relative w-full h-full flex items-center space-x-1 px-1 py-0.5 rounded text-xs font-medium">
      <Icon className="w-3 h-3 flex-shrink-0 opacity-90" />
      <span className="truncate flex-1">{event.title}</span>
      {event.priority === 'high' && (
        <AlertTriangle className="w-3 h-3 text-red-300 flex-shrink-0" />
      )}
    </div>
  );
};

// Helper function to get category colors
function getCategoryColor(category: CalendarEventType['category']): string {
  const colors = {
    meeting: '#059669', // emerald-600
    call: '#3b82f6', // blue-500
    task: '#f59e0b', // amber-500
    deal: '#8b5cf6', // violet-500
    personal: '#ec4899', // pink-500
    'follow-up': '#06b6d4', // cyan-500
  };
  return colors[category] || colors.meeting;
}