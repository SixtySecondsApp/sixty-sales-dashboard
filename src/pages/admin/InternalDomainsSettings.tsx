/**
 * Internal Domains Settings (Admin Only)
 *
 * Allows admins to configure which email domains are considered "internal"
 * for the user type system. Users with emails from these domains get full
 * access to the CRM, admin features, and can toggle "View as External" mode.
 */

import { useState, useEffect } from 'react';
import { Plus, Trash2, Globe, Shield, AlertTriangle, Check, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/clientV2';
import { cn } from '@/lib/utils';

interface InternalDomain {
  id: string;
  domain: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
}

export default function InternalDomainsSettings() {
  const [domains, setDomains] = useState<InternalDomain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // New domain form
  const [newDomain, setNewDomain] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Load domains on mount
  useEffect(() => {
    loadDomains();
  }, []);

  async function loadDomains() {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('internal_email_domains')
        .select('*')
        .order('domain');

      if (error) {
        // If table doesn't exist yet, show empty state
        if (error.code === '42P01') {
          setDomains([]);
          return;
        }
        throw error;
      }

      setDomains(data || []);
    } catch (error) {
      console.error('Error loading domains:', error);
      // Show default domain if table doesn't exist
      setDomains([{
        id: 'default',
        domain: 'sixtyseconds.video',
        description: 'Default internal domain (hardcoded)',
        is_active: true,
        created_at: new Date().toISOString(),
        created_by: null,
      }]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddDomain() {
    if (!newDomain.trim()) {
      toast.error('Please enter a domain');
      return;
    }

    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(newDomain.trim())) {
      toast.error('Please enter a valid domain (e.g., company.com)');
      return;
    }

    // Check for duplicates
    if (domains.some(d => d.domain.toLowerCase() === newDomain.trim().toLowerCase())) {
      toast.error('This domain is already in the list');
      return;
    }

    setIsSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('internal_email_domains')
        .insert({
          domain: newDomain.trim().toLowerCase(),
          description: newDescription.trim() || null,
          is_active: true,
          created_by: user?.user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      setDomains([...domains, data]);
      setNewDomain('');
      setNewDescription('');
      setIsAdding(false);
      toast.success('Domain added successfully');
    } catch (error) {
      console.error('Error adding domain:', error);
      toast.error('Failed to add domain');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleDomain(domain: InternalDomain) {
    try {
      const { error } = await supabase
        .from('internal_email_domains')
        .update({ is_active: !domain.is_active })
        .eq('id', domain.id);

      if (error) throw error;

      setDomains(domains.map(d =>
        d.id === domain.id ? { ...d, is_active: !d.is_active } : d
      ));

      toast.success(`Domain ${!domain.is_active ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error toggling domain:', error);
      toast.error('Failed to update domain');
    }
  }

  async function handleDeleteDomain(domain: InternalDomain) {
    // Prevent deleting the last active domain
    const activeDomains = domains.filter(d => d.is_active && d.id !== domain.id);
    if (domain.is_active && activeDomains.length === 0) {
      toast.error('Cannot delete the last active domain. At least one internal domain is required.');
      return;
    }

    if (!confirm(`Are you sure you want to delete "${domain.domain}"? Users with this email domain will be treated as external users.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('internal_email_domains')
        .delete()
        .eq('id', domain.id);

      if (error) throw error;

      setDomains(domains.filter(d => d.id !== domain.id));
      toast.success('Domain deleted');
    } catch (error) {
      console.error('Error deleting domain:', error);
      toast.error('Failed to delete domain');
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-1/3" />
        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-2/3" />
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-16 bg-gray-200 dark:bg-gray-800 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-500" />
            Internal Email Domains
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Configure which email domains are treated as internal team members.
            Users with these email domains get full CRM access and can toggle "View as External" mode.
          </p>
        </div>
        <Button onClick={() => setIsAdding(true)} disabled={isAdding}>
          <Plus className="w-4 h-4 mr-2" />
          Add Domain
        </Button>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium">How it works:</p>
            <ul className="mt-2 space-y-1 list-disc list-inside text-blue-600 dark:text-blue-400">
              <li><strong>Internal users</strong> (matching domains): Full CRM access, admin features (if admin), "View as External" toggle</li>
              <li><strong>External users</strong> (non-matching domains): Meetings features only, no CRM or admin access</li>
              <li>Changes take effect on next login or page refresh</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Add Domain Form */}
      {isAdding && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">Add Internal Domain</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Domain</Label>
              <Input
                placeholder="company.com"
                value={newDomain}
                onChange={e => setNewDomain(e.target.value)}
              />
              <p className="text-xs text-gray-500">Email domain without @ symbol</p>
            </div>

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                placeholder="e.g., Main company domain"
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setIsAdding(false);
                setNewDomain('');
                setNewDescription('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAddDomain} disabled={isSaving}>
              {isSaving ? 'Adding...' : 'Add Domain'}
            </Button>
          </div>
        </div>
      )}

      {/* Domains List */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          <div className="col-span-4">Domain</div>
          <div className="col-span-4">Description</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {domains.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <Globe className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No internal domains configured
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Add your company's email domain to enable internal user features.
              </p>
              <Button onClick={() => setIsAdding(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Domain
              </Button>
            </div>
          ) : (
            domains.map(domain => (
              <div
                key={domain.id}
                className={cn(
                  'grid grid-cols-12 gap-4 px-4 py-4 items-center',
                  !domain.is_active && 'opacity-50'
                )}
              >
                {/* Domain */}
                <div className="col-span-4 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-500" />
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    @{domain.domain}
                  </span>
                </div>

                {/* Description */}
                <div className="col-span-4">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {domain.description || '—'}
                  </span>
                </div>

                {/* Status */}
                <div className="col-span-2">
                  <button
                    onClick={() => handleToggleDomain(domain)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                      domain.is_active
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    )}
                  >
                    {domain.is_active ? (
                      <>
                        <Check className="w-3 h-3" />
                        Active
                      </>
                    ) : (
                      'Disabled'
                    )}
                  </button>
                </div>

                {/* Actions */}
                <div className="col-span-2 flex justify-end gap-2">
                  <Switch
                    checked={domain.is_active}
                    onCheckedChange={() => handleToggleDomain(domain)}
                  />
                  <button
                    onClick={() => handleDeleteDomain(domain)}
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    title="Delete domain"
                  >
                    <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Warning */}
      {domains.filter(d => d.is_active).length === 1 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-700 dark:text-amber-300">
              <p className="font-medium">Only one active domain</p>
              <p className="mt-1 text-amber-600 dark:text-amber-400">
                You have only one active internal domain. Consider adding backup domains to ensure admin access is not accidentally lost.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
