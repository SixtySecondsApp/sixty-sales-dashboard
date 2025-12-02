/**
 * Subscription Plans Manager
 *
 * Allows admins to view, create, and edit subscription plans
 */

import { useState } from 'react';
import {
  CreditCard,
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  Users,
  Video,
  Zap,
  HardDrive,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { SubscriptionPlan, CreatePlanInput, PlanFeatures } from '@/lib/types/saasAdmin';
import { createPlan, updatePlan, deletePlan } from '@/lib/services/saasAdminService';
import { toast } from 'sonner';

interface SubscriptionPlansManagerProps {
  plans: SubscriptionPlan[];
  isLoading: boolean;
  onRefresh: () => void;
}

const defaultFeatures: PlanFeatures = {
  analytics: false,
  team_insights: false,
  api_access: false,
  custom_branding: false,
  priority_support: false,
};

export function SubscriptionPlansManager({
  plans,
  isLoading,
  onRefresh,
}: SubscriptionPlansManagerProps) {
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState<CreatePlanInput>({
    name: '',
    slug: '',
    description: '',
    price_monthly: 0,
    price_yearly: 0,
    max_users: null,
    max_meetings_per_month: null,
    max_ai_tokens_per_month: null,
    max_storage_mb: null,
    features: defaultFeatures,
    is_active: true,
    is_default: false,
    display_order: plans.length + 1,
    badge_text: null,
  });

  function resetForm() {
    setFormData({
      name: '',
      slug: '',
      description: '',
      price_monthly: 0,
      price_yearly: 0,
      max_users: null,
      max_meetings_per_month: null,
      max_ai_tokens_per_month: null,
      max_storage_mb: null,
      features: defaultFeatures,
      is_active: true,
      is_default: false,
      display_order: plans.length + 1,
      badge_text: null,
    });
    setEditingPlan(null);
    setIsCreating(false);
  }

  function startEditing(plan: SubscriptionPlan) {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      slug: plan.slug,
      description: plan.description || '',
      price_monthly: plan.price_monthly,
      price_yearly: plan.price_yearly,
      max_users: plan.max_users,
      max_meetings_per_month: plan.max_meetings_per_month,
      max_ai_tokens_per_month: plan.max_ai_tokens_per_month,
      max_storage_mb: plan.max_storage_mb,
      features: plan.features,
      is_active: plan.is_active,
      is_default: plan.is_default,
      display_order: plan.display_order,
      badge_text: plan.badge_text,
    });
    setIsCreating(false);
  }

  function startCreating() {
    resetForm();
    setIsCreating(true);
  }

  async function handleSave() {
    if (!formData.name || !formData.slug) {
      toast.error('Name and slug are required');
      return;
    }

    setIsSaving(true);
    try {
      if (editingPlan) {
        await updatePlan(editingPlan.id, formData);
        toast.success('Plan updated');
      } else {
        await createPlan(formData);
        toast.success('Plan created');
      }
      resetForm();
      onRefresh();
    } catch (error) {
      console.error('Error saving plan:', error);
      toast.error('Failed to save plan');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(planId: string) {
    if (!confirm('Are you sure you want to delete this plan?')) return;

    try {
      await deletePlan(planId);
      toast.success('Plan deleted');
      onRefresh();
    } catch (error: any) {
      console.error('Error deleting plan:', error);
      if (error.message?.includes('foreign key')) {
        toast.error('Cannot delete plan with active subscriptions');
      } else {
        toast.error('Failed to delete plan');
      }
    }
  }

  function updateFeature(key: string, value: boolean) {
    setFormData((prev) => ({
      ...prev,
      features: { ...prev.features, [key]: value },
    }));
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 animate-pulse"
          >
            <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-1/2 mb-4" />
            <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-3/4 mb-4" />
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded" />
              <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded" />
              <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={cn(
              'bg-white dark:bg-gray-900 rounded-xl p-6 border-2 transition-colors',
              plan.is_default
                ? 'border-emerald-500 dark:border-emerald-400'
                : 'border-gray-200 dark:border-gray-800'
            )}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{plan.name}</h3>
                  {plan.badge_text && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full">
                      {plan.badge_text}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{plan.slug}</p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => startEditing(plan)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <Edit className="w-4 h-4 text-gray-400" />
                </button>
                <button
                  onClick={() => handleDelete(plan.id)}
                  className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                </button>
              </div>
            </div>

            {/* Price */}
            <div className="mb-4">
              <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                ${(plan.price_monthly / 100).toFixed(0)}
              </span>
              <span className="text-gray-500 dark:text-gray-400">/mo</span>
            </div>

            {/* Limits */}
            <div className="space-y-2 mb-4 text-sm">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Users className="w-4 h-4" />
                <span>{plan.max_users || '∞'} users</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Video className="w-4 h-4" />
                <span>{plan.max_meetings_per_month || '∞'} meetings/mo</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Zap className="w-4 h-4" />
                <span>{plan.max_ai_tokens_per_month?.toLocaleString() || '∞'} tokens/mo</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <HardDrive className="w-4 h-4" />
                <span>{plan.max_storage_mb?.toLocaleString() || '∞'} MB storage</span>
              </div>
            </div>

            {/* Features */}
            <div className="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-2">
              {Object.entries(plan.features).map(([key, enabled]) => (
                <div key={key} className="flex items-center gap-2 text-sm">
                  {enabled ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <X className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                  )}
                  <span
                    className={cn(
                      enabled
                        ? 'text-gray-700 dark:text-gray-300'
                        : 'text-gray-400 dark:text-gray-600'
                    )}
                  >
                    {key.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>

            {/* Status */}
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between text-xs">
                <span className={cn(plan.is_active ? 'text-emerald-600' : 'text-gray-400')}>
                  {plan.is_active ? 'Active' : 'Inactive'}
                </span>
                {plan.is_default && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <Star className="w-3 h-3" />
                    Default
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Add Plan Card */}
        <button
          onClick={startCreating}
          className="bg-white dark:bg-gray-900 rounded-xl p-6 border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-emerald-500 dark:hover:border-emerald-400 transition-colors flex flex-col items-center justify-center min-h-[300px]"
        >
          <Plus className="w-8 h-8 text-gray-400 mb-2" />
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Add New Plan</span>
        </button>
      </div>

      {/* Edit/Create Modal */}
      {(editingPlan || isCreating) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {editingPlan ? 'Edit Plan' : 'Create Plan'}
              </h2>
              <button
                onClick={resetForm}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Pro"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        slug: e.target.value.toLowerCase().replace(/\s+/g, '-'),
                      })
                    }
                    placeholder="pro"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Perfect for growing teams"
                />
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Monthly Price (cents)</Label>
                  <Input
                    type="number"
                    value={formData.price_monthly}
                    onChange={(e) =>
                      setFormData({ ...formData, price_monthly: parseInt(e.target.value) || 0 })
                    }
                    placeholder="2900"
                  />
                  <p className="text-xs text-gray-500">
                    ${((formData.price_monthly || 0) / 100).toFixed(2)}/month
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Yearly Price (cents)</Label>
                  <Input
                    type="number"
                    value={formData.price_yearly}
                    onChange={(e) =>
                      setFormData({ ...formData, price_yearly: parseInt(e.target.value) || 0 })
                    }
                    placeholder="29000"
                  />
                  <p className="text-xs text-gray-500">
                    ${((formData.price_yearly || 0) / 100).toFixed(2)}/year
                  </p>
                </div>
              </div>

              {/* Limits */}
              <div className="border-t border-gray-200 dark:border-gray-800 pt-6">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">
                  Limits (leave empty for unlimited)
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Max Users</Label>
                    <Input
                      type="number"
                      value={formData.max_users || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          max_users: e.target.value ? parseInt(e.target.value) : null,
                        })
                      }
                      placeholder="Unlimited"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Meetings/Month</Label>
                    <Input
                      type="number"
                      value={formData.max_meetings_per_month || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          max_meetings_per_month: e.target.value ? parseInt(e.target.value) : null,
                        })
                      }
                      placeholder="Unlimited"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max AI Tokens/Month</Label>
                    <Input
                      type="number"
                      value={formData.max_ai_tokens_per_month || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          max_ai_tokens_per_month: e.target.value ? parseInt(e.target.value) : null,
                        })
                      }
                      placeholder="Unlimited"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Storage (MB)</Label>
                    <Input
                      type="number"
                      value={formData.max_storage_mb || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          max_storage_mb: e.target.value ? parseInt(e.target.value) : null,
                        })
                      }
                      placeholder="Unlimited"
                    />
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="border-t border-gray-200 dark:border-gray-800 pt-6">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Features</h4>
                <div className="grid grid-cols-2 gap-4">
                  {Object.keys(defaultFeatures).map((key) => (
                    <div key={key} className="flex items-center justify-between">
                      <Label className="capitalize">{key.replace(/_/g, ' ')}</Label>
                      <Switch
                        checked={formData.features[key] || false}
                        onCheckedChange={(checked) => updateFeature(key, checked)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div className="border-t border-gray-200 dark:border-gray-800 pt-6 grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <Label>Active</Label>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Default Plan</Label>
                  <Switch
                    checked={formData.is_default}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
                  />
                </div>
              </div>

              {/* Badge */}
              <div className="space-y-2">
                <Label>Badge Text (optional)</Label>
                <Input
                  value={formData.badge_text || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, badge_text: e.target.value || null })
                  }
                  placeholder="Most Popular"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : editingPlan ? 'Update Plan' : 'Create Plan'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SubscriptionPlansManager;
