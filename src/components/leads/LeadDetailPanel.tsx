import { type ReactNode, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { LeadWithPrep } from '@/lib/services/leadService';
import { ClipboardList, Globe, Mail, Timer, User, Building2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

type LeadPrepNoteRecord = LeadWithPrep['lead_prep_notes'][number];

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
      <div className="space-y-4 p-4 sm:p-6">
        <header className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 break-words">
              {lead.contact_name || lead.contact_email || 'Unnamed Lead'}
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">{lead.meeting_title || 'Discovery Call'}</p>
          </div>
          
          {/* Record Links */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {lead.contact_id && (
              <Link
                to={`/crm/contacts/${lead.contact_id}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-emerald-300 dark:hover:border-emerald-600 transition-colors"
                title="View Contact Record"
              >
                <User className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Contact</span>
                <ExternalLink className="h-3 w-3 opacity-60" />
              </Link>
            )}
            {lead.company_id && (
              <Link
                to={`/companies/${lead.company_id}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-emerald-300 dark:hover:border-emerald-600 transition-colors"
                title="View Company Record"
              >
                <Building2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Company</span>
                <ExternalLink className="h-3 w-3 opacity-60" />
              </Link>
            )}
          </div>
        </header>

        <section className="grid grid-cols-1 gap-2 sm:gap-3 sm:grid-cols-2">
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
              .map((note) => <LeadNoteCard key={note.id} note={note} />)
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
    <div className="flex items-center gap-2 sm:gap-3 rounded-lg sm:rounded-xl border border-gray-200 bg-white px-3 py-2.5 sm:px-4 sm:py-3 shadow-sm dark:border-gray-800/60 dark:bg-gray-900/40">
      <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] sm:text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{value}</p>
      </div>
    </div>
  );
}

interface LeadNoteCardProps {
  note: LeadPrepNoteRecord;
}

function LeadNoteCard({ note }: LeadNoteCardProps) {
  const { badgeClass, label } = getNoteTypeMeta(note.note_type);
  const bodyContent = note.body ?? '';

  return (
    <article className="group rounded-2xl border border-gray-200/80 bg-white/95 px-4 py-5 shadow-sm ring-1 ring-transparent transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg dark:border-gray-800/70 dark:bg-gray-900/60 dark:hover:border-emerald-400/40">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${badgeClass}`}>
            {label}
          </span>
          <p className="text-base font-semibold text-gray-900 dark:text-gray-100 break-words">
            {note.title || label}
          </p>
        </div>
        {note.is_auto_generated && (
          <span className="inline-flex h-6 items-center rounded-full border border-indigo-100 bg-indigo-50 px-2 text-[10px] font-semibold uppercase tracking-wide text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200">
            Auto
          </span>
        )}
      </div>

      <LeadNoteBody body={bodyContent} />
    </article>
  );
}

interface LeadNoteBodyProps {
  body: string;
}

function LeadNoteBody({ body }: LeadNoteBodyProps) {
  const blocks = useMemo(() => parseLeadNoteBody(body), [body]);

  if (!blocks.length) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3">
      {blocks.map((block, index) => {
        if (block.type === 'paragraph') {
          return (
            <p
              key={`paragraph-${index}`}
              className="text-sm leading-relaxed text-gray-600 dark:text-gray-300"
            >
              {renderInlineSegments(block.content, `paragraph-${index}`)}
            </p>
          );
        }

        if (block.type === 'list') {
          return (
            <ul
              key={`list-${index}`}
              className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-gray-600 dark:text-gray-300"
            >
              {block.items.map((item, itemIndex) => (
                <li key={`list-${index}-${itemIndex}`}>
                  {renderInlineSegments(item, `list-${index}-${itemIndex}`)}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <pre
            key={`code-${index}`}
            className="overflow-x-auto rounded-xl bg-slate-900/90 px-4 py-3 text-[13px] leading-relaxed text-slate-100 shadow-inner dark:bg-slate-900/70"
          >
            <code>{block.content}</code>
          </pre>
        );
      })}
    </div>
  );
}

type LeadNoteBlock =
  | { type: 'paragraph'; content: string }
  | { type: 'list'; items: string[] }
  | { type: 'code'; content: string; language?: string };

function parseLeadNoteBody(body: string): LeadNoteBlock[] {
  if (!body) {
    return [];
  }

  const normalized = body.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return [];
  }

  const blocks: LeadNoteBlock[] = [];
  const lines = normalized.split('\n');
  let paragraphBuffer: string[] = [];
  let listBuffer: string[] = [];
  let collectingList = false;
  let codeBuffer: string[] | null = null;
  let codeLanguage: string | undefined;

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    const content = paragraphBuffer.join(' ').replace(/\s+/g, ' ').trim();
    if (content) {
      blocks.push({ type: 'paragraph', content });
    }
    paragraphBuffer = [];
  };

  const flushList = () => {
    if (!collectingList || !listBuffer.length) return;
    blocks.push({ type: 'list', items: [...listBuffer] });
    listBuffer = [];
    collectingList = false;
  };

  const flushCode = () => {
    if (!codeBuffer) return;
    const content = codeBuffer.join('\n').trimEnd();
    if (content) {
      blocks.push({ type: 'code', content, language: codeLanguage });
    }
    codeBuffer = null;
    codeLanguage = undefined;
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '');
    const trimmed = line.trim();

    if (codeBuffer) {
      if (trimmed.startsWith('```')) {
        flushCode();
        continue;
      }
      codeBuffer.push(rawLine);
      continue;
    }

    if (trimmed.startsWith('```')) {
      flushParagraph();
      flushList();
      codeLanguage = trimmed.slice(3).trim() || undefined;
      codeBuffer = [];
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    if (/^[-•]\s+/.test(trimmed)) {
      flushParagraph();
      collectingList = true;
      const item = trimmed.replace(/^[-•]\s+/, '').trim();
      if (item) {
        listBuffer.push(item);
      }
      continue;
    }

    flushList();
    paragraphBuffer.push(trimmed);
  }

  if (codeBuffer) {
    flushCode();
  } else {
    flushParagraph();
    flushList();
  }

  return blocks;
}

function renderInlineSegments(text: string, keyPrefix: string): ReactNode[] {
  if (!text) {
    return [];
  }

  const segments: ReactNode[] = [];
  const boldRegex = /\*\*(.+?)\*\*/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  let boldIndex = 0;

  const pushPlain = (plain: string, suffix: string) => {
    if (!plain) return;
    segments.push(...renderLinkSegments(plain, `${keyPrefix}-plain-${suffix}`));
  };

  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > cursor) {
      pushPlain(text.slice(cursor, match.index), `${cursor}-${boldIndex}`);
    }

    const content = match[1];
    segments.push(
      <strong key={`${keyPrefix}-bold-${boldIndex}`} className="text-gray-900 dark:text-gray-100">
        {renderLinkSegments(content, `${keyPrefix}-bold-${boldIndex}-link`)}
      </strong>
    );

    cursor = match.index + match[0].length;
    boldIndex += 1;
  }

  if (cursor < text.length) {
    pushPlain(text.slice(cursor), `${cursor}-tail`);
  }

  return segments.length ? segments : [text];
}

function renderLinkSegments(text: string, keyPrefix: string): ReactNode[] {
  if (!text) {
    return [];
  }

  const nodes: ReactNode[] = [];
  const linkRegex = /(https?:\/\/[^\s)]+|www\.[^\s)]+)/gi;
  let cursor = 0;
  let match: RegExpExecArray | null;
  let linkIndex = 0;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }

    const url = match[0];
    const href = url.startsWith('http') ? url : `https://${url}`;
    nodes.push(
      <a
        key={`${keyPrefix}-link-${linkIndex}`}
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-emerald-600 underline-offset-2 hover:underline dark:text-emerald-300"
      >
        {url}
      </a>
    );

    cursor = match.index + url.length;
    linkIndex += 1;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes.length ? nodes : [text];
}

const NOTE_TYPE_META: Record<
  string,
  { label: string; badgeClass: string }
> = {
  insight: {
    label: 'Insight',
    badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200',
  },
  summary: {
    label: 'Summary',
    badgeClass: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-200',
  },
  question: {
    label: 'Question',
    badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200',
  },
  task: {
    label: 'Action Item',
    badgeClass: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200',
  },
  resource: {
    label: 'Resource',
    badgeClass: 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-200',
  },
};

function getNoteTypeMeta(noteType?: string | null) {
  if (!noteType) {
    return {
      label: 'Note',
      badgeClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-200',
    };
  }

  if (NOTE_TYPE_META[noteType]) {
    return NOTE_TYPE_META[noteType];
  }

  const formatted = noteType
    .split(/[_-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return {
    label: formatted,
    badgeClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-200',
  };
}

