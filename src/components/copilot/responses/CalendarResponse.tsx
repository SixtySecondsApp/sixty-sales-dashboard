/**
 * Calendar/Meeting Response Component
 * Displays meetings, availability, and meeting prep briefs
 */

import React from 'react';
import { Clock, Users } from 'lucide-react';
import { ActionButtons } from '../ActionButtons';
import type { CalendarResponse } from '../types';

interface CalendarResponseProps {
  data: CalendarResponse;
  onActionClick?: (action: any) => void;
}

const formatTime = (timeString: string): string => {
  const date = new Date(timeString);
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatDate = (timeString: string): string => {
  const date = new Date(timeString);
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

export const CalendarResponse: React.FC<CalendarResponseProps> = ({ data, onActionClick }) => {
  const now = new Date();

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-300">{data.summary}</p>

      {/* Meetings List */}
      <div className="space-y-3">
        {data.data.meetings.map(meeting => {
          const startTime = new Date(meeting.startTime);
          const minutesUntil = Math.floor((startTime.getTime() - now.getTime()) / 60000);
          const isUpcoming = minutesUntil > 0 && minutesUntil < 120;
          const isPast = minutesUntil < 0;

          return (
            <div 
              key={meeting.id}
              className={`bg-gray-900/80 backdrop-blur-sm border border-gray-800/50 rounded-lg p-4 ${
                isUpcoming ? 'border-l-4 border-l-blue-500' : ''
              } ${isPast ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h5 className="text-sm font-medium text-gray-100 mb-1">
                    {meeting.title}
                  </h5>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    {formatDate(meeting.startTime)} {formatTime(meeting.startTime)} - {formatTime(meeting.endTime)}
                    {isUpcoming && (
                      <span className="ml-2 px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded">
                        In {minutesUntil} min
                      </span>
                    )}
                  </div>
                  {meeting.location && (
                    <div className="text-xs text-gray-500 mt-1">
                      📍 {meeting.location}
                    </div>
                  )}
                </div>
                {meeting.hasPrepBrief && (
                  <div className="w-2 h-2 bg-emerald-400 rounded-full" title="Prep brief available" />
                )}
              </div>

              <div className="flex items-center gap-2 mb-3">
                <Users className="w-3 h-3 text-gray-500" />
                <span className="text-xs text-gray-400">
                  {meeting.attendees.map(a => a.name).join(', ')}
                </span>
              </div>

              {meeting.hasPrepBrief && !isPast && (
                <button 
                  onClick={() => {
                    if (onActionClick) {
                      onActionClick({
                        id: 'view-prep',
                        label: 'View Prep Brief',
                        type: 'primary',
                        callback: '/api/copilot/actions/meeting-prep',
                        params: { meetingId: meeting.id }
                      });
                    }
                  }}
                  className="w-full px-3 py-2 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-lg text-xs font-medium hover:bg-blue-600/20 transition-colors"
                >
                  View Prep Brief
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Meeting Prep Brief */}
      {data.data.prepBrief && (
        <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800/50 rounded-lg p-4 border-l-4 border-l-blue-500">
          <h4 className="text-sm font-semibold text-gray-100 mb-3">
            Prep Brief: {data.data.prepBrief.contactName}
          </h4>
          
          {data.data.prepBrief.dealContext && (
            <div className="mb-3 p-2 bg-blue-500/5 rounded text-xs">
              <div className="font-semibold text-gray-300">Deal Context:</div>
              <div className="text-gray-400">
                {data.data.prepBrief.dealContext.dealName} · {formatCurrency(data.data.prepBrief.dealContext.value)} · {data.data.prepBrief.dealContext.stage}
              </div>
            </div>
          )}

          {data.data.prepBrief.talkingPoints.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-semibold text-gray-300 mb-2">Talking Points:</div>
              <ul className="space-y-1 text-xs text-gray-400">
                {data.data.prepBrief.talkingPoints.map((point, i) => (
                  <li key={i}>• {point}</li>
                ))}
              </ul>
            </div>
          )}

          {data.data.prepBrief.discoveryQuestions.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-semibold text-gray-300 mb-2">Discovery Questions:</div>
              <ul className="space-y-1 text-xs text-gray-400">
                {data.data.prepBrief.discoveryQuestions.map((question, i) => (
                  <li key={i}>• {question}</li>
                ))}
              </ul>
            </div>
          )}

          {data.data.prepBrief.warnings && data.data.prepBrief.warnings.length > 0 && (
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs">
              <div className="font-semibold text-amber-400 mb-1">Warnings:</div>
              <ul className="space-y-1 text-amber-400/80">
                {data.data.prepBrief.warnings.map((warning, i) => (
                  <li key={i}>⚠ {warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <ActionButtons actions={data.actions} onActionClick={onActionClick} />
    </div>
  );
};

// Helper function for currency formatting
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

export default CalendarResponse;

