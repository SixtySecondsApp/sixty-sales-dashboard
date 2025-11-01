/**
 * NotesSection Component
 * Beautiful, inline notes display for deal, contact, and company pages
 */

import React, { useState, useEffect } from 'react';
import { Plus, Pin, Edit2, Trash2, Search, Calendar, User as UserIcon, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
import {
  fetchNotes,
  createNote,
  updateNote,
  deleteNote,
  togglePinNote,
  type Note,
  type NoteEntityType,
} from '@/lib/services/notesService';
import logger from '@/lib/utils/logger';
import { useUser } from '@/lib/hooks/useUser';

interface NotesSectionProps {
  entityType: NoteEntityType;
  entityId: string;
  entityName?: string;
  maxInitialDisplay?: number;
}

export function NotesSection({
  entityType,
  entityId,
  entityName,
  maxInitialDisplay = 3,
}: NotesSectionProps) {
  const { userData } = useUser();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAll, setShowAll] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    is_pinned: false,
  });

  // Load notes on mount
  useEffect(() => {
    if (entityId) {
      loadNotes();
    }
  }, [entityId, entityType]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchNotes(entityType, entityId);
      setNotes(data);
    } catch (err) {
      logger.error('Error loading notes:', err);
      setError('Failed to load notes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNote = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      setError('Title and content are required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await createNote({
        entityType,
        entityId,
        title: formData.title,
        content: formData.content,
        is_pinned: formData.is_pinned,
      });

      setFormData({ title: '', content: '', is_pinned: false });
      setIsCreating(false);
      await loadNotes();
    } catch (err) {
      logger.error('Error creating note:', err);
      setError('Failed to create note');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateNote = async (noteId: string) => {
    if (!formData.title.trim() || !formData.content.trim()) {
      setError('Title and content are required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await updateNote(entityType, noteId, {
        title: formData.title,
        content: formData.content,
        is_pinned: formData.is_pinned,
      });

      setFormData({ title: '', content: '', is_pinned: false });
      setEditingNoteId(null);
      await loadNotes();
    } catch (err) {
      logger.error('Error updating note:', err);
      setError('Failed to update note');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) {
      return;
    }

    try {
      setLoading(true);
      await deleteNote(entityType, noteId);
      await loadNotes();
    } catch (err) {
      logger.error('Error deleting note:', err);
      setError('Failed to delete note');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePin = async (noteId: string, currentPinned: boolean) => {
    try {
      await togglePinNote(entityType, noteId, !currentPinned);
      await loadNotes();
    } catch (err) {
      logger.error('Error toggling pin:', err);
    }
  };

  const startEditing = (note: Note) => {
    setEditingNoteId(note.id);
    setFormData({
      title: note.title,
      content: note.content,
      is_pinned: note.is_pinned,
    });
    setIsCreating(false);
  };

  const cancelEditing = () => {
    setEditingNoteId(null);
    setIsCreating(false);
    setFormData({ title: '', content: '', is_pinned: false });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const displayedNotes = showAll ? notes : notes.slice(0, maxInitialDisplay);
  const hasMore = notes.length > maxInitialDisplay;

  return (
    <div className="section-card">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <MessageCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold theme-text-primary">Notes</h2>
            <p className="text-sm theme-text-tertiary">
              {notes.length} {notes.length === 1 ? 'note' : 'notes'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Note
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Create/Edit Form */}
      {(isCreating || editingNoteId) && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Note title..."
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent theme-text-primary text-sm"
            />
            <textarea
              placeholder="Write your note..."
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent theme-text-primary text-sm resize-none"
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_pinned}
                  onChange={(e) => setFormData({ ...formData, is_pinned: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm theme-text-secondary">Pin this note</span>
              </label>
              <div className="flex gap-2">
                <button
                  onClick={cancelEditing}
                  className="px-3 py-1.5 text-sm theme-text-secondary hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => editingNoteId ? handleUpdateNote(editingNoteId) : handleCreateNote()}
                  disabled={loading}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {editingNoteId ? 'Update' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notes List */}
      {loading && !notes.length ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-8">
          <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-3 opacity-50" />
          <p className="theme-text-tertiary text-sm">
            No notes yet. Click "Add Note" to create one.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {displayedNotes.map((note) => (
              <div
                key={note.id}
                className={`group relative p-4 rounded-lg border transition-all ${
                  note.is_pinned
                    ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/30'
                    : 'bg-white dark:bg-gray-800/30 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {note.is_pinned && (
                      <Pin className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="currentColor" />
                    )}
                    <h3 className="font-semibold theme-text-primary text-sm truncate">
                      {note.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleTogglePin(note.id, note.is_pinned)}
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      title={note.is_pinned ? 'Unpin' : 'Pin'}
                    >
                      <Pin className={`w-3.5 h-3.5 ${note.is_pinned ? 'text-amber-600 dark:text-amber-400' : 'theme-text-tertiary'}`} />
                    </button>
                    <button
                      onClick={() => startEditing(note)}
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5 theme-text-tertiary" />
                    </button>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <p className="theme-text-secondary text-sm leading-relaxed whitespace-pre-wrap mb-3">
                  {note.content}
                </p>

                {/* Footer */}
                <div className="flex items-center gap-3 text-xs theme-text-tertiary">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{formatDate(note.created_at)}</span>
                  </div>
                  {note.created_by_user && (
                    <>
                      <span>•</span>
                      <div className="flex items-center gap-1.5">
                        <UserIcon className="w-3.5 h-3.5" />
                        <span>
                          {note.created_by_user.first_name && note.created_by_user.last_name
                            ? `${note.created_by_user.first_name} ${note.created_by_user.last_name}`
                            : note.created_by_user.email}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Show More/Less Button */}
          {hasMore && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="mt-4 w-full py-2 text-sm theme-text-secondary hover:theme-text-primary border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
            >
              {showAll ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Show {notes.length - maxInitialDisplay} More {notes.length - maxInitialDisplay === 1 ? 'Note' : 'Notes'}
                </>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
}
