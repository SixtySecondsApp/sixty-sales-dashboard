import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, CheckSquare, PhoneCall, Users, FileText, PoundSterling, Map } from 'lucide-react';
import { useCopilot } from '@/lib/contexts/CopilotContext';
import { ChatMessage } from '@/components/copilot/ChatMessage';
import { CopilotEmpty } from '@/components/copilot/CopilotEmpty';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useEventEmitter } from '@/lib/communication/EventBus';

type AssistantShellMode = 'overlay' | 'page';

interface AssistantShellProps {
  mode: AssistantShellMode;
  onOpenQuickAdd?: (opts: { preselectAction: string; initialData?: Record<string, unknown> }) => void;
}

export function AssistantShell({ mode, onOpenQuickAdd }: AssistantShellProps) {
  const { messages, isLoading, sendMessage, cancelRequest } = useCopilot();
  const [inputValue, setInputValue] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const emit = useEventEmitter();

  const isEmpty = messages.length === 0 && !isLoading;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = () => {
    if (!inputValue.trim() || isLoading) return;
    sendMessage(inputValue);
    setInputValue('');
  };

  const handleActionClick = async (action: any) => {
    const actionName = typeof action === 'string' ? action : action?.action || action?.type;
    const payload = typeof action === 'object' ? (action?.data ?? action) : undefined;

    if (!actionName) return;

    if (actionName === 'open_contact' && payload?.contactId) {
      navigate(`/crm/contacts/${payload.contactId}`);
      return;
    }

    if (actionName === 'open_deal' && payload?.dealId) {
      navigate(`/crm/deals/${payload.dealId}`);
      return;
    }

    // Meeting navigation isn’t standardized; best-effort to meetings list with context.
    if (actionName === 'open_meeting' && payload?.meetingId) {
      navigate(`/meetings?meeting=${encodeURIComponent(payload.meetingId)}`);
      return;
    }

    if (actionName === 'open_search_result' && payload?.id && payload?.type) {
      const t = String(payload.type);
      if (t === 'contact') {
        navigate(`/crm/contacts/${payload.id}`);
        return;
      }
      if (t === 'deal') {
        navigate(`/crm/deals/${payload.id}`);
        return;
      }
      if (t === 'task') {
        // We don't have a task record page path standardized; fall back to tasks list.
        navigate('/tasks');
        return;
      }
      if (t === 'meeting') {
        navigate(`/meetings?meeting=${encodeURIComponent(payload.id)}`);
        return;
      }
      // Fallback to CRM hub
      navigate('/crm');
      return;
    }

    // Quick Add launcher (prefilled)
    if (actionName === 'quickadd_task') {
      const initialData = {
        ...(payload?.contactId ? { contact_id: payload.contactId } : {}),
        ...(payload?.dealId ? { deal_id: payload.dealId } : {}),
        ...(payload?.meetingId ? { meeting_id: payload.meetingId } : {}),
      };

      if (onOpenQuickAdd) {
        onOpenQuickAdd({ preselectAction: 'task', initialData });
        return;
      }

      await emit('modal:opened', {
        type: 'quick-add',
        context: { preselectAction: 'task', initialData },
      });
      return;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const shellClass = useMemo(() => {
    return mode === 'overlay' ? 'h-full' : 'h-full';
  }, [mode]);

  const quickActions = useMemo(() => {
    return [
      { id: 'task', icon: CheckSquare, label: 'Add Task', color: 'text-blue-400', bg: 'bg-blue-500/10' },
      { id: 'outbound', icon: PhoneCall, label: 'Add Outbound', color: 'text-sky-400', bg: 'bg-sky-500/10' },
      { id: 'meeting', icon: Users, label: 'Add Meeting', color: 'text-violet-400', bg: 'bg-violet-500/10' },
      { id: 'proposal', icon: FileText, label: 'Add Proposal', color: 'text-amber-400', bg: 'bg-amber-500/10' },
      { id: 'sale', icon: PoundSterling, label: 'Add Sale', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
      { id: 'roadmap', icon: Map, label: 'Add Roadmap', color: 'text-purple-400', bg: 'bg-purple-500/10' },
    ] as const;
  }, []);

  return (
    <div className={cn('flex flex-col min-h-0', shellClass)}>
      {/* Messages or Welcome Screen */}
      {isEmpty ? (
        <CopilotEmpty onPromptClick={(prompt) => sendMessage(prompt)} />
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {messages.map((m) => (
            <ChatMessage key={m.id} message={m} onActionClick={handleActionClick} />
          ))}
          <div ref={endRef} />
        </div>
      )}

      {/* Input - only show when there are messages (CopilotEmpty has its own input) */}
      {!isEmpty && (
        <div className="flex-shrink-0 p-4 border-t border-gray-800/50">
          {/* Quick Add chips (V2-style) */}
          {mode === 'overlay' && (
            <div className="mb-3">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {quickActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    disabled={isLoading}
                    onClick={() => {
                      if (onOpenQuickAdd) {
                        onOpenQuickAdd({ preselectAction: action.id });
                        return;
                      }
                      emit('modal:opened', { type: 'quick-add', context: { preselectAction: action.id } });
                    }}
                    className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 hover:border-gray-600 transition-all duration-200 group ${
                      isLoading ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-lg ${action.bg} flex items-center justify-center`}>
                      <action.icon className={`w-3.5 h-3.5 ${action.color}`} />
                    </div>
                    <span className="text-sm text-gray-200 whitespace-nowrap">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <div className="flex items-end bg-gray-800/50 rounded-xl border border-gray-700/50 focus-within:border-violet-500/50 transition-colors">
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me to create, find, or prep anything…"
                  rows={1}
                  className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm py-3 px-4 resize-none outline-none max-h-32"
                  style={{ minHeight: '44px' }}
                />
                {/* Cancel button could live here later; for now keep UI simple */}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 ${
                inputValue.trim() && !isLoading
                  ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/25'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }`}
              aria-label="Send"
            >
              <ArrowUp className="w-5 h-5" />
            </button>
          </div>

          {isLoading && (
            <div className="mt-2 text-xs text-gray-500">
              Working… <button className="underline" onClick={cancelRequest}>Cancel</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

