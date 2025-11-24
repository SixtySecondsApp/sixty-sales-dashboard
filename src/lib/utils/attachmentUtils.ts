import type { EmailAttachment } from '@/types/email';

/**
 * Format file size from bytes to human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Determine if a file type supports preview
 */
export function canPreviewFile(mimeType: string): boolean {
  const previewableMimeTypes = [
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',

    // PDFs
    'application/pdf',

    // Text files
    'text/plain',
    'text/html',
    'text/markdown',
    'text/csv',

    // Code files
    'application/json',
    'application/xml',
    'text/xml',
    'application/javascript',
    'text/javascript',
  ];

  return previewableMimeTypes.includes(mimeType.toLowerCase());
}

/**
 * Get icon name for file type
 */
export function getFileIcon(mimeType: string): string {
  const type = mimeType.toLowerCase();

  if (type.startsWith('image/')) return 'image';
  if (type.includes('pdf')) return 'file-text';
  if (type.includes('word') || type.includes('document')) return 'file-text';
  if (type.includes('excel') || type.includes('spreadsheet')) return 'table';
  if (type.includes('powerpoint') || type.includes('presentation')) return 'presentation';
  if (type.includes('zip') || type.includes('rar') || type.includes('compressed')) return 'archive';
  if (type.includes('audio')) return 'music';
  if (type.includes('video')) return 'video';
  if (type.startsWith('text/')) return 'file-code';

  return 'file';
}

/**
 * Get color class for file type
 */
export function getFileTypeColor(mimeType: string): string {
  const type = mimeType.toLowerCase();

  if (type.startsWith('image/')) return 'text-purple-400';
  if (type.includes('pdf')) return 'text-red-400';
  if (type.includes('word') || type.includes('document')) return 'text-blue-400';
  if (type.includes('excel') || type.includes('spreadsheet')) return 'text-green-400';
  if (type.includes('powerpoint') || type.includes('presentation')) return 'text-orange-400';
  if (type.includes('zip') || type.includes('compressed')) return 'text-yellow-400';
  if (type.includes('audio')) return 'text-pink-400';
  if (type.includes('video')) return 'text-indigo-400';

  return 'text-gray-400';
}

/**
 * Download attachment as file
 */
export function downloadAttachment(attachment: EmailAttachment) {
  if (!attachment.data) {
    console.error('Attachment data not available');
    return;
  }

  try {
    // Convert base64 to blob
    const byteCharacters = atob(attachment.data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: attachment.mimeType });

    // Create download link
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading attachment:', error);
  }
}

/**
 * Create preview URL for attachment
 */
export function createPreviewUrl(attachment: EmailAttachment): string | null {
  if (!attachment.data || !canPreviewFile(attachment.mimeType)) {
    return null;
  }

  try {
    // For images, create data URL
    if (attachment.mimeType.startsWith('image/')) {
      return `data:${attachment.mimeType};base64,${attachment.data}`;
    }

    // For PDFs and text, create blob URL
    const byteCharacters = atob(attachment.data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: attachment.mimeType });
    return window.URL.createObjectURL(blob);
  } catch (error) {
    console.error('Error creating preview URL:', error);
    return null;
  }
}

/**
 * Parse Gmail attachment data from API response
 */
export function parseGmailAttachment(part: any): EmailAttachment | null {
  if (!part.filename || !part.body) return null;

  const attachment: EmailAttachment = {
    id: part.body.attachmentId || part.partId || '',
    filename: part.filename,
    mimeType: part.mimeType || 'application/octet-stream',
    size: part.body.size || 0,
    sizeFormatted: formatFileSize(part.body.size || 0),
    partId: part.partId,
    isInline: part.headers?.some((h: any) =>
      h.name?.toLowerCase() === 'content-disposition' &&
      h.value?.toLowerCase().includes('inline')
    ),
  };

  // Determine if file can be previewed
  attachment.canPreview = canPreviewFile(attachment.mimeType);

  return attachment;
}
