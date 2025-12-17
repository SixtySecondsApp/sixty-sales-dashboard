import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useViewMode } from '@/contexts/ViewModeContext';
import {
  Users as UsersIcon,
  Shield,
  UserCog,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Download,
  Edit2,
  UserPlus,
  Star,
  Target,
  UserCheck,
  Trash2,
  PlusCircle
} from 'lucide-react';
import { useUsers } from '@/lib/hooks/useUsers';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';

import { USER_STAGES } from '@/lib/hooks/useUser';
import { format, parseISO } from 'date-fns';
import { User } from '@/lib/hooks/useUsers';
import logger from '@/lib/utils/logger';

export default function Users() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedStage, setSelectedStage] = useState('all');
  const [editingUser, setEditingUser] = useState<User | null | { isNew?: boolean; editingTargets?: boolean }>(null);
  const [modalTargets, setModalTargets] = useState<Target[]>([]);
  const { users, updateUser, impersonateUser, deleteUser } = useUsers();
  const { startViewMode } = useViewMode();
  const navigate = useNavigate();

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch =
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.last_name?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStage = selectedStage === 'all' || user.stage === selectedStage;

      return matchesSearch && matchesStage;
    });
  }, [users, searchQuery, selectedStage]);

  useEffect(() => {
    if (editingUser?.editingTargets && Array.isArray(editingUser.targets)) {
      setModalTargets(JSON.parse(JSON.stringify(editingUser.targets)));
    } else if (editingUser?.editingTargets) {
      setModalTargets([]);
    }
  }, [editingUser]);

  const handleModalTargetChange = (index: number, field: string, value: string) => {
    setModalTargets(currentTargets => {
      const updatedTargets = [...currentTargets];
      if (!updatedTargets[index]) {
        updatedTargets[index] = { id: undefined };
      }
      const parsedValue = value === '' ? null : (field.includes('target') ? (field === 'revenue_target' ? parseFloat(value) : parseInt(value)) : value);

      updatedTargets[index] = {
        ...updatedTargets[index],
        [field]: parsedValue
      };
      return updatedTargets;
    });
  };

  const addTargetSet = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setModalTargets(currentTargets => [
      ...currentTargets,
      {
        id: `new_${Date.now()}`,
        revenue_target: null,
        outbound_target: null,
        meetings_target: null,
        proposal_target: null,
        start_date: today,
        end_date: null
      }
    ]);
  };

  const removeTargetSet = (index: number) => {
    setModalTargets(currentTargets => currentTargets.filter((_, i) => i !== index));
  };

  const handleUpdateUser = async (userId: string, updates: Partial<User>) => {
    if (!userId) {
      logger.error("handleUpdateUser called without userId");
      toast.error("Cannot update user: User ID missing.");
      return;
    }
    try {
      await updateUser({ userId, updates });
      setEditingUser(null);
      setModalTargets([]);
    } catch (error) {
      logger.error('Update error in component:', error);
    }
  };

  const handleViewAs = (user: User) => {
    // Use the new View As mode instead of impersonation
    startViewMode({
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      full_name: user.full_name
    });
    toast.success(`Now viewing as ${user.email}`);
    navigate('/');
  };

  const handleExport = () => {
    type ExportRow = {
      'First Name': string | null;
      'Last Name': string | null;
      'Email': string;
      'Stage': string;
      'Internal': string;
      'Admin': string;
      'Created': string;
    };

    const data: ExportRow[] = filteredUsers.map(user => ({
      'First Name': user.first_name,
      'Last Name': user.last_name,
      'Email': user.email,
      'Stage': user.stage,
      'Internal': user.is_internal ? 'Yes' : 'No',
      'Admin': user.is_admin ? 'Yes' : 'No',
      'Created': new Date(user.created_at).toLocaleDateString()
    }));

    const headers: (keyof ExportRow)[] = Object.keys(data[0] || {}) as (keyof ExportRow)[];
    const csvContent = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header =>
          JSON.stringify(row[header] || '')
        ).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `users_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Export completed successfully');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 mt-12 lg:mt-0 min-h-screen bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">User Management</h1>
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">Manage users, roles, and permissions</p>
          </div>
          <button
            onClick={() => setEditingUser({ isNew: true })}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#37bd7e]/10 text-[#37bd7e] hover:bg-[#37bd7e]/20 transition-all duration-300 text-sm border border-[#37bd7e]/30 hover:border-[#37bd7e]/50"
          >
            <UserPlus className="w-4 h-4" />
            Add User
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-900/80 backdrop-blur-sm rounded-xl p-4 border border-gray-200 dark:border-gray-700/50 shadow-sm dark:shadow-none">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
                <UsersIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300">Total Users</p>
                <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{users.length}</div>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900/80 backdrop-blur-sm rounded-xl p-4 border border-gray-200 dark:border-gray-700/50 shadow-sm dark:shadow-none">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20">
                <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300">Admins</p>
                <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {users.filter(u => u.is_admin).length}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900/80 backdrop-blur-sm rounded-xl p-4 border border-gray-200 dark:border-gray-700/50 shadow-sm dark:shadow-none">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
                <UserCog className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300">Internal Users</p>
                <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {users.filter(u => u.is_internal).length}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900/80 backdrop-blur-sm rounded-xl p-4 border border-gray-200 dark:border-gray-700/50 shadow-sm dark:shadow-none">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                <Star className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300">Active</p>
                <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {users.filter(u => u.last_sign_in_at).length}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white dark:bg-gray-900/80 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-gray-700/50 shadow-sm dark:shadow-none overflow-hidden">
          {/* Table Controls */}
          <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-full sm:flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg pl-10 pr-4 py-2 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:bg-[#37bd7e]/20 hover:text-[#37bd7e] dark:hover:text-white transition-all duration-300 text-sm border border-gray-200 dark:border-transparent hover:border-[#37bd7e]/30"
                >
                  <Filter className="w-4 h-4" />
                  Filters
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleExport}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#37bd7e]/10 text-[#37bd7e] hover:bg-[#37bd7e]/20 transition-all duration-300 text-sm border border-[#37bd7e]/30 hover:border-[#37bd7e]/50"
                >
                  <Download className="w-4 h-4" />
                  Export
                </motion.button>
              </div>
            </div>

            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                    <select
                      className="bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-xl px-4 py-2.5 text-gray-900 dark:text-gray-100 text-sm"
                      value={selectedStage}
                      onChange={(e) => setSelectedStage(e.target.value)}
                    >
                      <option value="all">All Stages</option>
                      {USER_STAGES.map(stage => (
                        <option key={stage} value={stage}>{stage}</option>
                      ))}
                    </select>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Table */}
          <div className="overflow-x-auto min-w-[800px] lg:min-w-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  <th className="text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider px-4 sm:px-6 py-3 whitespace-nowrap">User</th>
                  <th className="text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider px-4 sm:px-6 py-3 whitespace-nowrap">Stage</th>
                  <th className="text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider px-4 sm:px-6 py-3 whitespace-nowrap">Targets</th>
                  <th className="text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider px-4 sm:px-6 py-3 whitespace-nowrap">Internal</th>
                  <th className="text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider px-4 sm:px-6 py-3 whitespace-nowrap">Admin</th>
                  <th className="text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider px-4 sm:px-6 py-3 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#37bd7e]/10 border border-[#37bd7e]/20 flex items-center justify-center">
                          {user.avatar_url ? (
                            <img
                              src={user.avatar_url}
                              alt={user.first_name}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            <span className="text-sm font-medium text-[#37bd7e]">
                              {user.first_name?.[0]}{user.last_name?.[0]}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {user.first_name} {user.last_name}
                          </div>
                          <div className="text-sm text-gray-700 dark:text-gray-300">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <select
                        value={user.stage}
                        onChange={(e) => handleUpdateUser(user.id, { stage: e.target.value })}
                        className="bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg px-3 py-1 text-sm text-gray-900 dark:text-gray-100"
                      >
                        {USER_STAGES.map(stage => (
                          <option key={stage} value={stage}>{stage}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <button
                        onClick={() => setEditingUser({ ...(user as User), editingTargets: true })}
                        className="flex items-center gap-2 px-3 py-1 rounded-lg bg-violet-500/10 text-violet-500 hover:bg-violet-500/20 transition-all duration-300 text-sm border border-violet-500/30"
                      >
                        <Target className="w-4 h-4" />
                        Edit Targets
                      </button>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <button
                        onClick={() => handleUpdateUser(user.id, { is_internal: !user.is_internal })}
                        className={cn(
                          "flex items-center gap-2 px-3 py-1 rounded-lg transition-all duration-300 text-sm border",
                          user.is_internal
                            ? "bg-blue-500/10 text-blue-500 border-blue-500/30 hover:bg-blue-500/20"
                            : "bg-gray-500/10 text-gray-400 border-gray-500/30 hover:bg-gray-500/20"
                        )}
                        title={user.is_internal ? 'Internal user - has full feature access' : 'External user - limited access'}
                      >
                        <UserCog className="w-4 h-4" />
                        {user.is_internal ? 'Internal' : 'External'}
                      </button>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <button
                        onClick={() => handleUpdateUser(user.id, { is_admin: !user.is_admin })}
                        className={cn(
                          "flex items-center gap-2 px-3 py-1 rounded-lg transition-all duration-300 text-sm border",
                          user.is_admin
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20"
                            : "bg-gray-500/10 text-gray-400 border-gray-500/30 hover:bg-gray-500/20"
                        )}
                        title={user.is_admin ? 'Platform admin - can manage system settings' : 'Regular user'}
                      >
                        <Shield className="w-4 h-4" />
                        {user.is_admin ? 'Admin' : 'User'}
                      </button>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleViewAs(user)}
                          className="p-2 hover:bg-violet-500/20 rounded-lg transition-colors"
                          title="View as this user"
                        >
                          <UserCheck className="w-4 h-4 text-violet-500" />
                        </button>
                        <button
                          onClick={() => setEditingUser(user)}
                          className="p-2 hover:bg-[#37bd7e]/20 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4 text-[#37bd7e]" />
                        </button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-gray-900/95 backdrop-blur-xl border border-gray-800/50">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete User</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete {user.first_name} {user.last_name}? This action cannot be undone.
                                All their activities and targets will also be deleted.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="bg-gray-800/50 text-gray-300 hover:bg-gray-800">Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteUser(user.id)}
                                className="bg-red-500 hover:bg-red-600"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-gray-900/50 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900/95 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700/50 p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
              {editingUser.isNew ? 'Add User' : (editingUser as User).editingTargets ? `Edit Targets for ${(editingUser as User).first_name}` : 'Edit User'}
            </h2>

            {(editingUser as User).editingTargets ? (
              <form onSubmit={(e) => {
                e.preventDefault();
                handleUpdateUser((editingUser as User).id, { targets: modalTargets });
              }} className="space-y-6">
                {modalTargets.map((target, index) => (
                  <div key={target.id || index} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800/20 space-y-4 relative">
                    <button
                      type="button"
                      onClick={() => removeTargetSet(index)}
                      className="absolute top-2 right-2 p-1 text-red-500 hover:bg-red-500/20 rounded"
                      aria-label="Remove target set"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Revenue Target</label>
                        <input
                          type="number"
                          placeholder="e.g., 20000"
                          value={target.revenue_target ?? ''}
                          onChange={(e) => handleModalTargetChange(index, 'revenue_target', e.target.value)}
                          className="w-full bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Outbound Target</label>
                        <input
                          type="number"
                          placeholder="e.g., 100"
                          value={target.outbound_target ?? ''}
                          onChange={(e) => handleModalTargetChange(index, 'outbound_target', e.target.value)}
                          className="w-full bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Meetings Target</label>
                        <input
                          type="number"
                          placeholder="e.g., 20"
                          value={target.meetings_target ?? ''}
                          onChange={(e) => handleModalTargetChange(index, 'meetings_target', e.target.value)}
                          className="w-full bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Proposal Target</label>
                        <input
                          type="number"
                          placeholder="e.g., 15"
                          value={target.proposal_target ?? ''}
                          onChange={(e) => handleModalTargetChange(index, 'proposal_target', e.target.value)}
                          className="w-full bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Start Date</label>
                        <input
                          type="date"
                          value={target.start_date ?? ''}
                          onChange={(e) => handleModalTargetChange(index, 'start_date', e.target.value)}
                          className="w-full bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">End Date</label>
                        <input
                          type="date"
                          value={target.end_date ?? ''}
                          onChange={(e) => handleModalTargetChange(index, 'end_date', e.target.value)}
                          className="w-full bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addTargetSet}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700/50 text-gray-500 dark:text-gray-400 hover:border-[#37bd7e]/50 hover:text-[#37bd7e] transition-colors duration-200"
                >
                  <PlusCircle className="w-4 h-4" />
                  Add New Target Set
                </button>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { setEditingUser(null); setModalTargets([]); }}
                    className="px-4 py-2 rounded-xl bg-gray-200 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#37bd7e] text-white hover:bg-[#2da76c] transition-colors"
                  >
                    Save Target Changes
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                if (editingUser.isNew) {
                  logger.warn("New user creation not implemented yet.");
                  toast.info("New user creation not implemented.");
                } else {
                  const userToUpdate = editingUser as User;
                  handleUpdateUser(userToUpdate.id, {
                    first_name: formData.get('first_name') as string,
                    last_name: formData.get('last_name') as string,
                    email: formData.get('email') as string,
                    stage: formData.get('stage') as string
                  });
                }
              }} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-400">First Name</label>
                  <input
                    type="text"
                    name="first_name"
                    defaultValue={(editingUser as User)?.first_name || ''}
                    className="w-full bg-gray-100 dark:bg-gray-800/30 border border-gray-300 dark:border-gray-700/30 rounded-xl px-4 py-2 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-400">Last Name</label>
                  <input
                    type="text"
                    name="last_name"
                    defaultValue={(editingUser as User)?.last_name || ''}
                    className="w-full bg-gray-100 dark:bg-gray-800/30 border border-gray-300 dark:border-gray-700/30 rounded-xl px-4 py-2 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-400">Email</label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={(editingUser as User)?.email || ''}
                    className="w-full bg-gray-100 dark:bg-gray-800/30 border border-gray-300 dark:border-gray-700/30 rounded-xl px-4 py-2 text-gray-900 dark:text-white"
                    readOnly={!editingUser.isNew}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-400">Stage</label>
                  <select
                    name="stage"
                    defaultValue={(editingUser as User)?.stage || USER_STAGES[0]}
                    className="w-full bg-gray-100 dark:bg-gray-800/30 border border-gray-300 dark:border-gray-700/30 rounded-xl px-4 py-2 text-gray-900 dark:text-white"
                  >
                    {USER_STAGES.map(stage => (
                      <option key={stage} value={stage}>{stage}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2 rounded-xl bg-gray-200 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#37bd7e] text-white hover:bg-[#2da76c] transition-colors"
                  >
                    {editingUser.isNew ? 'Create User' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}