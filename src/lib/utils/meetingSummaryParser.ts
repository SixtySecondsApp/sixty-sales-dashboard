/**
 * Utility functions for parsing and formatting meeting summaries
 * Handles both JSON format (from Fathom) and plain text summaries
 */

export interface ParsedMeetingSummary {
  isJson: boolean;
  markdown?: string;
  plainText?: string;
  templateName?: string;
}

/**
 * Parse meeting summary - handles both JSON and plain text formats
 */
export function parseMeetingSummary(summary: string | null | undefined): ParsedMeetingSummary {
  if (!summary) {
    return { isJson: false, plainText: null };
  }

  try {
    // Try to parse as JSON first (Fathom format)
    const parsed = JSON.parse(summary);
    if (parsed.markdown_formatted) {
      return {
        isJson: true,
        markdown: parsed.markdown_formatted,
        templateName: parsed.template_name,
        plainText: summary // Keep original for fallback
      };
    }
    // JSON but no markdown_formatted - return as plain text
    return { isJson: true, plainText: summary };
  } catch {
    // Not JSON, return as plain text
    return { isJson: false, plainText: summary };
  }
}

/**
 * Enhanced markdown parser for Fathom summaries with beautiful styling
 * Converts markdown to HTML with proper styling for dark theme
 */
export function parseMarkdownSummary(markdown: string): string {
  return markdown
    // Main headers (# Header) - Large, prominent
    .replace(/^# (.*?)$/gm, '<h1 class="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4 pb-2 border-b border-gray-200 dark:border-white/10">$1</h1>')
    // Section headers (## Header) - Medium, spaced
    .replace(/^## (.*?)$/gm, '<h2 class="text-xl font-semibold text-gray-900 dark:text-white mt-6 mb-3">$1</h2>')
    // Sub-headers (### Header) - Smaller, colored accent
    .replace(/^### (.*?)$/gm, '<h3 class="text-base font-semibold text-blue-600 dark:text-blue-400 mt-4 mb-2">$1</h3>')
    // Bold text - White and prominent
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900 dark:text-white">$1</strong>')
    // Timestamp links - Styled as clickable badges with play icon and consistent spacing
    .replace(/\[(.*?)\]\((https:\/\/fathom\.video\/share\/[^)]+timestamp=([0-9.]+)[^)]*)\)/g,
      '<span class="timestamp-link inline-block align-top px-2 py-1 mb-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer transition-all text-xs font-medium max-w-[90%]" data-timestamp="$3" data-href="$2">' +
      '<svg class="w-3 h-3 inline-block mr-1.5 -mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>' +
      '$1' +
      '</span>')
    // Regular links - Subtle blue
    .replace(/\[(.*?)\]\((https:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors">$1</a>')
    // Bullet points - Hidden bullet, consistent spacing with line-height fix
    .replace(/^ - (.*?)$/gm, '<div class="mb-1 text-gray-700 dark:text-gray-300 leading-relaxed min-h-[28px] flex items-start">$1</div>')
    // Numbered lists - Hidden numbers, consistent spacing with line-height fix
    .replace(/^\d+\. (.*?)$/gm, '<div class="mb-1 text-gray-700 dark:text-gray-300 leading-relaxed min-h-[28px] flex items-start">$1</div>')
    // Paragraph breaks - Better spacing
    .replace(/\n\n/g, '<div class="mb-4"></div>')
    // Single line breaks - Smaller spacing
    .replace(/\n/g, '<br />');
}

/**
 * Format meeting summary for display
 * Returns either HTML (if markdown) or plain text
 */
export function formatMeetingSummaryForDisplay(
  summary: string | null | undefined,
  options: {
    maxLength?: number;
    showPlainText?: boolean;
  } = {}
): { content: string; isHtml: boolean } {
  const parsed = parseMeetingSummary(summary);
  
  if (!parsed.plainText && !parsed.markdown) {
    return { content: '', isHtml: false };
  }

  // If we have markdown, parse it to HTML
  if (parsed.markdown) {
    let html = parseMarkdownSummary(parsed.markdown);
    
    // Apply max length if specified
    if (options.maxLength && html.length > options.maxLength) {
      // Truncate HTML safely (basic implementation)
      html = html.substring(0, options.maxLength) + '...';
    }
    
    return { content: html, isHtml: true };
  }

  // Plain text fallback
  let text = parsed.plainText || '';
  
  if (options.maxLength && text.length > options.maxLength) {
    text = text.substring(0, options.maxLength) + '...';
  }
  
  return { content: text, isHtml: false };
}

/**
 * Get plain text version of meeting summary (for previews, search, etc.)
 */
export function getMeetingSummaryPlainText(summary: string | null | undefined): string {
  const parsed = parseMeetingSummary(summary);
  
  if (parsed.markdown) {
    // Strip markdown formatting for plain text
    return parsed.markdown
      .replace(/^#+\s+/gm, '') // Remove headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/\[(.*?)\]\([^)]+\)/g, '$1') // Remove links, keep text
      .replace(/^[-•]\s+/gm, '') // Remove bullet points
      .replace(/\n\n+/g, '\n') // Normalize line breaks
      .trim();
  }
  
  return parsed.plainText || '';
}







