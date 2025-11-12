import type { LeadWithPrep } from '@/lib/services/leadService';
import { ClipboardList, Globe, Mail, Timer, User } from 'lucide-react';
import { format } from 'date-fns';

interface LeadDetailPanelProps {
  lead: LeadWithPrep | null;
}

export function LeadDetailPanel({ lead }: LeadDetailPanelProps) {
  if (!lead) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        Select a lead to see prep guidance.
      </div>
    );
  }

  const meetingStart = lead.meeting_start ? format(new Date(lead.meeting_start), 'PPpp') : 'TBD';

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-4 p-6">
        <header>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {lead.contact_name || lead.contact_email || 'Unnamed Lead'}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{lead.meeting_title || 'Discovery Call'}</p>
        </header>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoTile icon={User} label="Contact" value={lead.contact_email ?? 'N/A'} />
          <InfoTile icon={Timer} label="Meeting" value={meetingStart} />
          <InfoTile icon={Globe} label="Domain" value={lead.domain || 'Unknown'} />
          <InfoTile icon={Mail} label="Scheduler" value={lead.scheduler_email ?? 'N/A'} />
        </section>

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

        <section className="space-y-3">
          {lead.lead_prep_notes?.length ? (
            lead.lead_prep_notes
              .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
              .map((note) => (
                <article
                  key={note.id}
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-gray-800/60 dark:bg-gray-900/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold capitalize text-gray-900 dark:text-gray-100">
                        {note.title || note.note_type}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">
                        {note.body}
                      </p>
                    </div>
                    {note.is_auto_generated && (
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-200">
                        Auto
                      </span>
                    )}
                  </div>
                </article>
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
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{value}</p>
      </div>
    </div>
  );
}

