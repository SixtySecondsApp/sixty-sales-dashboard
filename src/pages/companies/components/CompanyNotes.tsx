import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Plus,
  Search,
  Filter,
  Pin,
  PinOff,
  Edit2,
  Trash2,
  X,
  Save,
  FileText,
  Tag,
  Calendar,
  User,
  MoreVertical,
  Hash
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCompanyNotes, CompanyNote, CreateNoteData, UpdateNoteData } from '@/lib/hooks/useCompanyNotes';
import { useUser } from '@/lib/hooks/useUser';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CompanyNotesProps {
  companyId: string;
  companyName: string;
  className?: string;
}

export function CompanyNotes({ companyId, companyName, className }: CompanyNotesProps) {
  const { userData } = useUser();
  const {
    notes,
    stats,
    isLoading,
    createNote,
    updateNote,
    deleteNote,
    togglePin,
    searchNotes,
    getAllTags,
    pinnedNotes,
    recentNotes
  } = useCompanyNotes({ companyId, includeStats: true });

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingNote, setEditingNote] = useState<CompanyNote | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Form state
  const [noteForm, setNoteForm] = useState({
    title: '',
    content: '',
    is_pinned: false,
    tags: [] as string[],
    newTag: ''
  });

  // Reset form
  const resetForm = () => {
    setNoteForm({
      title: '',
      content: '',
      is_pinned: false,
      tags: [],
      newTag: ''
    });
  };

  // Handle create note
  const handleCreateNote = async () => {
    if (!noteForm.title.trim() || !noteForm.content.trim()) return;

    const noteData: CreateNoteData = {
      company_id: companyId,
      title: noteForm.title.trim(),
      content: noteForm.content.trim(),
      is_pinned: noteForm.is_pinned,
      tags: noteForm.tags
    };

    const success = await createNote(noteData);
    if (success) {
      resetForm();
      setShowCreateModal(false);
    }
  };

  // Handle update note
  const handleUpdateNote = async () => {
    if (!editingNote || !noteForm.title.trim() || !noteForm.content.trim()) return;

    const updateData: UpdateNoteData = {
      title: noteForm.title.trim(),
      content: noteForm.content.trim(),
      is_pinned: noteForm.is_pinned,
      tags: noteForm.tags
    };

    const success = await updateNote(editingNote.id, updateData);
    if (success) {
      setEditingNote(null);
      resetForm();
    }
  };

  // Handle delete note
  const handleDeleteNote = async (noteId: string) => {
    const success = await deleteNote(noteId);
    if (success) {
      setShowDeleteConfirm(null);
    }
  };

  // Start editing a note
  const startEditing = (note: CompanyNote) => {
    setEditingNote(note);
    setNoteForm({
      title: note.title,
      content: note.content,
      is_pinned: note.is_pinned,
      tags: [...note.tags],
      newTag: ''
    });
  };

  // Add tag to form
  const addTag = () => {
    const tag = noteForm.newTag.trim().toLowerCase();
    if (tag && !noteForm.tags.includes(tag)) {
      setNoteForm(prev => ({
        ...prev,
        tags: [...prev.tags, tag],
        newTag: ''
      }));
    }
  };

  // Remove tag from form
  const removeTag = (tagToRemove: string) => {
    setNoteForm(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  // Filter notes based on search and tags
  const filteredNotes = React.useMemo(() => {
    let filtered = searchQuery ? searchNotes(searchQuery) : notes;
    
    if (selectedTags.length > 0) {
      filtered = filtered.filter(note =>
        selectedTags.some(tag => note.tags.includes(tag))
      );
    }
    
    return filtered;
  }, [notes, searchQuery, selectedTags, searchNotes]);

  // Get all available tags
  const availableTags = getAllTags();

  const getCreatorName = (note: CompanyNote) => {
    if (note.creator) {
      return `${note.creator.first_name} ${note.creator.last_name}`;
    }
    return 'Unknown User';
  };

  const getCreatorInitials = (note: CompanyNote) => {
    if (note.creator) {
      return `${note.creator.first_name?.[0] || ''}${note.creator.last_name?.[0] || ''}`;
    }
    return 'UN';
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-gray-900/50 rounded-xl p-4 animate-pulse">
            <div className="h-4 bg-gray-800 rounded w-1/3 mb-2"></div>
            <div className="h-3 bg-gray-800 rounded w-full mb-1"></div>
            <div className="h-3 bg-gray-800 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with stats and actions */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-white">Notes</h3>
          {stats && (
            <p className="text-sm text-gray-400">
              {stats.total_notes} total • {stats.pinned_notes} pinned • {stats.recent_notes} this week
            </p>
          )}
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-emerald-500 hover:bg-emerald-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Note
        </Button>
      </div>

      {/* Search and filters */}
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "bg-gray-800/50 border-gray-700/50 text-gray-300",
              showFilters && "bg-emerald-500/10 border-emerald-500/50 text-emerald-400"
            )}
          >
            <Filter className="w-4 h-4" />
          </Button>
        </div>

        {/* Tag filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-gray-900/50 rounded-lg p-4 border border-gray-800/50"
            >
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-white">Filter by tags</h4>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => {
                        setSelectedTags(prev =>
                          prev.includes(tag)
                            ? prev.filter(t => t !== tag)
                            : [...prev, tag]
                        );
                      }}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                        selectedTags.includes(tag)
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:bg-gray-700/50"
                      )}
                    >
                      #{tag}
                    </button>
                  ))}
                  {availableTags.length === 0 && (
                    <p className="text-xs text-gray-500">No tags available</p>
                  )}
                </div>
                {selectedTags.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedTags([])}
                    className="bg-gray-800/50 border-gray-700/50 text-gray-300"
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Notes list */}
      <div className="space-y-4">
        {filteredNotes.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No notes found</h3>
            <p className="text-gray-400 mb-4">
              {searchQuery || selectedTags.length > 0
                ? 'Try adjusting your search or filters'
                : `Start by creating the first note for ${companyName}`
              }
            </p>
            {!searchQuery && selectedTags.length === 0 && (
              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create First Note
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotes.map((note) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "bg-gray-900/50 rounded-xl p-4 border border-gray-800/50 hover:border-gray-700/50 transition-colors",
                  note.is_pinned && "border-emerald-500/30 bg-emerald-500/5"
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    {note.is_pinned && (
                      <Pin className="w-4 h-4 text-emerald-400 mt-1 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-medium truncate">{note.title}</h4>
                      <div className="flex items-center gap-4 mt-1">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center">
                            <span className="text-xs font-medium text-gray-300">
                              {getCreatorInitials(note)}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400">{getCreatorName(note)}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700">
                      <DropdownMenuItem
                        onClick={() => togglePin(note.id)}
                        className="text-gray-300 hover:text-white hover:bg-gray-800"
                      >
                        {note.is_pinned ? (
                          <>
                            <PinOff className="w-4 h-4 mr-2" />
                            Unpin
                          </>
                        ) : (
                          <>
                            <Pin className="w-4 h-4 mr-2" />
                            Pin
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => startEditing(note)}
                        className="text-gray-300 hover:text-white hover:bg-gray-800"
                      >
                        <Edit2 className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-gray-700" />
                      <DropdownMenuItem
                        onClick={() => setShowDeleteConfirm(note.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="text-sm text-gray-300 mb-3 whitespace-pre-wrap">
                  {note.content}
                </div>

                {note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {note.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 rounded-full text-xs bg-gray-800/50 text-gray-400 border border-gray-700/50"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Note Modal */}
      <Dialog open={showCreateModal || !!editingNote} onOpenChange={() => {
        setShowCreateModal(false);
        setEditingNote(null);
        resetForm();
      }}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingNote ? 'Edit Note' : 'Create New Note'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">
                Title
              </label>
              <input
                type="text"
                value={noteForm.title}
                onChange={(e) => setNoteForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter note title..."
                className="w-full p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">
                Content
              </label>
              <textarea
                value={noteForm.content}
                onChange={(e) => setNoteForm(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Write your note content..."
                rows={6}
                className="w-full p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500/50 resize-none"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-300 block">
                Tags
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={noteForm.newTag}
                  onChange={(e) => setNoteForm(prev => ({ ...prev, newTag: e.target.value }))}
                  placeholder="Add tag..."
                  onKeyPress={(e) => e.key === 'Enter' && addTag()}
                  className="flex-1 p-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500/50"
                />
                <Button
                  type="button"
                  onClick={addTag}
                  variant="outline"
                  className="bg-gray-800/50 border-gray-700/50 text-gray-300"
                >
                  <Hash className="w-4 h-4" />
                </Button>
              </div>
              {noteForm.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {noteForm.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 rounded-full text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="hover:text-emerald-300"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="pin-note"
                checked={noteForm.is_pinned}
                onChange={(e) => setNoteForm(prev => ({ ...prev, is_pinned: e.target.checked }))}
                className="rounded bg-gray-800 border-gray-600 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
              />
              <label htmlFor="pin-note" className="text-sm text-gray-300">
                Pin this note
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateModal(false);
                setEditingNote(null);
                resetForm();
              }}
              className="bg-gray-800/50 border-gray-700/50 text-gray-300"
            >
              Cancel
            </Button>
            <Button
              onClick={editingNote ? handleUpdateNote : handleCreateNote}
              disabled={!noteForm.title.trim() || !noteForm.content.trim()}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              {editingNote ? 'Update' : 'Create'} Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Delete Note</DialogTitle>
          </DialogHeader>
          <p className="text-gray-300">
            Are you sure you want to delete this note? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(null)}
              className="bg-gray-800/50 border-gray-700/50 text-gray-300"
            >
              Cancel
            </Button>
            <Button
              onClick={() => showDeleteConfirm && handleDeleteNote(showDeleteConfirm)}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}