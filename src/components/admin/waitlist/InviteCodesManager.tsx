/**
 * InviteCodesManager - Admin component for managing signup invite codes
 * Allows admins to view, create, edit, and deactivate invite codes
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Check,
  X,
  Copy,
  RefreshCw,
  Key,
  Users,
  Calendar,
  ToggleLeft,
  ToggleRight,
  Loader2,
} from 'lucide-react';

interface InviteCode {
  id: string;
  code: string;
  description: string | null;
  is_active: boolean;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

interface InviteCodesManagerProps {
  className?: string;
}

export function InviteCodesManager({ className = '' }: InviteCodesManagerProps) {
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New code form state
  const [newCode, setNewCode] = useState('');
  const [newDescription, setNewDescription] = useState('');

  // Edit form state
  const [editDescription, setEditDescription] = useState('');

  const loadCodes = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('waitlist_invite_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCodes(data || []);
    } catch (err) {
      console.error('Error loading invite codes:', err);
      toast.error('Failed to load invite codes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCodes();
  }, [loadCodes]);

  const handleCreate = async () => {
    if (!newCode.trim()) {
      toast.error('Please enter a code');
      return;
    }

    try {
      const { error } = await supabase.from('waitlist_invite_codes').insert({
        code: newCode.trim().toUpperCase(),
        description: newDescription.trim() || null,
        is_active: true,
      });

      if (error) {
        if (error.code === '23505') {
          toast.error('This code already exists');
        } else {
          throw error;
        }
        return;
      }

      toast.success('Invite code created');
      setNewCode('');
      setNewDescription('');
      setIsCreating(false);
      loadCodes();
    } catch (err) {
      console.error('Error creating invite code:', err);
      toast.error('Failed to create invite code');
    }
  };

  const handleToggleActive = async (code: InviteCode) => {
    try {
      const { error } = await supabase
        .from('waitlist_invite_codes')
        .update({ is_active: !code.is_active })
        .eq('id', code.id);

      if (error) throw error;

      toast.success(code.is_active ? 'Code deactivated' : 'Code activated');
      loadCodes();
    } catch (err) {
      console.error('Error toggling code status:', err);
      toast.error('Failed to update code status');
    }
  };

  const handleStartEdit = (code: InviteCode) => {
    setEditingId(code.id);
    setEditDescription(code.description || '');
  };

  const handleSaveEdit = async (code: InviteCode) => {
    try {
      const { error } = await supabase
        .from('waitlist_invite_codes')
        .update({ description: editDescription.trim() || null })
        .eq('id', code.id);

      if (error) throw error;

      toast.success('Description updated');
      setEditingId(null);
      loadCodes();
    } catch (err) {
      console.error('Error updating description:', err);
      toast.error('Failed to update description');
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard');
  };

  const handleCopySignupLink = (code: string) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/auth/signup?code=${code}`;
    navigator.clipboard.writeText(link);
    toast.success('Signup link copied to clipboard');
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Calculate totals
  const totalUses = codes.reduce((sum, c) => sum + c.use_count, 0);
  const activeCodes = codes.filter((c) => c.is_active).length;

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Key className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Invite Codes
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Manage signup access codes for new users
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadCodes}
              disabled={isLoading}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              New Code
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-6 mt-4">
          <div className="flex items-center gap-2 text-sm">
            <Key className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600 dark:text-gray-400">
              {activeCodes} active / {codes.length} total
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600 dark:text-gray-400">
              {totalUses} total uses
            </span>
          </div>
        </div>
      </div>

      {/* Create New Code Form */}
      {isCreating && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              placeholder="CODE (e.g., PARTNER2024)"
              className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm uppercase"
              autoFocus
            />
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Description (optional)"
              className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Create
              </button>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewCode('');
                  setNewDescription('');
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Codes List */}
      <div className="divide-y divide-gray-200 dark:divide-gray-800">
        {isLoading ? (
          <div className="p-8 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        ) : codes.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No invite codes yet. Create one to get started.
          </div>
        ) : (
          codes.map((code) => (
            <div
              key={code.id}
              className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                !code.is_active ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono font-semibold text-gray-900 dark:text-gray-100">
                      {code.code}
                    </code>
                    <button
                      onClick={() => handleCopyCode(code.code)}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
                      title="Copy code"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleCopySignupLink(code.code)}
                      className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
                    >
                      Copy signup link
                    </button>
                    {!code.is_active && (
                      <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs font-medium">
                        Inactive
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  {editingId === code.id ? (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Description"
                        className="flex-1 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveEdit(code)}
                        className="p-1 text-green-600 hover:text-green-700 rounded transition-colors"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {code.description || 'No description'}
                      </p>
                      <button
                        onClick={() => handleStartEdit(code)}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
                        title="Edit description"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span>{code.use_count} uses</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>Created {formatDate(code.created_at)}</span>
                    </div>
                    {code.last_used_at && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>Last used {formatDate(code.last_used_at)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Toggle Active */}
                <button
                  onClick={() => handleToggleActive(code)}
                  className={`p-2 rounded-lg transition-colors ${
                    code.is_active
                      ? 'text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30'
                      : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  title={code.is_active ? 'Deactivate code' : 'Activate code'}
                >
                  {code.is_active ? (
                    <ToggleRight className="w-6 h-6" />
                  ) : (
                    <ToggleLeft className="w-6 h-6" />
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Admin Bypass Notice */}
      <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-start gap-3">
          <Key className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-0.5" />
          <div className="text-sm">
            <p className="text-purple-900 dark:text-purple-200 font-medium">
              Admin Bypass Code
            </p>
            <p className="text-purple-700 dark:text-purple-300 mt-1">
              <code className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/50 rounded font-mono">
                SIXTY60
              </code>{' '}
              is a hardcoded admin bypass code that always works. Its usage is not tracked.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
