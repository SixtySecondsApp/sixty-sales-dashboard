import type { LeadWithPrep } from '@/lib/services/leadService';
import { ClipboardList, Globe, Mail, Timer, User, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import { Link } from 'react-router-dom';

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

  const meetingStart = lead.meeting_start ? format(new Date(lead.meeting_start), 'PPp') : 'TBD';

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-4 p-6">
        <header className="relative">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {lead.contact_name || lead.contact_email || 'Unnamed Lead'}
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{lead.meeting_title || 'Discovery Call'}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {lead.contact_id && (
                <Link
                  to={`/crm/contacts/${lead.contact_id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                  title="View Contact Record"
                >
                  <User className="h-3.5 w-3.5" />
                  <span>Contact</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
              {lead.company_id && (
                <Link
                  to={`/companies/${lead.company_id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                  title="View Company Record"
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span>Company</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
          </div>
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
                <PrepNoteCard key={note.id} note={note} />
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

interface PrepNoteCardProps {
  note: {
    id: string;
    title: string | null;
    note_type: string | null;
    body: string;
    is_auto_generated: boolean | null;
  };
}

const MAX_PREVIEW_LENGTH = 300;
const MAX_FULL_LENGTH = 800;

function PrepNoteCard({ note }: PrepNoteCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Clean up text - remove HTML tags, normalize whitespace, but preserve intentional markdown
  const cleanText = (text: string): string => {
    return text
      .replace(/<[^>]*>/g, '') // Remove any HTML tags
      .replace(/\n{3,}/g, '\n\n') // Max 2 newlines
      .trim();
  };
  
  // Helper to remove orphaned asterisks that aren't part of proper markdown
  const removeOrphanedAsterisks = (text: string): string => {
    // Don't modify text that has proper **text** pairs - those will be handled by renderBoldContent
    // Only clean up clearly orphaned patterns
    return text
      .replace(/\*\*\s+/g, '') // Remove ** followed by space (orphaned start)
      .replace(/\s+\*\*/g, '') // Remove ** preceded by space (orphaned end)
      .replace(/\*\s+/g, '') // Remove single * followed by space
      .replace(/\s+\*/g, ''); // Remove single * preceded by space
  };

  const cleanedBody = cleanText(note.body);
  // Note: We don't remove asterisks here - let renderFormattedText handle markdown rendering
  const shouldTruncate = cleanedBody.length > MAX_PREVIEW_LENGTH;
  
  // Truncate at word boundary to avoid cutting off markdown or mid-word
  const truncateAtWordBoundary = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    
    // Find the best cut point (prefer sentence endings, then word boundaries)
    const truncated = text.slice(0, maxLength);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastComma = truncated.lastIndexOf(',');
    const lastNewline = truncated.lastIndexOf('\n');
    const lastSpace = truncated.lastIndexOf(' ');
    
    // Prefer sentence endings, then word boundaries
    const cutPoints = [lastPeriod, lastComma, lastNewline, lastSpace].filter(p => p > 0);
    const bestCutPoint = cutPoints.length > 0 ? Math.max(...cutPoints) : maxLength;
    
    // Only use the cut point if it's not too close to the start (at least 80% of maxLength)
    // This ensures we don't cut off too much content
    const finalCut = bestCutPoint > maxLength * 0.8 ? bestCutPoint : maxLength;
    
    // Add 1 to include the punctuation if we cut at a period or comma
    const includePunctuation = (lastPeriod > 0 && finalCut === lastPeriod) || 
                               (lastComma > 0 && finalCut === lastComma);
    const cutLength = includePunctuation ? finalCut + 1 : finalCut;
    
    return text.slice(0, cutLength).trim() + '...';
  };
  
  const displayText = isExpanded || !shouldTruncate 
    ? cleanedBody 
    : truncateAtWordBoundary(cleanedBody, MAX_PREVIEW_LENGTH);

  // Parse and render formatted text
  const renderFormattedText = (text: string) => {
    if (!text) return null;
    
    const parts: (string | JSX.Element)[] = [];
    let currentIndex = 0;
    
    // Split by lines first to handle bullet points, filter empty lines
    const lines = text.split('\n').filter(line => line.trim());
    
    lines.forEach((line, lineIndex) => {
      const trimmedLine = line.trim();
      
      // Check if it's a bullet point (starts with bullet marker or dash/asterisk)
      const bulletMatch = trimmedLine.match(/^[•\-\*]\s*(.+)$/);
      if (bulletMatch) {
        const content = bulletMatch[1].trim();
        parts.push(
          <div key={`bullet-${currentIndex++}`} className="flex items-start gap-2">
            <span className="text-emerald-500 mt-0.5 flex-shrink-0">•</span>
            <span className="flex-1">{renderInlineFormatting(content, currentIndex)}</span>
          </div>
        );
        return;
      }
      
      // Check if it's a section header (starts and ends with **)
      if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
        const headerContent = trimmedLine.slice(2, -2);
        parts.push(
          <div key={`header-${currentIndex++}`} className="font-semibold text-gray-900 dark:text-gray-100 mt-2 first:mt-0">
            {headerContent}
          </div>
        );
        return;
      }
      
      // Regular line with formatting
      const formatted = renderInlineFormatting(trimmedLine, currentIndex);
      if (formatted) {
        parts.push(
          <div key={`line-${currentIndex++}`}>
            {formatted}
          </div>
        );
      }
      currentIndex += 100; // Increment for next line
    });
    
    return parts.length > 0 ? parts : [text];
  };

  // Helper to render inline formatting - preserve section headers and key info (names, titles)
  const renderInlineFormatting = (text: string, baseIndex: number) => {
    if (!text) return null;
    
    // Handle section headers with double asterisks (like **Role:**, **Background:**)
    const doubleAsteriskHeaderRegex = /^\*\*([^:]+):\*\*\s*(.+)$/;
    const doubleHeaderMatch = text.match(doubleAsteriskHeaderRegex);
    
    if (doubleHeaderMatch) {
      // This is a section header format - keep it bold
      return (
        <>
          <strong className="font-semibold text-gray-900 dark:text-gray-100">{doubleHeaderMatch[1]}:</strong>
          {' '}
          {renderBoldContent(doubleHeaderMatch[2], baseIndex)}
        </>
      );
    }
    
    // Handle section headers with single asterisk at start (like *Role:, *Background:**)
    // This handles cases where backend might generate inconsistent markdown
    const singleAsteriskHeaderRegex = /^\*([^:*]+):\*?\*?\s*(.+)$/;
    const singleHeaderMatch = text.match(singleAsteriskHeaderRegex);
    
    if (singleHeaderMatch) {
      // This is a section header format with single asterisk - keep it bold
      return (
        <>
          <strong className="font-semibold text-gray-900 dark:text-gray-100">{singleHeaderMatch[1]}:</strong>
          {' '}
          {renderBoldContent(singleHeaderMatch[2], baseIndex)}
        </>
      );
    }
    
    // Also handle patterns like "*Role:" at the start (without matching content after colon)
    const singleAsteriskStartRegex = /^\*([^:*]+):\s*(.*)$/;
    const singleStartMatch = text.match(singleAsteriskStartRegex);
    if (singleStartMatch && !doubleHeaderMatch) {
      return (
        <>
          <strong className="font-semibold text-gray-900 dark:text-gray-100">{singleStartMatch[1]}:</strong>
          {singleStartMatch[2] && (
            <>
              {' '}
              {renderBoldContent(singleStartMatch[2], baseIndex)}
            </>
          )}
        </>
      );
    }
    
    // For regular text, process bold markers for key information
    return renderBoldContent(text, baseIndex);
  };

  // Helper to render bold content - preserve intentional bold for names, titles, key terms
  const renderBoldContent = (text: string, baseIndex: number) => {
    if (!text) return null;
    
    // If no bold markers at all, return text as-is
    if (!text.includes('*')) {
      return text;
    }
    
    const parts: (string | JSX.Element)[] = [];
    let currentIndex = baseIndex;
    let lastIndex = 0;
    
    // Find all properly paired bold (**text**) markers first (double asterisks)
    const doubleBoldRegex = /\*\*([^*]+?)\*\*/g;
    const doubleMatches: Array<{ index: number; length: number; content: string }> = [];
    
    doubleBoldRegex.lastIndex = 0;
    let match;
    while ((match = doubleBoldRegex.exec(text)) !== null) {
      doubleMatches.push({
        index: match.index,
        length: match[0].length,
        content: match[1],
      });
    }
    
    // Process double asterisk matches
    for (const boldMatch of doubleMatches) {
      // Add text before this match
      if (boldMatch.index > lastIndex) {
        const beforeText = text.slice(lastIndex, boldMatch.index);
        if (beforeText) {
          parts.push(beforeText);
        }
      }
      
      // Add the bold content
      parts.push(
        <strong key={`bold-${currentIndex++}`} className="font-semibold text-gray-900 dark:text-gray-100">
          {boldMatch.content}
        </strong>
      );
      
      lastIndex = boldMatch.index + boldMatch.length;
    }
    
    // Add remaining text (after all double asterisk matches)
    if (lastIndex < text.length) {
      const remainingText = text.slice(lastIndex);
      if (remainingText) {
        // Remove any orphaned ** at the end
        const cleanedRemaining = remainingText.replace(/\*\*$/, '').replace(/\*$/, '');
        if (cleanedRemaining) {
          parts.push(cleanedRemaining);
        }
      }
    }
    
    // Return parts if we found matches, otherwise return original text (with asterisks removed if they're just markers)
    if (parts.length > 0) {
      return <>{parts}</>;
    }
    
    // If no double asterisk matches but text has asterisks, clean them up
    // This handles cases where asterisks are used incorrectly or inconsistently
    // Remove all asterisks that aren't part of proper markdown pairs
    let cleaned = text;
    
    // Remove orphaned single asterisks at word boundaries (like "*Role:" becomes "Role:")
    cleaned = cleaned.replace(/\*\b/g, '').replace(/\b\*/g, '');
    
    // Remove any remaining double asterisks that weren't matched (orphaned)
    cleaned = cleaned.replace(/\*\*/g, '');
    
    // Remove any remaining single asterisks
    cleaned = cleaned.replace(/\*/g, '');
    
    return cleaned !== text ? cleaned : text;
  };

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-gray-800/60 dark:bg-gray-900/40">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 overflow-hidden">
          <p className="text-sm font-semibold capitalize text-gray-900 dark:text-gray-100 mb-2">
            {note.title || note.note_type}
          </p>
          <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-1 break-words overflow-wrap-anywhere">
            {renderFormattedText(displayText)}
          </div>
          {shouldTruncate && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Show More
                </>
              )}
            </button>
          )}
        </div>
        {note.is_auto_generated && (
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-200 flex-shrink-0">
            Auto
          </span>
        )}
      </div>
    </article>
  );
}



