import React from 'react';
import { CalendarDays, CheckSquare, ExternalLink, Sparkles } from 'lucide-react';
import type { NextMeetingCommandCenterResponse as NextMeetingCommandCenterResponseType } from '../types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCopilot } from '@/lib/contexts/CopilotContext';

interface Props {
  data: NextMeetingCommandCenterResponseType;
  onActionClick?: (action: any) => void;
}

export function NextMeetingCommandCenterResponse({ data, onActionClick }: Props) {
  const { sendMessage, isLoading } = useCopilot();
  const { meeting, prepTaskPreview, isSimulation } = data.data;

  const title = meeting?.title ? String(meeting.title) : 'Next meeting';
  const start = meeting?.startTime ? String(meeting.startTime) : null;
  const url = meeting?.meetingUrl ? String(meeting.meetingUrl) : null;
  const meetingId = meeting?.id ? String(meeting.id) : null;

  const taskTitle = prepTaskPreview?.title ? String(prepTaskPreview.title) : 'Prep task';
  const taskDesc = prepTaskPreview?.description ? String(prepTaskPreview.description) : '';
  const due = prepTaskPreview?.due_date ? String(prepTaskPreview.due_date) : null;
  const priority = prepTaskPreview?.priority ? String(prepTaskPreview.priority) : null;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <h3 className="text-base font-semibold text-white truncate">Next Meeting Command Center</h3>
          </div>
          <p className="text-sm text-gray-300 mt-1">{data.summary}</p>
        </div>
        <div className={cn(
          'text-xs px-2 py-1 rounded-md border',
          isSimulation ? 'border-blue-500/30 bg-blue-500/10 text-blue-300' : 'border-green-500/30 bg-green-500/10 text-green-300'
        )}>
          {isSimulation ? 'Preview' : 'Created'}
        </div>
      </div>

      <div className="rounded-xl border border-gray-800/60 bg-gray-900/30 p-4">
        <div className="flex items-center gap-2 mb-2">
          <CalendarDays className="w-4 h-4 text-emerald-400" />
          <div className="text-sm font-semibold text-white">Next meeting</div>
        </div>
        <div className="text-sm text-gray-100 font-medium">{title}</div>
        <div className="text-xs text-gray-400 mt-1">{start ? `Starts: ${start}` : 'Start time unknown'}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {meetingId && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (onActionClick) return onActionClick({ action: 'open_meeting', data: { meetingId } });
                window.location.href = `/meetings?meeting=${encodeURIComponent(meetingId)}`;
              }}
              className="gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              View meeting
            </Button>
          )}
          {url && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (onActionClick) return onActionClick({ action: 'open_external_url', data: { url } });
                window.open(url, '_blank');
              }}
              className="gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Join link
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-800/60 bg-gray-900/30 p-4">
        <div className="flex items-center gap-2 mb-3">
          <CheckSquare className="w-4 h-4 text-purple-400" />
          <div className="text-sm font-semibold text-white">Prep task</div>
        </div>
        <div className="text-sm text-gray-100 font-medium">{taskTitle}</div>
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
          {due ? <span>Due: {due}</span> : null}
          {priority ? <span>Priority: {priority}</span> : null}
        </div>
        {taskDesc ? (
          <pre className="mt-3 text-xs text-gray-300 whitespace-pre-wrap bg-black/20 border border-gray-800/50 rounded-lg p-3 max-h-64 overflow-auto">
            {taskDesc}
          </pre>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {isSimulation ? (
            <Button size="sm" onClick={() => sendMessage('Confirm')} disabled={isLoading} className="gap-2">
              <CheckSquare className="w-4 h-4" />
              Create prep task
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (onActionClick) return onActionClick({ action: 'open_task', data: {} });
                window.location.href = '/tasks';
              }}
              className="gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              View tasks
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

