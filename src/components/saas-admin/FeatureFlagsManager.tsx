/**
 * Feature Flags Manager
 *
 * Allows admins to manage per-organization feature overrides
 */

import { useState } from 'react';
import { Settings2, Plus, Trash2, Search, Building2, Check, X, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CustomerWithDetails, OrganizationFeatureFlag, FeatureKey } from '@/lib/types/saasAdmin';
import { setFeatureFlag, deleteFeatureFlag } from '@/lib/services/saasAdminService';
import { toast } from 'sonner';

interface FeatureFlagsManagerProps {
  customers: CustomerWithDetails[];
  onRefresh: () => void;
}

const availableFeatures: { key: FeatureKey; label: string; description: string }[] = [
  { key: 'analytics', label: 'Analytics', description: 'Access to analytics dashboard' },
  { key: 'team_insights', label: 'Team Insights', description: 'Team performance analytics' },
  { key: 'api_access', label: 'API Access', description: 'REST API access' },
  { key: 'custom_branding', label: 'Custom Branding', description: 'Custom logo and colors' },
  { key: 'priority_support', label: 'Priority Support', description: 'Priority support queue' },
  { key: 'beta_features', label: 'Beta Features', description: 'Access to beta features' },
  { key: 'advanced_ai', label: 'Advanced AI', description: 'Advanced AI capabilities' },
  { key: 'unlimited_storage', label: 'Unlimited Storage', description: 'No storage limits' },
];

export function FeatureFlagsManager({ customers, onRefresh }: FeatureFlagsManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // New flag form state
  const [newFeatureKey, setNewFeatureKey] = useState<FeatureKey>('beta_features');
  const [newEnabled, setNewEnabled] = useState(true);
  const [newReason, setNewReason] = useState('');
  const [newExpires, setNewExpires] = useState('');

  // Get all feature flags across all customers
  const allFlags = customers.flatMap((c) =>
    c.feature_flags.map((f) => ({ ...f, customer: c }))
  );

  // Filter flags by search query
  const filteredFlags = allFlags.filter(
    (f) =>
      f.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.feature_key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter customers by search for dropdown
  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  async function handleAddFlag() {
    if (!selectedOrg) {
      toast.error('Please select an organization');
      return;
    }

    setIsSaving(true);
    try {
      await setFeatureFlag({
        org_id: selectedOrg,
        feature_key: newFeatureKey,
        is_enabled: newEnabled,
        override_reason: newReason || undefined,
        expires_at: newExpires || null,
      });
      toast.success('Feature flag added');
      setIsAdding(false);
      resetForm();
      onRefresh();
    } catch (error) {
      console.error('Error adding flag:', error);
      toast.error('Failed to add feature flag');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteFlag(orgId: string, featureKey: string) {
    if (!confirm('Are you sure you want to delete this feature override?')) return;

    try {
      await deleteFeatureFlag(orgId, featureKey);
      toast.success('Feature flag deleted');
      onRefresh();
    } catch (error) {
      console.error('Error deleting flag:', error);
      toast.error('Failed to delete feature flag');
    }
  }

  async function handleToggleFlag(flag: OrganizationFeatureFlag & { customer: CustomerWithDetails }) {
    try {
      await setFeatureFlag({
        org_id: flag.org_id,
        feature_key: flag.feature_key,
        is_enabled: !flag.is_enabled,
        override_reason: flag.override_reason || undefined,
        expires_at: flag.expires_at || null,
      });
      toast.success(`Feature ${!flag.is_enabled ? 'enabled' : 'disabled'}`);
      onRefresh();
    } catch (error) {
      console.error('Error toggling flag:', error);
      toast.error('Failed to update feature flag');
    }
  }

  function resetForm() {
    setSelectedOrg('');
    setNewFeatureKey('beta_features');
    setNewEnabled(true);
    setNewReason('');
    setNewExpires('');
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search feature flags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setIsAdding(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Override
        </Button>
      </div>

      {/* Feature Flags Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          <div className="col-span-3">Organization</div>
          <div className="col-span-3">Feature</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Expires</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {filteredFlags.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <Settings2 className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No feature overrides
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Add feature overrides to grant or restrict features for specific organizations.
              </p>
            </div>
          ) : (
            filteredFlags.map((flag) => {
              const featureInfo = availableFeatures.find((f) => f.key === flag.feature_key);
              const isExpired = flag.expires_at && new Date(flag.expires_at) < new Date();

              return (
                <div
                  key={`${flag.org_id}-${flag.feature_key}`}
                  className={cn(
                    'grid grid-cols-12 gap-4 px-4 py-4 items-center',
                    isExpired && 'opacity-50'
                  )}
                >
                  {/* Organization */}
                  <div className="col-span-3 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {flag.customer.name}
                    </span>
                  </div>

                  {/* Feature */}
                  <div className="col-span-3">
                    <p className="font-medium text-gray-700 dark:text-gray-300">
                      {featureInfo?.label || flag.feature_key}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {featureInfo?.description}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="col-span-2">
                    <button
                      onClick={() => handleToggleFlag(flag)}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                        flag.is_enabled
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                      )}
                    >
                      {flag.is_enabled ? (
                        <>
                          <Check className="w-3 h-3" />
                          Enabled
                        </>
                      ) : (
                        <>
                          <X className="w-3 h-3" />
                          Disabled
                        </>
                      )}
                    </button>
                  </div>

                  {/* Expires */}
                  <div className="col-span-2">
                    {flag.expires_at ? (
                      <span
                        className={cn(
                          'text-sm',
                          isExpired
                            ? 'text-red-500'
                            : 'text-gray-600 dark:text-gray-400'
                        )}
                      >
                        {isExpired ? 'Expired ' : ''}
                        {new Date(flag.expires_at).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">Never</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex justify-end">
                    <button
                      onClick={() => handleDeleteFlag(flag.org_id, flag.feature_key)}
                      className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Flag Modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Add Feature Override
              </h2>
              <button
                onClick={() => {
                  setIsAdding(false);
                  resetForm();
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Organization */}
              <div className="space-y-2">
                <Label>Organization</Label>
                <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCustomers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Feature */}
              <div className="space-y-2">
                <Label>Feature</Label>
                <Select
                  value={newFeatureKey}
                  onValueChange={(v) => setNewFeatureKey(v as FeatureKey)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFeatures.map((feature) => (
                      <SelectItem key={feature.key} value={feature.key}>
                        {feature.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {availableFeatures.find((f) => f.key === newFeatureKey)?.description}
                </p>
              </div>

              {/* Enabled */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enabled</Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Override the plan default for this feature
                  </p>
                </div>
                <Switch checked={newEnabled} onCheckedChange={setNewEnabled} />
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label>Reason (optional)</Label>
                <Input
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="Why is this override needed?"
                />
              </div>

              {/* Expires */}
              <div className="space-y-2">
                <Label>Expires (optional)</Label>
                <Input
                  type="date"
                  value={newExpires}
                  onChange={(e) => setNewExpires(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAdding(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleAddFlag} disabled={isSaving || !selectedOrg}>
                {isSaving ? 'Adding...' : 'Add Override'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FeatureFlagsManager;
