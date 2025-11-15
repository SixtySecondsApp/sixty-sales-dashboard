/**
 * Activity Response Component
 * Displays created, upcoming, and overdue activities
 */

import React from 'react';
import { CheckCircle2, Clock, AlertCircle, Calendar } from 'lucide-react';
import { ActionButtons } from '../ActionButtons';
import type { ActivityResponse, ActivityItem } from '../types';

interface ActivityResponseProps {
  data: ActivityResponse;
  onActionClick?: (action: any) => void;
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  } else {
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  }
};

const getActivityIcon = (type: ActivityItem['type']) => {
  switch (type) {
    case 'call':
      return '📞';
    case 'email':
      return '✉️';
    case 'meeting':
      return '📅';
    case 'task':
      return '✓';
    default:
      return '•';
  }
};

const getPriorityColor = (priority: ActivityItem['priority']) => {
  switch (priority) {
    case 'high':
      return 'border-l-red-500 bg-red-500/5';
    case 'medium':
      return 'border-l-amber-500 bg-amber-500/5';
    case 'low':
      return 'border-l-blue-500 bg-blue-500/5';
    default:
      return 'border-l-gray-500 bg-gray-500/5';
  }
};

const ActivityCard: React.FC<{ activity: ActivityItem }> = ({ activity }) => {
  return (
    <div className={`bg-gray-900/80 backdrop-blur-sm border border-gray-800/50 rounded-lg p-4 border-l-4 ${getPriorityColor(activity.priority)}`}>
      <div className="flex items-start gap-3">
        <div className="text-lg">{getActivityIcon(activity.type)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-1">
            <h5 className="text-sm font-medium text-gray-100">{activity.title}</h5>
            <span className={`text-xs px-2 py-0.5 rounded ${
              activity.status === 'overdue' ? 'bg-red-500/10 text-red-400' :
              activity.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
              'bg-gray-500/10 text-gray-400'
            }`}>
              {activity.status}
            </span>
          </div>
          {activity.description && (
            <p className="text-xs text-gray-400 mb-2">{activity.description}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-gray-500">
            {activity.contactName && (
              <span>👤 {activity.contactName}</span>
            )}
            {activity.dueDate && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(activity.dueDate)}
              </span>
            )}
            <span className="capitalize">{activity.priority} priority</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ActivityResponse: React.FC<ActivityResponseProps> = ({ data, onActionClick }) => {
  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-300">{data.summary}</p>

      {/* Created Activities */}
      {data.data.created && data.data.created.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Created ({data.data.created.length})
          </h4>
          {data.data.created.map(activity => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
      )}

      {/* Upcoming Activities */}
      {data.data.upcoming && data.data.upcoming.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-blue-400 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Upcoming ({data.data.upcoming.length})
          </h4>
          {data.data.upcoming.map(activity => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
      )}

      {/* Overdue Activities */}
      {data.data.overdue && data.data.overdue.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Overdue ({data.data.overdue.length})
          </h4>
          {data.data.overdue.map(activity => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
      )}

      <ActionButtons actions={data.actions} onActionClick={onActionClick} />
    </div>
  );
};

export default ActivityResponse;

