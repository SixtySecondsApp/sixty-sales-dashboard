/**
 * Notes Service
 * Unified API for managing notes across deals, contacts, and companies
 */

import { supabase } from '@/lib/supabase/clientV2';
import logger from '@/lib/utils/logger';

export type NoteEntityType = 'deal' | 'contact' | 'company';

export interface Note {
  id: string;
  title: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_pinned: boolean;
  tags: string[];
  // Entity-specific fields
  deal_id?: string;
  contact_id?: string;
  company_id?: string;
  // Joined data
  created_by_user?: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  };
}

export interface CreateNoteInput {
  entityType: NoteEntityType;
  entityId: string;
  title: string;
  content: string;
  is_pinned?: boolean;
  tags?: string[];
}

export interface UpdateNoteInput {
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

/**
 * Get the table name for a specific entity type
 */
function getTableName(entityType: NoteEntityType): string {
  switch (entityType) {
    case 'deal':
      return 'deal_notes';
    case 'contact':
      return 'contact_notes';
    case 'company':
      return 'company_notes';
    default:
      throw new Error(`Invalid entity type: ${entityType}`);
  }
}

/**
 * Get the foreign key column name for a specific entity type
 */
function getForeignKeyColumn(entityType: NoteEntityType): string {
  switch (entityType) {
    case 'deal':
      return 'deal_id';
    case 'contact':
      return 'contact_id';
    case 'company':
      return 'company_id';
    default:
      throw new Error(`Invalid entity type: ${entityType}`);
  }
}

/**
 * Fetch all notes for a specific entity
 */
export async function fetchNotes(
  entityType: NoteEntityType,
  entityId: string
): Promise<Note[]> {
  try {
    const tableName = getTableName(entityType);
    const foreignKey = getForeignKeyColumn(entityType);

    // Fetch notes without join first
    const { data: notes, error } = await supabase
      .from(tableName)
      .select('*')
      .eq(foreignKey, entityId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      logger.error(`Error fetching ${entityType} notes:`, error);
      throw error;
    }

    if (!notes || notes.length === 0) {
      return [];
    }

    // Fetch profile data for all unique created_by values
    const creatorIds = [...new Set(notes.map(note => note.created_by))];
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name')
      .in('id', creatorIds);

    if (profileError) {
      logger.warn(`Error fetching profiles for notes:`, profileError);
      // Return notes without user info if profile fetch fails
      return notes;
    }

    // Map profiles to notes
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    return notes.map(note => ({
      ...note,
      created_by_user: profileMap.get(note.created_by)
    }));
  } catch (error) {
    logger.error(`Failed to fetch ${entityType} notes:`, error);
    throw error;
  }
}

/**
 * Create a new note
 */
export async function createNote(input: CreateNoteInput): Promise<Note> {
  try {
    const tableName = getTableName(input.entityType);
    const foreignKey = getForeignKeyColumn(input.entityType);

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const noteData = {
      [foreignKey]: input.entityId,
      title: input.title,
      content: input.content,
      created_by: user.id,
      is_pinned: input.is_pinned || false,
      tags: input.tags || [],
    };

    const { data: note, error } = await supabase
      .from(tableName)
      .insert(noteData)
      .select('*')
      .single();

    if (error) {
      logger.error(`Error creating ${input.entityType} note:`, error);
      throw error;
    }

    // Fetch profile data
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name')
      .eq('id', user.id)
      .single();

    const noteWithUser = {
      ...note,
      created_by_user: profile || undefined
    };

    logger.log(`✅ Created ${input.entityType} note:`, noteWithUser);
    return noteWithUser;
  } catch (error) {
    logger.error(`Failed to create ${input.entityType} note:`, error);
    throw error;
  }
}

/**
 * Update an existing note
 */
export async function updateNote(
  entityType: NoteEntityType,
  noteId: string,
  updates: UpdateNoteInput
): Promise<Note> {
  try {
    const tableName = getTableName(entityType);

    const { data: note, error } = await supabase
      .from(tableName)
      .update(updates)
      .eq('id', noteId)
      .select('*')
      .single();

    if (error) {
      logger.error(`Error updating ${entityType} note:`, error);
      throw error;
    }

    // Fetch profile data
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name')
      .eq('id', note.created_by)
      .single();

    const noteWithUser = {
      ...note,
      created_by_user: profile || undefined
    };

    logger.log(`✅ Updated ${entityType} note:`, noteWithUser);
    return noteWithUser;
  } catch (error) {
    logger.error(`Failed to update ${entityType} note:`, error);
    throw error;
  }
}

/**
 * Delete a note
 */
export async function deleteNote(
  entityType: NoteEntityType,
  noteId: string
): Promise<void> {
  try {
    const tableName = getTableName(entityType);

    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', noteId);

    if (error) {
      logger.error(`Error deleting ${entityType} note:`, error);
      throw error;
    }

    logger.log(`✅ Deleted ${entityType} note:`, noteId);
  } catch (error) {
    logger.error(`Failed to delete ${entityType} note:`, error);
    throw error;
  }
}

/**
 * Toggle pin status of a note
 */
export async function togglePinNote(
  entityType: NoteEntityType,
  noteId: string,
  isPinned: boolean
): Promise<Note> {
  try {
    return await updateNote(entityType, noteId, { is_pinned: isPinned });
  } catch (error) {
    logger.error(`Failed to toggle pin ${entityType} note:`, error);
    throw error;
  }
}

/**
 * Get note statistics for an entity
 */
export async function getNoteStats(
  entityType: NoteEntityType,
  entityId: string
): Promise<NoteStats | null> {
  try {
    const functionName = `get_${entityType}_note_stats`;

    const { data, error } = await supabase
      .rpc(functionName, { [`target_${entityType}_id`]: entityId });

    if (error) {
      logger.error(`Error fetching ${entityType} note stats:`, error);
      throw error;
    }

    return data?.[0] || null;
  } catch (error) {
    logger.error(`Failed to fetch ${entityType} note stats:`, error);
    throw error;
  }
}

/**
 * Search notes by content or title
 */
export async function searchNotes(
  entityType: NoteEntityType,
  entityId: string,
  searchTerm: string
): Promise<Note[]> {
  try {
    const tableName = getTableName(entityType);
    const foreignKey = getForeignKeyColumn(entityType);

    const { data: notes, error } = await supabase
      .from(tableName)
      .select('*')
      .eq(foreignKey, entityId)
      .or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      logger.error(`Error searching ${entityType} notes:`, error);
      throw error;
    }

    if (!notes || notes.length === 0) {
      return [];
    }

    // Fetch profile data for all unique created_by values
    const creatorIds = [...new Set(notes.map(note => note.created_by))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name')
      .in('id', creatorIds);

    // Map profiles to notes
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    return notes.map(note => ({
      ...note,
      created_by_user: profileMap.get(note.created_by)
    }));
  } catch (error) {
    logger.error(`Failed to search ${entityType} notes:`, error);
    throw error;
  }
}

/**
 * Filter notes by tags
 */
export async function filterNotesByTags(
  entityType: NoteEntityType,
  entityId: string,
  tags: string[]
): Promise<Note[]> {
  try {
    const tableName = getTableName(entityType);
    const foreignKey = getForeignKeyColumn(entityType);

    const { data: notes, error } = await supabase
      .from(tableName)
      .select('*')
      .eq(foreignKey, entityId)
      .contains('tags', tags)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      logger.error(`Error filtering ${entityType} notes by tags:`, error);
      throw error;
    }

    if (!notes || notes.length === 0) {
      return [];
    }

    // Fetch profile data for all unique created_by values
    const creatorIds = [...new Set(notes.map(note => note.created_by))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name')
      .in('id', creatorIds);

    // Map profiles to notes
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    return notes.map(note => ({
      ...note,
      created_by_user: profileMap.get(note.created_by)
    }));
  } catch (error) {
    logger.error(`Failed to filter ${entityType} notes by tags:`, error);
    throw error;
  }
}
