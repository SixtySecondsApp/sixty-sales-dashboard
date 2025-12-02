/**
 * Draft Storage Utility
 *
 * Manages email draft persistence in localStorage with automatic cleanup
 * and conflict resolution.
 */

export interface EmailDraft {
  id: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  attachments?: {
    name: string;
    size: number;
    type: string;
  }[];
  createdAt: string;
  updatedAt: string;
  isReply?: boolean;
  replyToId?: string;
}

const DRAFT_STORAGE_KEY = 'email_drafts';
const MAX_DRAFTS = 50; // Maximum number of drafts to store
const DRAFT_EXPIRY_DAYS = 30; // Auto-delete drafts older than 30 days

/**
 * Get all email drafts from localStorage
 */
export function getAllDrafts(): EmailDraft[] {
  try {
    const draftsJson = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!draftsJson) return [];

    const drafts: EmailDraft[] = JSON.parse(draftsJson);

    // Filter out expired drafts
    const now = new Date();
    const validDrafts = drafts.filter(draft => {
      const draftDate = new Date(draft.updatedAt);
      const daysSinceUpdate = (now.getTime() - draftDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceUpdate < DRAFT_EXPIRY_DAYS;
    });

    // If we filtered out any drafts, update storage
    if (validDrafts.length !== drafts.length) {
      saveDraftsToStorage(validDrafts);
    }

    // Sort by most recently updated
    return validDrafts.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch (error) {
    console.error('[Draft Storage] Error getting drafts:', error);
    return [];
  }
}

/**
 * Get a specific draft by ID
 */
export function getDraftById(id: string): EmailDraft | null {
  const drafts = getAllDrafts();
  return drafts.find(draft => draft.id === id) || null;
}

/**
 * Save or update a draft
 */
export function saveDraft(draft: Omit<EmailDraft, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): EmailDraft {
  try {
    const drafts = getAllDrafts();
    const now = new Date().toISOString();

    let savedDraft: EmailDraft;

    if (draft.id) {
      // Update existing draft
      const existingIndex = drafts.findIndex(d => d.id === draft.id);
      if (existingIndex !== -1) {
        savedDraft = {
          ...drafts[existingIndex],
          ...draft,
          id: draft.id,
          updatedAt: now
        };
        drafts[existingIndex] = savedDraft;
      } else {
        // Draft not found, create new one
        savedDraft = {
          ...draft,
          id: draft.id,
          createdAt: now,
          updatedAt: now
        };
        drafts.unshift(savedDraft);
      }
    } else {
      // Create new draft
      savedDraft = {
        ...draft,
        id: generateDraftId(),
        createdAt: now,
        updatedAt: now
      };
      drafts.unshift(savedDraft);
    }

    // Enforce maximum drafts limit
    const trimmedDrafts = drafts.slice(0, MAX_DRAFTS);
    saveDraftsToStorage(trimmedDrafts);

    return savedDraft;
  } catch (error) {
    console.error('[Draft Storage] Error saving draft:', error);
    throw error;
  }
}

/**
 * Delete a draft by ID
 */
export function deleteDraft(id: string): boolean {
  try {
    const drafts = getAllDrafts();
    const filteredDrafts = drafts.filter(draft => draft.id !== id);

    if (filteredDrafts.length === drafts.length) {
      return false; // Draft not found
    }

    saveDraftsToStorage(filteredDrafts);
    return true;
  } catch (error) {
    console.error('[Draft Storage] Error deleting draft:', error);
    return false;
  }
}

/**
 * Delete all drafts
 */
export function deleteAllDrafts(): boolean {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('[Draft Storage] Error deleting all drafts:', error);
    return false;
  }
}

/**
 * Check if draft has meaningful content
 */
export function isDraftEmpty(draft: Partial<EmailDraft>): boolean {
  const hasTo = draft.to && draft.to.trim().length > 0;
  const hasSubject = draft.subject && draft.subject.trim().length > 0;
  const hasBody = draft.body && draft.body.trim().length > 0;
  const hasAttachments = draft.attachments && draft.attachments.length > 0;

  return !hasTo && !hasSubject && !hasBody && !hasAttachments;
}

/**
 * Find existing draft for reply
 */
export function findReplyDraft(replyToId: string): EmailDraft | null {
  const drafts = getAllDrafts();
  return drafts.find(draft => draft.isReply && draft.replyToId === replyToId) || null;
}

/**
 * Get draft storage statistics
 */
export function getDraftStats(): {
  total: number;
  storageUsed: number;
  oldestDraft: string | null;
  newestDraft: string | null;
} {
  const drafts = getAllDrafts();
  const draftsJson = localStorage.getItem(DRAFT_STORAGE_KEY) || '[]';

  return {
    total: drafts.length,
    storageUsed: new Blob([draftsJson]).size, // Size in bytes
    oldestDraft: drafts.length > 0 ? drafts[drafts.length - 1].updatedAt : null,
    newestDraft: drafts.length > 0 ? drafts[0].updatedAt : null
  };
}

/**
 * Export drafts as JSON (for backup)
 */
export function exportDrafts(): string {
  const drafts = getAllDrafts();
  return JSON.stringify(drafts, null, 2);
}

/**
 * Import drafts from JSON (for restore)
 */
export function importDrafts(jsonString: string): boolean {
  try {
    const importedDrafts: EmailDraft[] = JSON.parse(jsonString);

    // Validate structure
    if (!Array.isArray(importedDrafts)) {
      throw new Error('Invalid draft format');
    }

    // Merge with existing drafts (avoid duplicates by ID)
    const existingDrafts = getAllDrafts();
    const existingIds = new Set(existingDrafts.map(d => d.id));

    const newDrafts = importedDrafts.filter(d => !existingIds.has(d.id));
    const mergedDrafts = [...existingDrafts, ...newDrafts].slice(0, MAX_DRAFTS);

    saveDraftsToStorage(mergedDrafts);
    return true;
  } catch (error) {
    console.error('[Draft Storage] Error importing drafts:', error);
    return false;
  }
}

// ========== Private Helper Functions ==========

/**
 * Save drafts array to localStorage
 */
function saveDraftsToStorage(drafts: EmailDraft[]): void {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
  } catch (error) {
    console.error('[Draft Storage] Error saving to localStorage:', error);

    // If quota exceeded, try removing oldest drafts
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      const reducedDrafts = drafts.slice(0, Math.floor(drafts.length / 2));
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(reducedDrafts));
        console.warn('[Draft Storage] Reduced drafts to fit quota');
      } catch (retryError) {
        console.error('[Draft Storage] Still cannot save after reducing drafts');
      }
    }
  }
}

/**
 * Generate unique draft ID
 */
function generateDraftId(): string {
  return `draft_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
