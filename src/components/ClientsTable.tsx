import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Edit2, 
  Trash2, 
  Building2, 
  Users, 
  DollarSign,
  Filter,
  X,
  Search,
  Download,
  Calendar,
  Mail,
  Phone,
  CheckCircle,
  PauseCircle,
  XCircle,
  AlertCircle,
  UserCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useClients, ClientWithRelationships, ClientStatus } from '@/lib/hooks/useClients';
import { useUser } from '@/lib/hooks/useUser';
import { format } from 'date-fns';

interface ClientsTableProps {
  className?: string;
}

export function ClientsTable({ className }: ClientsTableProps) {
  const { userData } = useUser();
  const { clients, isLoading, updateClient, deleteClient, refreshClients } = useClients(userData?.id);
  
  // UI State
  const [editingClient, setEditingClient] = useState<ClientWithRelationships | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter state
  const [filters, setFilters] = useState({
    searchQuery: '',
    status: undefined as ClientStatus | undefined,
    minMRR: undefined as number | undefined,
    maxMRR: undefined as number | undefined,
  });

  // Edit form state
  const [editForm, setEditForm] = useState({
    subscription_amount: 0,
    status: 'active' as ClientStatus,
    contact_name: '',
    contact_email: '',
    churn_date: '',
  });

  useEffect(() => {
    if (userData?.id) {
      refreshClients();
    }
  }, [userData?.id, refreshClients]);

  // Filter clients
  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      const matchesSearch = !filters.searchQuery || 
        client.company_name?.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
        client.contact_name?.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
        client.contact_email?.toLowerCase().includes(filters.searchQuery.toLowerCase());
      
      const matchesStatus = !filters.status || client.status === filters.status;
      
      const matchesMinMRR = !filters.minMRR || client.subscription_amount >= filters.minMRR;
      const matchesMaxMRR = !filters.maxMRR || client.subscription_amount <= filters.maxMRR;
      
      return matchesSearch && matchesStatus && matchesMinMRR && matchesMaxMRR;
    });
  }, [clients, filters]);

  // Status styling
  const getStatusColor = (status: ClientStatus) => {
    switch (status) {
      case 'active':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'subscribed':
        return 'text-green-400 bg-green-500/10 border-green-500/20';
      case 'signed':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'deposit_paid':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'churned':
        return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'paused':
        return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
      case 'notice_given':
        return 'text-red-400 bg-red-500/10 border-red-500/20';
      default:
        return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  };

  const getStatusIcon = (status: ClientStatus) => {
    switch (status) {
      case 'active':
        return CheckCircle;
      case 'subscribed':
        return CheckCircle;
      case 'signed':
        return UserCheck;
      case 'deposit_paid':
        return DollarSign;
      case 'churned':
        return XCircle;
      case 'paused':
        return PauseCircle;
      case 'notice_given':
        return AlertCircle;
      default:
        return AlertCircle;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', { 
      style: 'currency', 
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const handleEdit = (client: ClientWithRelationships) => {
    setEditingClient(client);
    setEditForm({
      subscription_amount: client.subscription_amount,
      status: client.status,
      contact_name: client.contact_name || '',
      contact_email: client.contact_email || '',
      churn_date: client.churn_date || '',
    });
  };

  const handleSave = async () => {
    if (!editingClient) return;

    const updates: any = {
      subscription_amount: editForm.subscription_amount,
      status: editForm.status,
      contact_name: editForm.contact_name || null,
      contact_email: editForm.contact_email || null,
    };

    // Handle churn date logic
    if (editForm.status === 'churned') {
      updates.churn_date = editForm.churn_date || new Date().toISOString();
    } else if (editForm.status === 'active' && editingClient.status === 'churned') {
      // Reactivating a churned client
      updates.churn_date = null;
    }

    const success = await updateClient(editingClient.id, updates);
    if (success) {
      setEditingClient(null);
    }
  };

  const handleDeleteClick = (id: string) => {
    setClientToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!clientToDelete) return;
    
    const success = await deleteClient(clientToDelete);
    if (success) {
      setDeleteDialogOpen(false);
      setClientToDelete(null);
    }
  };

  const resetFilters = () => {
    setFilters({
      searchQuery: '',
      status: undefined,
      minMRR: undefined,
      maxMRR: undefined,
    });
  };

  if (isLoading) {
    return (
      <div className={cn("bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800/50", className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-700 rounded w-1/4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header and Filters */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Subscription Clients</h2>
            <p className="text-sm text-gray-400">
              Manage your subscription clients and MRR
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="bg-gray-800/50 border-gray-700/50 text-white hover:bg-gray-700/50"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
            {(filters.status || filters.searchQuery || filters.minMRR || filters.maxMRR) && (
              <span className="ml-2 bg-emerald-500 text-white text-xs rounded-full px-2 py-0.5">
                Active
              </span>
            )}
          </Button>
        </div>

        {/* Filter Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800/50 space-y-4">
                {/* Search */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search company, contact, or email..."
                      value={filters.searchQuery}
                      onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                      className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Filter Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Status Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Status</label>
                    <select
                      value={filters.status || 'all'}
                      onChange={(e) => setFilters(prev => ({ 
                        ...prev, 
                        status: e.target.value === 'all' ? undefined : e.target.value as ClientStatus 
                      }))}
                      className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="all">All Statuses</option>
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="churned">Churned</option>
                    </select>
                  </div>

                  {/* MRR Range */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Min MRR (£)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={filters.minMRR || ''}
                      onChange={(e) => setFilters(prev => ({ 
                        ...prev, 
                        minMRR: e.target.value ? parseFloat(e.target.value) : undefined 
                      }))}
                      className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Max MRR (£)</label>
                    <input
                      type="number"
                      placeholder="10000"
                      value={filters.maxMRR || ''}
                      onChange={(e) => setFilters(prev => ({ 
                        ...prev, 
                        maxMRR: e.target.value ? parseFloat(e.target.value) : undefined 
                      }))}
                      className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Clear Filters */}
                {(filters.status || filters.searchQuery || filters.minMRR || filters.maxMRR) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="text-gray-400 hover:text-white"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Clear All Filters
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Table */}
      <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Company</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">MRR</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Start Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client, index) => {
                const StatusIcon = getStatusIcon(client.status);
                return (
                  <motion.tr
                    key={client.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                      duration: 0.2,
                      delay: index * 0.02
                    }}
                    className="border-b border-gray-800/50 hover:bg-gray-800/20"
                  >
                    {/* Company */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gray-800/50 flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-gray-400" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">{client.company_name}</div>
                          <div className="text-xs text-gray-400">
                            {client.subscription_days} days active
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <div className="text-sm text-white">{client.contact_name || 'No contact'}</div>
                        {client.contact_email && (
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Mail className="w-3 h-3" />
                            {client.contact_email}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* MRR */}
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-white">
                        {formatCurrency(client.subscription_amount)}
                      </div>
                      <div className="text-xs text-gray-400">per month</div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
                        getStatusColor(client.status)
                      )}>
                        <StatusIcon className="w-3 h-3" />
                        {client.status}
                      </div>
                    </td>

                    {/* Start Date */}
                    <td className="px-4 py-3">
                      <div className="text-sm text-white">
                        {client.subscription_start_date 
                          ? format(new Date(client.subscription_start_date), 'MMM d, yyyy')
                          : 'Not set'
                        }
                      </div>
                      {client.churn_date && (
                        <div className="text-xs text-red-400">
                          Churned: {format(new Date(client.churn_date), 'MMM d, yyyy')}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleEdit(client)}
                          className="p-2 hover:bg-emerald-500/20 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4 text-gray-400 hover:text-emerald-500" />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleDeleteClick(client.id)}
                          className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                        </motion.button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
          
          {filteredClients.length === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-400">
                {clients.length === 0 ? 'No subscription clients found.' : 'No clients match your filters.'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
        <DialogContent className="bg-gray-900/95 backdrop-blur-xl border-gray-800/50 text-white p-6 rounded-xl">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
          </DialogHeader>
          
          {editingClient && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-300">Company</label>
                <div className="text-sm text-white bg-gray-800/50 px-3 py-2 rounded-lg">
                  {editingClient.company_name}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-300">Contact Name</label>
                  <input
                    type="text"
                    value={editForm.contact_name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, contact_name: e.target.value }))}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300">Contact Email</label>
                  <input
                    type="email"
                    value={editForm.contact_email}
                    onChange={(e) => setEditForm(prev => ({ ...prev, contact_email: e.target.value }))}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-300">Monthly Amount (£)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.subscription_amount}
                    onChange={(e) => setEditForm(prev => ({ ...prev, subscription_amount: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value as ClientStatus }))}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="churned">Churned</option>
                  </select>
                </div>
              </div>

              {editForm.status === 'churned' && (
                <div>
                  <label className="text-sm font-medium text-gray-300">Churn Date</label>
                  <input
                    type="date"
                    value={editForm.churn_date ? editForm.churn_date.split('T')[0] : ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, churn_date: e.target.value }))}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEditingClient(null)}
              className="bg-gray-800/50 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-gray-900/95 backdrop-blur-xl border-gray-800/50 text-white p-6 rounded-xl">
          <DialogHeader>
            <DialogTitle>Delete Client</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-400">
              Are you sure you want to delete this subscription client? This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteDialogOpen(false)}
              className="bg-gray-800/50 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
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