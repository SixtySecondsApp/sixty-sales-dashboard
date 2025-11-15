import React from 'react';
import { ActivityPlanningResponse as ActivityPlanningResponseType } from '../types';
import { Calendar, Clock, CheckSquare, Users, Lightbulb, AlertCircle } from 'lucide-react';

interface ActivityPlanningResponseProps {
  data: ActivityPlanningResponseType;
  onActionClick?: (action: string, data?: any) => void;
}

export const ActivityPlanningResponse: React.FC<ActivityPlanningResponseProps> = ({ data, onActionClick }) => {
  const { date, suggestedActivities, prioritizedTasks, scheduledMeetings, timeBlocks, recommendations } = data.data;

  const formatTime = (time: string) => {
    return new Date(time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call': return '📞';
      case 'email': return '✉️';
      case 'meeting': return '🤝';
      case 'task': return '✓';
      case 'follow_up': return '↩️';
      default: return '•';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Date Header */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-blue-500" />
          <div>
            <h3 className="text-lg font-semibold text-white">
              {new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </h3>
          </div>
        </div>
      </div>

      {/* Scheduled Meetings */}
      {scheduledMeetings.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-500" />
            Scheduled Meetings ({scheduledMeetings.length})
          </h4>
          <div className="space-y-3">
            {scheduledMeetings.map((meeting) => (
              <div key={meeting.id} className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h5 className="font-semibold text-white">{meeting.title}</h5>
                    <div className="mt-2 space-y-1 text-sm text-gray-400">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>{formatTime(meeting.startTime)} - {formatTime(meeting.endTime)}</span>
                      </div>
                      {meeting.location && <div>📍 {meeting.location}</div>}
                      {meeting.attendees.length > 0 && (
                        <div>👥 {meeting.attendees.join(', ')}</div>
                      )}
                      {meeting.relatedDealName && (
                        <div>💼 Deal: {meeting.relatedDealName}</div>
                      )}
                    </div>
                    {meeting.hasPrepBrief && (
                      <div className="mt-2 text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded inline-block">
                        Prep brief available
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prioritized Tasks */}
      {prioritizedTasks.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-yellow-500" />
            Prioritized Tasks ({prioritizedTasks.length})
          </h4>
          <div className="space-y-3">
            {prioritizedTasks.map((task) => (
              <div key={task.id} className={`border rounded-lg p-4 ${getPriorityColor(task.priority)}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium px-2 py-1 rounded bg-current/20">
                        {task.priority}
                      </span>
                      {task.isOverdue && (
                        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">
                          Overdue
                        </span>
                      )}
                    </div>
                    <h5 className="font-semibold text-white">{task.title}</h5>
                    {task.description && (
                      <p className="text-sm text-gray-300 mt-1">{task.description}</p>
                    )}
                    <div className="mt-2 space-y-1 text-xs text-gray-400">
                      {task.relatedContactName && <div>👤 Contact: {task.relatedContactName}</div>}
                      {task.relatedDealName && <div>💼 Deal: {task.relatedDealName}</div>}
                      {task.dueDate && (
                        <div>📅 Due: {new Date(task.dueDate).toLocaleDateString()}</div>
                      )}
                      <div>⏱️ Est: {task.estimatedDuration} min</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Activities */}
      {suggestedActivities.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-blue-500" />
            Suggested Activities ({suggestedActivities.length})
          </h4>
          <div className="space-y-3">
            {suggestedActivities.map((activity) => (
              <div key={activity.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{getActivityIcon(activity.type)}</span>
                      <span className="text-xs font-medium text-gray-400 capitalize">{activity.type}</span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        activity.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                        activity.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {activity.priority}
                      </span>
                    </div>
                    <h5 className="font-semibold text-white">{activity.title}</h5>
                    {activity.description && (
                      <p className="text-sm text-gray-300 mt-1">{activity.description}</p>
                    )}
                    <div className="mt-2 space-y-1 text-xs text-gray-400">
                      {activity.relatedContactName && <div>👤 Contact: {activity.relatedContactName}</div>}
                      {activity.relatedDealName && <div>💼 Deal: {activity.relatedDealName}</div>}
                      <div>⏱️ Est: {activity.estimatedDuration} min</div>
                    </div>
                    <div className="mt-2 text-xs bg-blue-500/10 text-blue-400 px-2 py-1 rounded inline-block">
                      💡 {activity.reason}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Time Blocks */}
      {timeBlocks.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-white mb-3">Daily Schedule</h4>
          <div className="space-y-2">
            {timeBlocks.map((block, idx) => (
              <div
                key={idx}
                className={`rounded-lg p-3 border ${
                  block.type === 'meeting' ? 'bg-purple-500/10 border-purple-500/20' :
                  block.type === 'focus_time' ? 'bg-blue-500/10 border-blue-500/20' :
                  block.type === 'break' ? 'bg-gray-500/10 border-gray-500/20' :
                  'bg-gray-800/50 border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium text-white">
                      {formatTime(block.startTime)} - {formatTime(block.endTime)}
                    </div>
                    <span className="text-xs capitalize text-gray-400">{block.type.replace('_', ' ')}</span>
                  </div>
                  {block.activity && (
                    <div className="text-sm text-gray-300">
                      {block.activity.title || (block.activity as any).title}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-blue-500" />
            Recommendations
          </h4>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <ul className="space-y-2">
              {recommendations.map((rec, idx) => (
                <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

