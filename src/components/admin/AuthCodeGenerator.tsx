/**
 * Auth Code Generator Component
 * Allows admins to generate and manage authentication codes for signup
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Key, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Copy, 
  RefreshCw,
  Search,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchAuthCodes,
  createAuthCode,
  updateAuthCode,
  deleteAuthCode,
  generateRandomCode,
  type AuthCode,
  type CreateAuthCodeData
} from '@/lib/services/authCodeService';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';

export function AuthCodeGenerator() {
  const [codes, setCodes] = useState<AuthCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCode, setNewCode] = useState<CreateAuthCodeData>({
    code: '',
    description: '',
    is_active: true
  });
  const [editCode, setEditCode] = useState<Partial<AuthCode>>({});

  useEffect(() => {
    loadCodes();
  }, []);

  const loadCodes = async () => {
    try {
      setIsLoading(true);
      const data = await fetchAuthCodes();
      setCodes(data);
    } catch (error: any) {
      toast.error('Failed to load auth codes: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newCode.code.trim()) {
      toast.error('Code is required');
      return;
    }

    try {
      setIsCreating(true);
      const created = await createAuthCode(newCode);
      setCodes([created, ...codes]);
      setNewCode({ code: '', description: '', is_active: true });
      toast.success('Auth code created successfully');
    } catch (error: any) {
      toast.error('Failed to create auth code: ' + error.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      const updated = await updateAuthCode(id, {
        description: editCode.description || null,
        is_active: editCode.is_active !== undefined ? editCode.is_active : true
      });
      setCodes(codes.map(c => c.id === id ? updated : c));
      setEditingId(null);
      toast.success('Auth code updated successfully');
    } catch (error: any) {
      toast.error('Failed to update auth code: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAuthCode(id);
      setCodes(codes.filter(c => c.id !== id));
      toast.success('Auth code deleted successfully');
    } catch (error: any) {
      toast.error('Failed to delete auth code: ' + error.message);
    }
  };

  const handleGenerateRandom = () => {
    const randomCode = generateRandomCode(8);
    setNewCode({ ...newCode, code: randomCode });
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard');
  };

  const filteredCodes = codes.filter(code =>
    code.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    code.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const startEditing = (code: AuthCode) => {
    setEditingId(code.id);
    setEditCode({
      description: code.description || '',
      is_active: code.is_active
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditCode({});
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Authentication Codes</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Generate and manage codes for new user signups
          </p>
        </div>
      </div>

      {/* Create New Code Section */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Create New Code
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Code *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCode.code}
                onChange={(e) => setNewCode({ ...newCode, code: e.target.value.toUpperCase() })}
                placeholder="ABC12345"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent"
                maxLength={20}
              />
              <button
                onClick={handleGenerateRandom}
                className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                title="Generate random code"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <input
              type="text"
              value={newCode.description || ''}
              onChange={(e) => setNewCode({ ...newCode, description: e.target.value })}
              placeholder="e.g., Launch campaign"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleCreate}
              disabled={isCreating || !newCode.code.trim()}
              className="w-full px-4 py-2 bg-[#37bd7e] text-white rounded-lg hover:bg-[#2da76c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create Code
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search codes..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent"
        />
      </div>

      {/* Codes List */}
      {isLoading ? (
        <div className="text-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
          <p className="text-gray-500 mt-2">Loading codes...</p>
        </div>
      ) : filteredCodes.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
          <Key className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">No auth codes found</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Uses
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredCodes.map((code) => (
                  <tr key={code.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingId === code.id ? (
                        <input
                          type="text"
                          value={code.code}
                          disabled
                          className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-800 text-gray-500"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono font-semibold text-gray-900 dark:text-gray-100">
                            {code.code}
                          </code>
                          <button
                            onClick={() => handleCopyCode(code.code)}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                            title="Copy code"
                          >
                            <Copy className="w-4 h-4 text-gray-400" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingId === code.id ? (
                        <input
                          type="text"
                          value={editCode.description || ''}
                          onChange={(e) => setEditCode({ ...editCode, description: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        />
                      ) : (
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {code.description || '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {code.use_count}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingId === code.id ? (
                        <button
                          onClick={() => setEditCode({ ...editCode, is_active: !editCode.is_active })}
                          className="flex items-center gap-2"
                        >
                          {editCode.is_active ? (
                            <ToggleRight className="w-6 h-6 text-[#37bd7e]" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-gray-400" />
                          )}
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {editCode.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </button>
                      ) : (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          code.is_active
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                          {code.is_active ? 'Active' : 'Inactive'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {format(new Date(code.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {editingId === code.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleUpdate(code.id)}
                            className="text-[#37bd7e] hover:text-[#2da76c] transition-colors"
                            title="Save"
                          >
                            <Check className="w-5 h-5" />
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            title="Cancel"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => startEditing(code)}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button
                                className="text-red-400 hover:text-red-600 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Auth Code</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete code <strong>{code.code}</strong>? 
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(code.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
