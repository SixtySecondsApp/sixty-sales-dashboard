import React from 'react';
import { Calendar, ExternalLink, CheckSquare, User, Briefcase } from 'lucide-react';
import type { MeetingPrepResponse as MeetingPrepResponseType } from '@/components/copilot/types';
import { cn } from '@/lib/utils';

interface MeetingPrepPanelProps {
  data: MeetingPrepResponseType;
  onActionClick?: (action: string, data?: any) => void;
}

export function MeetingPrepPanel({ data, onActionClick }: MeetingPrepPanelProps) {
  const { meeting, contact, deal } = data.data;
  const hasContact = Boolean(contact?.id);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-gray-700/60 bg-gray-800/40 p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-white truncate">{meeting.title}</h3>
                <p className="mt-1 text-xs text-gray-400">
                  {new Date(meeting.startTime).toLocaleString()}
                  {meeting.location ? ` • ${meeting.location}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onActionClick?.('open_meeting', { meetingId: meeting.id })}
                className="flex items-center gap-2 text-xs text-gray-300 hover:text-white bg-gray-900/40 hover:bg-gray-900/60 border border-gray-700/50 rounded-lg px-3 py-2 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open
              </button>
            </div>

            {meeting.attendees?.length ? (
              <p className="mt-2 text-xs text-gray-500">
                Attendees: {meeting.attendees.map((a) => a.name).filter(Boolean).join(', ')}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => onActionClick?.('open_contact', { contactId: contact.id })}
          disabled={!hasContact}
          className={cn(
            'rounded-xl border border-gray-700/60 bg-gray-800/30 p-3 text-left transition-colors',
            hasContact ? 'hover:bg-gray-800/50' : 'opacity-50 cursor-not-allowed'
          )}
        >
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-medium text-white">Open contact</span>
          </div>
          <p className="mt-1 text-xs text-gray-500 truncate">{contact.name}</p>
        </button>

        <button
          type="button"
          onClick={() => onActionClick?.('open_deal', { dealId: deal?.id })}
          disabled={!deal?.id}
          className={cn(
            'rounded-xl border border-gray-700/60 bg-gray-800/30 p-3 text-left transition-colors',
            deal?.id ? 'hover:bg-gray-800/50' : 'opacity-50 cursor-not-allowed'
          )}
        >
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-white">Open deal</span>
          </div>
          <p className="mt-1 text-xs text-gray-500 truncate">{deal?.name || 'No deal linked'}</p>
        </button>

        <button
          type="button"
          onClick={() =>
            onActionClick?.('quickadd_task', {
              contactId: contact.id,
              dealId: deal?.id,
              meetingId: meeting.id,
            })
          }
          disabled={!hasContact}
          className={cn(
            'rounded-xl border border-gray-700/60 bg-gray-800/30 p-3 text-left transition-colors',
            hasContact ? 'hover:bg-gray-800/50' : 'opacity-50 cursor-not-allowed'
          )}
        >
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-white">Create follow-up task</span>
          </div>
          <p className="mt-1 text-xs text-gray-500">Prefilled with this meeting</p>
        </button>
      </div>

      {/* Existing rich meeting prep content */}
      <div className="rounded-xl border border-gray-700/60 bg-gray-900/20 p-4">
        <p className="text-xs text-gray-500 mb-3">Meeting prep</p>
        {/* We keep the existing response renderer output style intact by relying on CopilotResponse tooling. */}
        {/* This panel is only the “top” UX; detailed content remains in the structured response below. */}
        <div className="text-sm text-gray-300">
          Ask: “What are the key talking points?” or “Draft a follow-up task list”.
        </div>
      </div>
    </div>
  );
}

