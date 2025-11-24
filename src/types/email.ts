export interface EmailAttachment {
  // Core identification
  id: string;                    // Gmail attachment ID for fetching
  filename: string;              // Display name
  mimeType: string;             // Content type (e.g., 'image/png', 'application/pdf')

  // Size and metadata
  size: number;                 // Size in bytes
  sizeFormatted?: string;       // Human-readable size (e.g., '2.5 MB')

  // Download/preview
  data?: string;                // Base64 encoded data (when downloaded)
  downloadUrl?: string;         // Temporary download URL
  isInline?: boolean;          // True if attachment is inline (like embedded images)

  // Preview capabilities
  canPreview?: boolean;        // True if file type supports preview
  previewUrl?: string;         // URL for preview (for images, PDFs, etc.)
  thumbnailUrl?: string;       // Smaller thumbnail for grid view

  // Gmail-specific
  partId?: string;             // Gmail message part ID
  headers?: Record<string, string>; // Additional headers
}

export interface EmailThread {
  id: string;
  from: string;
  fromName: string;
  content: string;
  bodyHtml?: string;           // HTML content for rich display
  timestamp: Date;
  attachments?: EmailAttachment[]; // Changed from string[] to EmailAttachment[]
}

export interface Email {
  id: string;
  from: string;
  fromName: string;
  subject: string;
  preview: string;
  timestamp: Date;
  read: boolean;
  starred: boolean;
  important: boolean;
  labels: string[];
  attachments: number;          // Count for list view
  attachmentDetails?: EmailAttachment[]; // Full attachment data
  thread: EmailThread[];

  // Full email data (when viewing thread)
  body?: string;
  bodyHtml?: string;
  to?: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
}

export interface EmailFolder {
  id: string;
  label: string;
  icon: any;
  count: number;
}

export interface EmailFilter {
  id: 'all' | 'unread' | 'read';
  label: string;
  icon: any;
}

export interface KeyboardShortcut {
  key: string;
  icon: any;
  description: string;
  color: string;
}

export interface KeyboardShortcutCategory {
  category: string;
  actions: KeyboardShortcut[];
}