import { useState } from 'react';
import type { LeadWithPrep } from '@/lib/services/leadService';
import { ClipboardList, Globe, Mail, Timer, User, CheckSquare, Calendar, Copy, RefreshCw, ChevronDown, ChevronUp, Pin, Clock, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';
import { useUser } from '@/lib/hooks/useUser';
import { triggerLeadPrep, resetLeadPrep } from '@/lib/services/leadService';

interface LeadDetailPanelProps {
  lead: LeadWithPrep | null;
  onRefresh?: () => void;
}

type LengthMode = 'short' | 'standard' | 'detailed';

export function LeadDetailPanel({ lead, onRefresh }: LeadDetailPanelProps) {
  const { userData } = useUser();
  const [lengthMode, setLengthMode] = useState<LengthMode>('standard');
  const [expandedPlaybooks, setExpandedPlaybooks] = useState<Set<string>>(new Set());
  const [refreshingSignals, setRefreshingSignals] = useState(false);
  const [isRerunning, setIsRerunning] = useState(false);

  if (!lead) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        Select a lead to see prep guidance.
      </div>
    );
  }

  const meetingStart = lead.meeting_start ? format(new Date(lead.meeting_start), 'PPpp') : 'TBD';
  const lastUpdated = lead.metadata?.prep_generated_at 
    ? format(new Date(lead.metadata.prep_generated_at as string), 'PPpp')
    : null;

  // Get pinned notes
  const pinnedNotes = lead.lead_prep_notes?.filter(n => n.is_pinned) || [];
  const regularNotes = lead.lead_prep_notes?.filter(n => !n.is_pinned) || [];

  // Group notes by type for playbook display
  const playbookNotes = regularNotes.filter(n => 
    n.metadata && typeof n.metadata === 'object' && 
    (n.metadata as any).type?.startsWith('industry_playbook')
  );
  const otherNotes = regularNotes.filter(n => 
    !n.metadata || typeof n.metadata !== 'object' || 
    !(n.metadata as any).type?.startsWith('industry_playbook')
  );

  const handleCreateTask = async (noteTitle: string, noteBody: string) => {
    if (!userData?.id) {
      toast.error('User not found');
      return;
    }

    try {
      const { error } = await supabase.from('tasks').insert({
        title: `Prep: ${noteTitle}`,
        description: noteBody.substring(0, 500),
        task_type: 'follow_up',
        priority: 'medium',
        assigned_to: userData.id,
        contact_name: lead.contact_name || lead.contact_email,
        company: lead.domain || undefined,
        due_date: lead.meeting_start || undefined,
      });

      if (error) throw error;
      toast.success('Task created successfully');
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error('Failed to create task');
    }
  };

  const handleAddToAgenda = async (noteTitle: string, noteBody: string) => {
    if (!lead.meeting_start) {
      toast.error('No meeting scheduled');
      return;
    }

    try {
      // Find or create meeting
      const { data: meetings, error: findError } = await supabase
        .from('meetings')
        .select('id')
        .eq('meeting_start', lead.meeting_start)
        .eq('owner_user_id', lead.owner_id)
        .limit(1);

      if (findError) throw findError;

      const meetingId = meetings?.[0]?.id;
      if (meetingId) {
        // Add agenda note to meeting
        const agendaNote = `\n\n--- Prep Note: ${noteTitle} ---\n${noteBody}`;
        const { error: updateError } = await supabase
          .from('meetings')
          .update({ 
            notes: (meetings[0] as any).notes 
              ? `${(meetings[0] as any).notes}${agendaNote}`
              : agendaNote
          })
          .eq('id', meetingId);

        if (updateError) throw updateError;
        toast.success('Added to meeting agenda');
      } else {
        toast.error('Meeting not found');
      }
    } catch (error) {
      console.error('Error adding to agenda:', error);
      toast.error('Failed to add to agenda');
    }
  };

  const handleCopyEmailOpener = (noteBody: string) => {
    // Extract key points for email opener
    const lines = noteBody.split('\n').filter(l => l.trim());
    const opener = `Hi ${lead.contact_name || lead.contact_email?.split('@')[0] || 'there'},

I'm looking forward to our meeting ${lead.meeting_start ? `on ${format(new Date(lead.meeting_start), 'MMMM d')}` : ''}. 

${lines.slice(0, 2).join('\n')}

Looking forward to connecting!

Best regards`;

    navigator.clipboard.writeText(opener);
    toast.success('Email opener copied to clipboard');
  };

  const handleRefreshSignals = async () => {
    setRefreshingSignals(true);
    try {
      // Trigger prep refresh for this lead
      await supabase
        .from('leads')
        .update({ prep_status: 'pending' })
        .eq('id', lead.id);
      
      await triggerLeadPrep();
      toast.success('Refreshing signals...');
      if (onRefresh) {
        setTimeout(onRefresh, 2000);
      }
    } catch (error) {
      console.error('Error refreshing signals:', error);
      toast.error('Failed to refresh signals');
    } finally {
      setRefreshingSignals(false);
    }
  };

  const handleRerunPrep = async () => {
    setIsRerunning(true);
    try {
      // Remove current enrichment for this lead, then rerun
      await resetLeadPrep(lead.id);
      const { processed } = await triggerLeadPrep();
      toast.success('Re-running prep analysis...');
      if (onRefresh) {
        setTimeout(onRefresh, processed > 0 ? 1500 : 3000);
      }
    } catch (error) {
      console.error('Error rerunning prep:', error);
      toast.error('Failed to rerun prep');
    } finally {
      setIsRerunning(false);
    }
  };

  const togglePlaybook = (playbookId: string) => {
    const newExpanded = new Set(expandedPlaybooks);
    if (newExpanded.has(playbookId)) {
      newExpanded.delete(playbookId);
    } else {
      newExpanded.add(playbookId);
    }
    setExpandedPlaybooks(newExpanded);
  };

  const getTruncatedBody = (body: string, mode: LengthMode): string => {
    if (mode === 'short') {
      return body.split('\n').slice(0, 2).join('\n') + (body.split('\n').length > 2 ? '...' : '');
    } else if (mode === 'standard') {
      return body.length > 500 ? body.substring(0, 500) + '...' : body;
    }
    return body;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (confidence >= 0.6) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-4 p-6">
        {/* Header with controls */}
        <header className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                {lead.contact_name || lead.contact_email || 'Unnamed Lead'}
                {lead.contact_name && (
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                    ({lead.contact_email})
                  </span>
                )}
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{lead.meeting_title || 'Discovery Call'}</p>
            </div>
            <div className="flex items-center gap-2">
              {lastUpdated && (
                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Updated {lastUpdated}
                </div>
              )}
              <button
                onClick={handleRerunPrep}
                disabled={isRerunning}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:hover:bg-indigo-500/30 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <RefreshCw className={`h-3 w-3 ${isRerunning ? 'animate-spin' : ''}`} />
                Re-run
              </button>
            </div>
          </div>

          {/* Length toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">View:</span>
            <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
              {(['short', 'standard', 'detailed'] as LengthMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setLengthMode(mode)}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    lengthMode === mode
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Pinned highlights */}
        {pinnedNotes.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <Pin className="h-3 w-3" />
              Pinned
            </h3>
            {pinnedNotes.map((note) => (
              <PrepNoteCard
                key={note.id}
                note={note}
                lengthMode={lengthMode}
                onCreateTask={handleCreateTask}
                onAddToAgenda={handleAddToAgenda}
                onCopyOpener={handleCopyEmailOpener}
                getConfidenceColor={getConfidenceColor}
              />
            ))}
          </section>
        )}

        {/* Info tiles */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoTile icon={User} label="Contact" value={lead.contact_email ?? 'N/A'} />
          <InfoTile icon={Timer} label="Meeting" value={meetingStart} />
          <InfoTile icon={Globe} label="Domain" value={lead.domain || 'Unknown'} />
          <InfoTile icon={Mail} label="Scheduler" value={lead.scheduler_email ?? 'N/A'} />
        </section>

        {/* Prep summary */}
        {lead.prep_summary && (
          <section className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-200">
              <ClipboardList className="h-4 w-4" />
              Prep Summary
            </h3>
            <p className="mt-2 text-sm text-emerald-900 dark:text-emerald-100/90 whitespace-pre-wrap">
              {lead.prep_summary}
            </p>
          </section>
        )}

        {/* Industry playbooks */}
        {playbookNotes.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <Sparkles className="h-3 w-3" />
              Industry Playbook
            </h3>
            {playbookNotes
              .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
              .map((note) => {
                const playbookId = (note.metadata as any)?.industry || note.id;
                const isExpanded = expandedPlaybooks.has(playbookId);
                const playbookGroup = playbookNotes.filter(
                  n => (n.metadata as any)?.industry === (note.metadata as any)?.industry
                );

                if (playbookGroup[0]?.id !== note.id) return null; // Only show first note of each playbook group

                return (
                  <div key={playbookId} className="rounded-xl border border-indigo-200 bg-indigo-50/60 dark:border-indigo-500/20 dark:bg-indigo-500/10">
                    <button
                      onClick={() => togglePlaybook(playbookId)}
                      className="w-full p-4 flex items-center justify-between hover:bg-indigo-100/50 dark:hover:bg-indigo-500/20 transition-colors rounded-xl"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
                          {(note.metadata as any)?.industry || 'Industry'} Playbook
                        </span>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3">
                        {playbookGroup.map((playbookNote) => (
                          <PrepNoteCard
                            key={playbookNote.id}
                            note={playbookNote}
                            lengthMode={lengthMode}
                            onCreateTask={handleCreateTask}
                            onAddToAgenda={handleAddToAgenda}
                            onCopyOpener={handleCopyEmailOpener}
                            getConfidenceColor={getConfidenceColor}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </section>
        )}

        {/* Other prep notes */}
        <section className="space-y-3">
          {otherNotes.length > 0 ? (
            otherNotes
              .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
              .map((note) => (
                <PrepNoteCard
                  key={note.id}
                  note={note}
                  lengthMode={lengthMode}
                  onCreateTask={handleCreateTask}
                  onAddToAgenda={handleAddToAgenda}
                  onCopyOpener={handleCopyEmailOpener}
                  getConfidenceColor={getConfidenceColor}
                  onRefreshSignals={note.metadata && typeof note.metadata === 'object' && (note.metadata as any).type === 'live_signals' ? handleRefreshSignals : undefined}
                  refreshingSignals={refreshingSignals}
                />
              ))
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              No prep notes yet. Trigger the prep workflow to generate insights.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

interface PrepNoteCardProps {
  note: any;
  lengthMode: LengthMode;
  onCreateTask: (title: string, body: string) => void;
  onAddToAgenda: (title: string, body: string) => void;
  onCopyOpener: (body: string) => void;
  getConfidenceColor: (confidence: number) => string;
  onRefreshSignals?: () => void;
  refreshingSignals?: boolean;
}

function PrepNoteCard({
  note,
  lengthMode,
  onCreateTask,
  onAddToAgenda,
  onCopyOpener,
  getConfidenceColor,
  onRefreshSignals,
  refreshingSignals,
}: PrepNoteCardProps) {
  const metadata = note.metadata && typeof note.metadata === 'object' ? note.metadata as any : null;
  const confidence = metadata?.confidence ?? null;
  const sources = metadata?.sources || [];
  const isLiveSignals = metadata?.type === 'live_signals';
  const fetchedAt = metadata?.fetched_at;

  const truncatedBody = getTruncatedBody(note.body, lengthMode);

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-gray-800/60 dark:bg-gray-900/40">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-sm font-semibold capitalize text-gray-900 dark:text-gray-100">
              {note.title || note.note_type}
            </p>
            {note.is_auto_generated && (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-200">
                Auto
              </span>
            )}
            {confidence !== null && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${getConfidenceColor(confidence)}`}>
                {Math.round(confidence * 100)}%
              </span>
            )}
            {isLiveSignals && fetchedAt && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {format(new Date(fetchedAt), 'MMM d, h:mm a')}
              </span>
            )}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300 break-words">
            {truncatedBody}
          </p>

          {/* Evidence chips */}
          {sources.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {sources.map((source: string, idx: number) => (
                <a
                  key={idx}
                  href={source.startsWith('http') ? source : `https://${source}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20 transition-colors"
                >
                  <Globe className="h-2.5 w-2.5" />
                  {source.replace(/^https?:\/\//, '').substring(0, 30)}
                </a>
              ))}
            </div>
          )}

          {/* One-click actions */}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => onCreateTask(note.title || note.note_type, note.body)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
            >
              <CheckSquare className="h-3 w-3" />
              Create Task
            </button>
            <button
              onClick={() => onAddToAgenda(note.title || note.note_type, note.body)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
            >
              <Calendar className="h-3 w-3" />
              Add to Agenda
            </button>
            <button
              onClick={() => onCopyOpener(note.body)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
            >
              <Copy className="h-3 w-3" />
              Copy Opener
            </button>
            {isLiveSignals && onRefreshSignals && (
              <button
                onClick={onRefreshSignals}
                disabled={refreshingSignals}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:hover:bg-indigo-500/30 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${refreshingSignals ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

interface InfoTileProps {
  label: string;
  value: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

function InfoTile({ label, value, icon: Icon }: InfoTileProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800/60 dark:bg-gray-900/40">
      <Icon className="h-5 w-5 text-emerald-500" />
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 break-words">{value}</p>
      </div>
    </div>
  );
}
