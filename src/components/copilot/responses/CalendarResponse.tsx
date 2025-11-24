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

const formatTime = (timeString: string, timeZone?: string): string => {
  const date = new Date(timeString);
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone
  });
};

const formatDate = (timeString: string, timeZone?: string): string => {
  const date = new Date(timeString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dateString = date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone
  });

  const todayString = today.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone
  });

  const tomorrowString = tomorrow.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone
  });

  if (dateString === todayString) {
    return 'Today';
  }
  if (dateString === tomorrowString) {
    return 'Tomorrow';
  }

  return dateString;
};

const formatAvailabilityLabel = (startTime: string, endTime: string, timeZone?: string): string => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const dayLabel = start.toLocaleDateString('en-GB', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone
  });
  const startLabel = start.toLocaleTimeString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone
  });
  const endLabel = end.toLocaleTimeString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone
  });
  return `${dayLabel} · ${startLabel} – ${endLabel}`;
};

export const CalendarResponse: React.FC<CalendarResponseProps> = ({ data, onActionClick }) => {
  const now = new Date();
  const meetings = data.data.meetings || [];
  const availability = data.data.availability || [];
  const timezone = (data.metadata as Record<string, any> | undefined)?.timezone as string | undefined;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-300">{data.summary}</p>

      {/* Availability Slots */}
      {availability.length > 0 && (
        <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-100">Open Time Slots</h4>
            {timezone && <span className="text-xs text-gray-500">{timezone}</span>}
          </div>
          <div className="space-y-2">
            {availability.map(slot => {
              const is60Min = slot.duration >= 60;
              const badgeColor = is60Min ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20';
              const badgeText = is60Min ? '60 min' : '30 min';

              return (
                <div
                  key={slot.startTime}
                  className="flex items-center justify-between text-xs text-gray-400 p-2 rounded-lg bg-gray-800/40 hover:bg-gray-800/60 transition-colors"
                >
                  <div className="flex flex-col flex-1">
                    <span className="text-gray-100 font-medium">
                      {formatAvailabilityLabel(slot.startTime, slot.endTime, timezone)}
                    </span>
                    {slot.duration > 60 && (
                      <span className="text-gray-500 text-[11px]">{slot.duration} min available</span>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded border text-[10px] font-medium flex-shrink-0 ${badgeColor}`}>
                    {badgeText}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Meetings List - Compact Design */}
      <div className="space-y-1.5">
        {meetings.length === 0 && (
          <div className="text-sm text-gray-500">
            No meetings scheduled for this range.
          </div>
        )}
        {meetings.map(meeting => {
          const startTime = new Date(meeting.startTime);
          const minutesUntil = Math.floor((startTime.getTime() - now.getTime()) / 60000);
          const isUpcoming = minutesUntil > 0 && minutesUntil < 120;
          const isPast = minutesUntil < 0;
          const attendeeCount = meeting.attendees.length;
          const attendeeNames = attendeeCount > 0
            ? attendeeCount <= 2
              ? meeting.attendees.map(a => a.name).join(', ')
              : `${meeting.attendees[0]?.name || 'Unknown'} +${attendeeCount - 1}`
            : 'No attendees';

          return (
            <div
              key={meeting.id}
              className={`bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-lg p-2.5 hover:bg-gray-900/80 transition-colors ${
                isUpcoming ? 'border-l-2 border-l-blue-500' : ''
              } ${isPast ? 'opacity-50' : ''}`}
            >
              {/* Main row with title, time, and status */}
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h5 className="text-sm font-medium text-gray-100 truncate">
                      {meeting.title}
                    </h5>
                    {meeting.hasPrepBrief && (
                      <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full flex-shrink-0" title="Prep brief available" />
                    )}
                  </div>
                </div>
                {isUpcoming && (
                  <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded text-[10px] font-medium flex-shrink-0">
                    {minutesUntil}m
                  </span>
                )}
              </div>

              {/* Compact info row */}
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  <span className="whitespace-nowrap">
                    {formatDate(meeting.startTime, timezone)} {formatTime(meeting.startTime, timezone)}-{formatTime(meeting.endTime, timezone)}
                  </span>
                </div>

                {attendeeCount > 0 && (
                  <div className="flex items-center gap-1 min-w-0">
                    <Users className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{attendeeNames}</span>
                  </div>
                )}

                {meeting.location && (
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="flex-shrink-0">📍</span>
                    <span className="truncate">{meeting.location}</span>
                  </div>
                )}
              </div>

              {/* Prep brief button - only show if available and not past */}
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
                  className="w-full mt-2 px-2 py-1 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded text-[11px] font-medium hover:bg-blue-600/20 transition-colors"
                >
                  View Prep
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

