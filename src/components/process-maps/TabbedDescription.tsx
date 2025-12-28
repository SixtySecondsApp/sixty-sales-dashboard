import React, { useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TabbedDescriptionProps {
  /** Short description shown in Overview tab */
  short: string | null;
  /** Long description with markdown formatting for Technical Details tab */
  long: string | null;
  /** Additional CSS classes */
  className?: string;
  /** Which tab to show by default */
  defaultTab?: 'overview' | 'details';
}

export interface ParsedSection {
  header: string;
  items: string[];
  type: 'bullets' | 'features';
}

/**
 * Parse markdown content into structured sections
 */
export function parseStructuredContent(markdown: string): ParsedSection[] {
  if (!markdown) return [];

  const sections: ParsedSection[] = [];
  const lines = markdown.split('\n');
  let currentSection: ParsedSection | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check for section header (bold text followed by colon)
    const headerMatch = trimmed.match(/^\*\*([^*]+)\*\*:?$/);
    if (headerMatch) {
      if (currentSection && currentSection.items.length > 0) {
        sections.push(currentSection);
      }
      currentSection = {
        header: headerMatch[1].trim(),
        items: [],
        type: headerMatch[1].toLowerCase().includes('features') ? 'features' : 'bullets',
      };
      continue;
    }

    // Check for bullet point
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (bulletMatch && currentSection) {
      currentSection.items.push(bulletMatch[1]);
      continue;
    }

    // If no current section and we have content, create a default section
    if (!currentSection && trimmed) {
      currentSection = {
        header: '',
        items: [trimmed],
        type: 'bullets',
      };
    } else if (currentSection && trimmed) {
      // Add non-bullet content as a bullet item
      currentSection.items.push(trimmed);
    }
  }

  // Don't forget the last section
  if (currentSection && currentSection.items.length > 0) {
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Format inline markdown (bold, italic, code) in text
 */
export function formatInlineMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Check for inline code first (highest priority)
    const codeMatch = remaining.match(/^(.*?)`([^`]+)`(.*)$/);
    if (codeMatch) {
      if (codeMatch[1]) {
        parts.push(...formatInlineMarkdown(codeMatch[1]));
      }
      parts.push(
        <code
          key={`code-${key++}`}
          className="px-1.5 py-0.5 rounded bg-muted border border-border text-xs font-mono text-emerald-600 dark:text-emerald-400"
        >
          {codeMatch[2]}
        </code>
      );
      remaining = codeMatch[3];
      continue;
    }

    // Check for bold
    const boldMatch = remaining.match(/^(.*?)\*\*([^*]+)\*\*(.*)$/);
    if (boldMatch) {
      if (boldMatch[1]) {
        parts.push(<span key={`text-${key++}`}>{boldMatch[1]}</span>);
      }
      parts.push(<strong key={`bold-${key++}`}>{boldMatch[2]}</strong>);
      remaining = boldMatch[3];
      continue;
    }

    // No more special formatting, add the rest as plain text
    parts.push(<span key={`text-${key++}`}>{remaining}</span>);
    break;
  }

  return parts;
}

/**
 * Render a single section with proper formatting
 */
export function StructuredSection({ section }: { section: ParsedSection }) {
  if (section.type === 'features' && section.items.length >= 2) {
    // Render as feature cards
    return (
      <div className="space-y-3">
        {section.header && (
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {section.header}
          </h4>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {section.items.map((item, idx) => {
            // Try to split into title and description
            const colonIdx = item.indexOf(':');
            const hasTitle = colonIdx > 0 && colonIdx < 40;
            const title = hasTitle ? item.substring(0, colonIdx).trim() : null;
            const desc = hasTitle ? item.substring(colonIdx + 1).trim() : item;

            return (
              <div
                key={idx}
                className="p-2.5 rounded-md border bg-card hover:bg-accent/50 transition-colors"
              >
                {title && (
                  <div className="text-xs font-medium text-foreground mb-1">
                    {formatInlineMarkdown(title)}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  {formatInlineMarkdown(desc)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Render as bullet list
  return (
    <div className="space-y-2">
      {section.header && (
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {section.header}
        </h4>
      )}
      <ul className="space-y-1.5 ml-4">
        {section.items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className="text-emerald-500 mt-0.5 flex-shrink-0">•</span>
            <span>{formatInlineMarkdown(item)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Tabbed description component for process maps.
 * Shows Overview and Technical Details tabs with structured formatting.
 */
export function TabbedDescription({
  short,
  long,
  className,
  defaultTab = 'overview',
}: TabbedDescriptionProps) {
  const hasLong = long && long.trim().length > 0;

  const sections = useMemo(() => {
    if (!long) return [];
    return parseStructuredContent(long);
  }, [long]);

  if (!short && !long) return null;

  // If no long description, just show the short description without tabs
  if (!hasLong) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        {short || 'Process visualization diagram'}
      </p>
    );
  }

  return (
    <Tabs defaultValue={defaultTab} className={cn('w-full', className)}>
      <TabsList className="grid w-full grid-cols-2 h-9">
        <TabsTrigger value="overview" className="text-xs">
          Overview
        </TabsTrigger>
        <TabsTrigger value="details" className="text-xs gap-1.5">
          Technical Details
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
            {sections.length}
          </Badge>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-3">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {short || 'Process visualization diagram'}
        </p>
      </TabsContent>

      <TabsContent value="details" className="mt-3">
        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          {sections.length > 0 ? (
            sections.map((section, idx) => (
              <StructuredSection key={idx} section={section} />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              {formatInlineMarkdown(long)}
            </p>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
