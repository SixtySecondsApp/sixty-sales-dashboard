import { useEffect, useRef, useCallback, useState } from 'react';
import {
  EmailDraft,
  saveDraft,
  deleteDraft,
  getAllDrafts,
  getDraftById,
  isDraftEmpty,
  findReplyDraft
} from '@/lib/utils/draftStorage';
import { toast } from 'sonner';

const AUTOSAVE_INTERVAL = 30000; // 30 seconds

export interface DraftData {
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
  isReply?: boolean;
  replyToId?: string;
}

export interface UseDraftAutosaveOptions {
  enabled?: boolean;
  onDraftSaved?: (draft: EmailDraft) => void;
  onDraftLoaded?: (draft: EmailDraft) => void;
  onDraftDeleted?: () => void;
}

export function useDraftAutosave(
  draftData: DraftData,
  options: UseDraftAutosaveOptions = {}
) {
  const { enabled = true, onDraftSaved, onDraftLoaded, onDraftDeleted } = options;

  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [allDrafts, setAllDrafts] = useState<EmailDraft[]>([]);

  const autosaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastDraftDataRef = useRef<string>('');

  /**
   * Save draft manually
   */
  const saveNow = useCallback(async () => {
    if (!enabled) return null;

    // Don't save if draft is empty
    if (isDraftEmpty(draftData)) {
      return null;
    }

    try {
      setIsSaving(true);

      const savedDraft = saveDraft({
        ...draftData,
        id: currentDraftId || undefined
      });

      setCurrentDraftId(savedDraft.id);
      setLastSaved(new Date());
      lastDraftDataRef.current = JSON.stringify(draftData);

      if (onDraftSaved) {
        onDraftSaved(savedDraft);
      }

      return savedDraft;
    } catch (error) {
      console.error('[Auto-save] Error saving draft:', error);
      toast.error('Failed to save draft');
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [draftData, currentDraftId, enabled, onDraftSaved]);

  /**
   * Delete current draft
   */
  const deleteCurrentDraft = useCallback(() => {
    if (!currentDraftId) return false;

    const deleted = deleteDraft(currentDraftId);
    if (deleted) {
      setCurrentDraftId(null);
      setLastSaved(null);
      if (onDraftDeleted) {
        onDraftDeleted();
      }
      toast.success('Draft deleted');
    }
    return deleted;
  }, [currentDraftId, onDraftDeleted]);

  /**
   * Load a specific draft
   */
  const loadDraft = useCallback((draftId: string) => {
    const draft = getDraftById(draftId);
    if (draft) {
      setCurrentDraftId(draft.id);
      setLastSaved(new Date(draft.updatedAt));
      if (onDraftLoaded) {
        onDraftLoaded(draft);
      }
      return draft;
    }
    return null;
  }, [onDraftLoaded]);

  /**
   * Refresh the list of all drafts
   */
  const refreshDrafts = useCallback(() => {
    const drafts = getAllDrafts();
    setAllDrafts(drafts);
    return drafts;
  }, []);

  /**
   * Check if draft has unsaved changes
   */
  const hasUnsavedChanges = useCallback(() => {
    const currentData = JSON.stringify(draftData);
    return currentData !== lastDraftDataRef.current && !isDraftEmpty(draftData);
  }, [draftData]);

  /**
   * Auto-save logic
   */
  useEffect(() => {
    if (!enabled) return;

    const performAutosave = async () => {
      // Only autosave if there are unsaved changes
      if (hasUnsavedChanges()) {
        await saveNow();
      }
    };

    // Set up autosave interval
    autosaveIntervalRef.current = setInterval(performAutosave, AUTOSAVE_INTERVAL);

    // Cleanup interval on unmount
    return () => {
      if (autosaveIntervalRef.current) {
        clearInterval(autosaveIntervalRef.current);
      }
    };
  }, [enabled, saveNow, hasUnsavedChanges]);

  /**
   * Load existing draft on mount (for replies)
   */
  useEffect(() => {
    if (draftData.isReply && draftData.replyToId) {
      const existingDraft = findReplyDraft(draftData.replyToId);
      if (existingDraft) {
        loadDraft(existingDraft.id);
      }
    }
  }, []); // Only run on mount

  /**
   * Refresh drafts list periodically
   */
  useEffect(() => {
    refreshDrafts();
    const refreshInterval = setInterval(refreshDrafts, 60000); // Refresh every minute

    return () => clearInterval(refreshInterval);
  }, [refreshDrafts]);

  /**
   * Warn user about unsaved changes before page unload
   */
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = ''; // Modern browsers require this
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  return {
    // State
    currentDraftId,
    lastSaved,
    isSaving,
    allDrafts,
    hasUnsavedChanges: hasUnsavedChanges(),

    // Actions
    saveNow,
    deleteCurrentDraft,
    loadDraft,
    refreshDrafts
  };
}
