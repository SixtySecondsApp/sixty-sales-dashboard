/**
 * Admin Health Rules Configuration Page
 *
 * Allows admins to configure deal health monitoring rules and thresholds
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { useAuth } from '@/lib/contexts/AuthContext';
import { isUserAdmin } from '@/lib/utils/adminUtils';
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import type { DealHealthRule } from '@/lib/services/dealHealthAlertService';

export default function HealthRulesPage() {
  const { user } = useAuth();
  const [rules, setRules] = useState<DealHealthRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<DealHealthRule | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Check admin access
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      if (user) {
        const admin = await isUserAdmin(user.id);
        setIsAdmin(admin);
      }
    };
    checkAdmin();
  }, [user]);

  // Fetch rules
  const fetchRules = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('deal_health_rules')
        .select('*')
        .order('rule_type')
        .order('created_at');

      if (error) throw error;

      setRules(data || []);
    } catch (error) {
      toast.error('Failed to load health rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  // Toggle rule active status
  const toggleRuleActive = async (ruleId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('deal_health_rules')
        .update({ is_active: !currentStatus })
        .eq('id', ruleId);

      if (error) throw error;

      toast.success(`Rule ${!currentStatus ? 'activated' : 'deactivated'}`);
      fetchRules();
    } catch (error) {
      toast.error('Failed to toggle rule');
    }
  };

  // Delete rule
  const deleteRule = async (ruleId: string, isSystemRule: boolean) => {
    if (isSystemRule) {
      toast.error('System rules cannot be deleted');
      return;
    }

    if (!confirm('Are you sure you want to delete this rule?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('deal_health_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;

      toast.success('Rule deleted');
      fetchRules();
    } catch (error) {
      toast.error('Failed to delete rule');
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Admin Access Required
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            You need administrator privileges to access health rule configuration.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Deal Health Rules
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Configure thresholds and rules for deal health monitoring
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Rule
        </button>
      </div>

      {/* Rules List */}
      <div className="space-y-4">
        {rules.map((rule) => (
          <RuleCard
            key={rule.id}
            rule={rule}
            onToggleActive={() => toggleRuleActive(rule.id, rule.is_active)}
            onEdit={() => setEditingRule(rule)}
            onDelete={() => deleteRule(rule.id, rule.is_system_rule)}
          />
        ))}
      </div>

      {/* Edit Modal */}
      {editingRule && (
        <RuleEditModal
          rule={editingRule}
          onClose={() => setEditingRule(null)}
          onSave={() => {
            setEditingRule(null);
            fetchRules();
          }}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <RuleEditModal
          rule={null}
          onClose={() => setShowCreateModal(false)}
          onSave={() => {
            setShowCreateModal(false);
            fetchRules();
          }}
        />
      )}
    </div>
  );
}

// =====================================================
// Rule Card Component
// =====================================================

interface RuleCardProps {
  rule: DealHealthRule;
  onToggleActive: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function RuleCard({ rule, onToggleActive, onEdit, onDelete }: RuleCardProps) {
  const ruleTypeColors = {
    stage_velocity: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
    sentiment: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    engagement: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    activity: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    response_time: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  };

  const severityColors = {
    critical: 'text-red-600 dark:text-red-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    info: 'text-blue-600 dark:text-blue-400',
  };

  return (
    <div className={`rounded-lg border ${rule.is_active ? 'border-gray-300 dark:border-gray-600' : 'border-gray-200 dark:border-gray-700 opacity-60'} bg-white dark:bg-gray-800 p-4`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Rule name and type */}
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {rule.rule_name}
            </h3>
            <span className={`px-2 py-1 rounded text-xs font-medium ${ruleTypeColors[rule.rule_type]}`}>
              {rule.rule_type.replace(/_/g, ' ')}
            </span>
            {rule.is_system_rule && (
              <span className="px-2 py-1 rounded text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                System Rule
              </span>
            )}
          </div>

          {/* Description */}
          {rule.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              {rule.description}
            </p>
          )}

          {/* Threshold */}
          <div className="flex items-center gap-4 text-sm mb-2">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Threshold: </span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {rule.threshold_operator} {rule.threshold_value} {rule.threshold_unit}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Severity: </span>
              <span className={`font-medium ${severityColors[rule.alert_severity]}`}>
                {rule.alert_severity}
              </span>
            </div>
          </div>

          {/* Alert template */}
          {rule.alert_message_template && (
            <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900/50 rounded text-xs text-gray-700 dark:text-gray-300">
              <span className="font-medium">Alert: </span>
              {rule.alert_message_template}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={onToggleActive}
            className={`p-2 rounded-lg transition-colors ${
              rule.is_active
                ? 'text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20'
                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title={rule.is_active ? 'Deactivate' : 'Activate'}
          >
            {rule.is_active ? (
              <ToggleRight className="h-5 w-5" />
            ) : (
              <ToggleLeft className="h-5 w-5" />
            )}
          </button>

          <button
            onClick={onEdit}
            className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 transition-colors"
            title="Edit"
          >
            <Edit2 className="h-5 w-5" />
          </button>

          {!rule.is_system_rule && (
            <button
              onClick={onDelete}
              className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
              title="Delete"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// =====================================================
// Rule Edit Modal
// =====================================================

interface RuleEditModalProps {
  rule: DealHealthRule | null;
  onClose: () => void;
  onSave: () => void;
}

function RuleEditModal({ rule, onClose, onSave }: RuleEditModalProps) {
  const [formData, setFormData] = useState({
    rule_name: rule?.rule_name || '',
    rule_type: rule?.rule_type || 'stage_velocity',
    description: rule?.description || '',
    threshold_value: rule?.threshold_value || 0,
    threshold_operator: rule?.threshold_operator || '>=',
    threshold_unit: rule?.threshold_unit || 'days',
    alert_severity: rule?.alert_severity || 'warning',
    alert_message_template: rule?.alert_message_template || '',
    suggested_action_template: rule?.suggested_action_template || '',
    is_active: rule?.is_active ?? true,
  });

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);

      if (rule) {
        // Update existing rule
        const { error } = await supabase
          .from('deal_health_rules')
          .update(formData)
          .eq('id', rule.id);

        if (error) throw error;
        toast.success('Rule updated successfully');
      } else {
        // Create new rule
        const { error } = await supabase
          .from('deal_health_rules')
          .insert(formData);

        if (error) throw error;
        toast.success('Rule created successfully');
      }

      onSave();
    } catch (error) {
      toast.error('Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {rule ? 'Edit Rule' : 'Create New Rule'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Rule Name
              </label>
              <input
                type="text"
                value={formData.rule_name}
                onChange={(e) => setFormData({ ...formData, rule_name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                placeholder="e.g., Stage Stall Warning"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Rule Type
                </label>
                <select
                  value={formData.rule_type}
                  onChange={(e) => setFormData({ ...formData, rule_type: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                >
                  <option value="stage_velocity">Stage Velocity</option>
                  <option value="sentiment">Sentiment</option>
                  <option value="engagement">Engagement</option>
                  <option value="activity">Activity</option>
                  <option value="response_time">Response Time</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Severity
                </label>
                <select
                  value={formData.alert_severity}
                  onChange={(e) => setFormData({ ...formData, alert_severity: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                rows={2}
                placeholder="Describe when this rule applies..."
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Operator
                </label>
                <select
                  value={formData.threshold_operator}
                  onChange={(e) => setFormData({ ...formData, threshold_operator: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                >
                  <option value=">">{'>'}</option>
                  <option value=">=">{'≥'}</option>
                  <option value="<">{'<'}</option>
                  <option value="<=">{'≤'}</option>
                  <option value="=">=</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Value
                </label>
                <input
                  type="number"
                  value={formData.threshold_value}
                  onChange={(e) => setFormData({ ...formData, threshold_value: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Unit
                </label>
                <input
                  type="text"
                  value={formData.threshold_unit || ''}
                  onChange={(e) => setFormData({ ...formData, threshold_unit: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  placeholder="days"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Alert Message Template
              </label>
              <textarea
                value={formData.alert_message_template}
                onChange={(e) => setFormData({ ...formData, alert_message_template: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono text-sm"
                rows={3}
                placeholder="Use {{deal_name}}, {{stage}}, {{days_in_stage}}, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Suggested Action Template
              </label>
              <textarea
                value={formData.suggested_action_template}
                onChange={(e) => setFormData({ ...formData, suggested_action_template: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono text-sm"
                rows={2}
                placeholder="Suggested action for the rep to take..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !formData.rule_name}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Rule'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
