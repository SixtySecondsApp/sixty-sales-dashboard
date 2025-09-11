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
      <div className="flex items-center space-x-3 p-3 hover:bg-gray-800/50 rounded-lg transition-colors group">
        <div className="flex-shrink-0">
          <div className="w-3 h-3 rounded-full" style={{
            backgroundColor: event.color || getCategoryColor(event.category)
          }} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <Icon className="w-4 h-4 text-gray-400" />
            <h4 className="text-sm font-medium text-gray-200 truncate">
              {event.title}
            </h4>
            {event.priority && (
              <AlertTriangle className={`w-3 h-3 ${priorityColor}`} />
            )}
          </div>
          
          <div className="flex items-center space-x-4 mt-1">
            <span className="text-xs text-gray-400">
              {event.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {event.end && ` - ${event.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
            </span>
            
            {event.location && (
              <div className="flex items-center space-x-1">
                <MapPin className="w-3 h-3 text-gray-500" />
                <span className="text-xs text-gray-500 truncate max-w-32">
                  {event.location}
                </span>
              </div>
            )}
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
        
        <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="text-xs text-gray-500 capitalize">
            {event.category}
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