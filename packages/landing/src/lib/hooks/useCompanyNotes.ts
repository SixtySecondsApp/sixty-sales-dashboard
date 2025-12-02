import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { useUser } from './useUser';
import { toast } from 'sonner';
import logger from '@/lib/utils/logger';

export interface CompanyNote {
  id: string;
  company_id: string;
  title: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_pinned: boolean;
  tags: string[];
  // Joined data
  creator?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    avatar_url?: string;
  };
}

export interface CreateNoteData {
  company_id: string;
  title: string;
  content: string;
  is_pinned?: boolean;
  tags?: string[];
}

export interface UpdateNoteData {
  title?: string;
  content?: string;
  is_pinned?: boolean;
  tags?: string[];
}

export interface NoteStats {
  total_notes: number;
  pinned_notes: number;
  recent_notes: number;
  last_note_date: string | null;
}

interface UseCompanyNotesOptions {
  companyId?: string;
  autoFetch?: boolean;
  includeStats?: boolean;
}

export function useCompanyNotes(options: UseCompanyNotesOptions = {}) {
  const { companyId, autoFetch = true, includeStats = false } = options;
  const [notes, setNotes] = useState<CompanyNote[]>([]);
  const [stats, setStats] = useState<NoteStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { userData } = useUser();

  // Fetch notes for a specific company
  const fetchNotes = useCallback(async (targetCompanyId?: string) => {
    const queryCompanyId = targetCompanyId || companyId;
    
    if (!queryCompanyId || !userData?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Fetch notes with creator information
      const { data: notesData, error: notesError } = await supabase
        .from('company_notes')
        .select(`
          *,
          creator:profiles!created_by (
            id,
            first_name,
            last_name,
            email,
            avatar_url
          )
        `)
        .eq('company_id', queryCompanyId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (notesError) throw notesError;

      setNotes(notesData || []);

      // Fetch stats if requested
      if (includeStats) {
        const { data: statsData, error: statsError } = await supabase
          .rpc('get_company_note_stats', { target_company_id: queryCompanyId });

        if (statsError) {
          logger.warn('Failed to fetch note stats:', statsError);
        } else if (statsData && statsData.length > 0) {
          setStats(statsData[0]);
        }
      }

    } catch (err: any) {
      logger.error('Error fetching company notes:', err);
      setError(err.message || 'Failed to fetch notes');
      toast.error('Failed to load notes');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, userData?.id, includeStats]);

  // Create a new note
  const createNote = useCallback(async (noteData: CreateNoteData): Promise<CompanyNote | null> => {
    if (!userData?.id) {
      toast.error('Authentication required');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('company_notes')
        .insert({
          ...noteData,
          created_by: userData.id,
        })
        .select(`
          *,
          creator:profiles!created_by (
            id,
            first_name,
            last_name,
            email,
            avatar_url
          )
        `)
        .single();

      if (error) throw error;

      // Add to local state
      setNotes(prev => [data, ...prev]);
      
      // Update stats if applicable
      if (includeStats && stats) {
        setStats(prev => prev ? {
          ...prev,
          total_notes: prev.total_notes + 1,
          pinned_notes: prev.pinned_notes + (data.is_pinned ? 1 : 0),
          recent_notes: prev.recent_notes + 1,
          last_note_date: data.created_at
        } : null);
      }

      toast.success('Note created successfully');
      return data;

    } catch (err: any) {
      logger.error('Error creating note:', err);
      toast.error(err.message || 'Failed to create note');
      return null;
    }
  }, [userData?.id, includeStats, stats]);

  // Update an existing note
  const updateNote = useCallback(async (noteId: string, updateData: UpdateNoteData): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('company_notes')
        .update(updateData)
        .eq('id', noteId)
        .select(`
          *,
          creator:profiles!created_by (
            id,
            first_name,
            last_name,
            email,
            avatar_url
          )
        `)
        .single();

      if (error) throw error;

      // Update local state
      setNotes(prev => prev.map(note => 
        note.id === noteId ? data : note
      ));

      // Update stats if pinned status changed
      if (includeStats && stats && 'is_pinned' in updateData) {
        const oldNote = notes.find(n => n.id === noteId);
        if (oldNote && oldNote.is_pinned !== data.is_pinned) {
          setStats(prev => prev ? {
            ...prev,
            pinned_notes: prev.pinned_notes + (data.is_pinned ? 1 : -1)
          } : null);
        }
      }

      toast.success('Note updated successfully');
      return true;

    } catch (err: any) {
      logger.error('Error updating note:', err);
      toast.error(err.message || 'Failed to update note');
      return false;
    }
  }, [includeStats, stats, notes]);

  // Delete a note
  const deleteNote = useCallback(async (noteId: string): Promise<boolean> => {
    try {
      const noteToDelete = notes.find(n => n.id === noteId);
      
      const { error } = await supabase
        .from('company_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      // Remove from local state
      setNotes(prev => prev.filter(note => note.id !== noteId));

      // Update stats
      if (includeStats && stats && noteToDelete) {
        setStats(prev => prev ? {
          ...prev,
          total_notes: prev.total_notes - 1,
          pinned_notes: prev.pinned_notes - (noteToDelete.is_pinned ? 1 : 0),
          recent_notes: prev.recent_notes - (new Date(noteToDelete.created_at) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) ? 1 : 0)
        } : null);
      }

      toast.success('Note deleted successfully');
      return true;

    } catch (err: any) {
      logger.error('Error deleting note:', err);
      toast.error(err.message || 'Failed to delete note');
      return false;
    }
  }, [notes, includeStats, stats]);

  // Toggle pin status
  const togglePin = useCallback(async (noteId: string): Promise<boolean> => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return false;

    return await updateNote(noteId, { is_pinned: !note.is_pinned });
  }, [notes, updateNote]);

  // Filter notes by tags
  const filterByTags = useCallback((tags: string[]): CompanyNote[] => {
    if (tags.length === 0) return notes;
    
    return notes.filter(note => 
      tags.some(tag => note.tags.includes(tag))
    );
  }, [notes]);

  // Search notes
  const searchNotes = useCallback((query: string): CompanyNote[] => {
    if (!query.trim()) return notes;
    
    const searchTerm = query.toLowerCase();
    return notes.filter(note => 
      note.title.toLowerCase().includes(searchTerm) ||
      note.content.toLowerCase().includes(searchTerm) ||
      note.tags.some(tag => tag.toLowerCase().includes(searchTerm))
    );
  }, [notes]);

  // Get unique tags from all notes
  const getAllTags = useCallback((): string[] => {
    const allTags = notes.flatMap(note => note.tags);
    return Array.from(new Set(allTags)).sort();
  }, [notes]);

  // Set up real-time subscription
  useEffect(() => {
    if (!companyId || !userData?.id) return;

    const channel = supabase
      .channel(`company_notes_${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'company_notes',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          logger.log('Real-time note update:', payload);
          // Refetch notes to get updated data with joins
          fetchNotes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, userData?.id, fetchNotes]);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch && companyId && userData?.id) {
      fetchNotes();
    }
  }, [autoFetch, companyId, userData?.id, fetchNotes]);

  return {
    notes,
    stats,
    isLoading,
    error,
    fetchNotes,
    createNote,
    updateNote,
    deleteNote,
    togglePin,
    filterByTags,
    searchNotes,
    getAllTags,
    // Derived data
    pinnedNotes: notes.filter(note => note.is_pinned),
    recentNotes: notes.filter(note => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return new Date(note.created_at) >= weekAgo;
    }),
  };
}