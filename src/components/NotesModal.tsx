/**
 * NotesModal Component
 * Unified modal for viewing and managing notes across deals, contacts, and companies
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Pin, Edit2, Trash2, Save, FileText, Search, Tag } from 'lucide-react';
import {
  fetchNotes,
  createNote,
  updateNote,
  deleteNote,
  togglePinNote,
  searchNotes,
  type Note,
  type NoteEntityType,
  type CreateNoteInput,
} from '@/lib/services/notesService';
import logger from '@/lib/utils/logger';

interface NotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: NoteEntityType;
  entityId: string;
  entityName?: string;
}

export function NotesModal({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityName,
}: NotesModalProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    is_pinned: false,
    tags: [] as string[],
  });

  // Load notes when modal opens
  useEffect(() => {
    if (isOpen && entityId) {
      loadNotes();
    }
  }, [isOpen, entityId, entityType]);

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

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      loadNotes();
      return;
    }

    try {
      setLoading(true);
      const data = await searchNotes(entityType, entityId, searchTerm);
      setNotes(data);
    } catch (err) {
      logger.error('Error searching notes:', err);
      setError('Failed to search notes');
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

      const input: CreateNoteInput = {
        entityType,
        entityId,
        title: formData.title,
        content: formData.content,
        is_pinned: formData.is_pinned,
        tags: formData.tags,
      };

      await createNote(input);

      // Reset form
      setFormData({ title: '', content: '', is_pinned: false, tags: [] });
      setIsCreating(false);

      // Reload notes
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
        tags: formData.tags,
      });

      // Reset form
      setFormData({ title: '', content: '', is_pinned: false, tags: [] });
      setEditingNoteId(null);

      // Reload notes
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
      setError(null);
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
      setError('Failed to toggle pin');
    }
  };

  const startEditing = (note: Note) => {
    setEditingNoteId(note.id);
    setFormData({
      title: note.title,
      content: note.content,
      is_pinned: note.is_pinned,
      tags: note.tags || [],
    });
    setIsCreating(false);
  };

  const cancelEditing = () => {
    setEditingNoteId(null);
    setIsCreating(false);
    setFormData({ title: '', content: '', is_pinned: false, tags: [] });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Notes
                  </h2>
                  {entityName && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {entityName}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search notes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={() => {
                    setIsCreating(true);
                    setEditingNoteId(null);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Note
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              {error && (
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}

              {/* Create/Edit Form */}
              {(isCreating || editingNoteId) && (
                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="space-y-4">
                    <input
                      type="text"
                      placeholder="Note title..."
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <textarea
                      placeholder="Note content..."
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      rows={6}
                      className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_pinned}
                          onChange={(e) => setFormData({ ...formData, is_pinned: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Pin this note</span>
                      </label>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={cancelEditing}
                        className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => editingNoteId ? handleUpdateNote(editingNoteId) : handleCreateNote()}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        {editingNoteId ? 'Update' : 'Create'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes List */}
              {loading && !notes.length ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : notes.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">
                    {searchTerm ? 'No notes found matching your search' : 'No notes yet. Click "Add Note" to create one.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className={`p-4 rounded-lg border ${
                        note.is_pinned
                          ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                          : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            {note.is_pinned && (
                              <Pin className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                            )}
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {note.title}
                            </h3>
                          </div>
                          <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap mb-3">
                            {note.content}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                            <span>{formatDate(note.created_at)}</span>
                            {note.created_by_user && (note.created_by_user.first_name || note.created_by_user.last_name) && (
                              <>
                                <span>•</span>
                                <span>
                                  {note.created_by_user.first_name && note.created_by_user.last_name
                                    ? `${note.created_by_user.first_name} ${note.created_by_user.last_name}`
                                    : note.created_by_user.email}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleTogglePin(note.id, note.is_pinned)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                            title={note.is_pinned ? 'Unpin note' : 'Pin note'}
                          >
                            <Pin className={`w-4 h-4 ${note.is_pinned ? 'text-yellow-600' : 'text-gray-400'}`} />
                          </button>
                          <button
                            onClick={() => startEditing(note)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                            title="Edit note"
                          >
                            <Edit2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          </button>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Delete note"
                          >
                            <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
