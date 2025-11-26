/**
 * Customer Detail Modal
 *
 * Modal for viewing and editing customer details, subscription, and modules
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Check, X, Copy } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  email: string;
  domain: string;
  plan: 'starter' | 'pro' | 'enterprise';
  status: 'active' | 'trial' | 'suspended' | 'canceled';
  modules: number;
  monthlyRevenue: number;
  createdAt: string;
  trialEndsAt?: string;
  apiKey?: string;
  totalTokensUsed?: number;
  monthlyApiCalls?: number;
}

interface CustomerDetailModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (customer: Customer) => Promise<void>;
}

// Mock module data
const ALL_MODULES = [
  { id: 1, name: 'CRM Core', key: 'crm_core', enabled: true },
  { id: 2, name: 'Advanced Pipeline', key: 'advanced_pipeline', enabled: true },
  { id: 3, name: 'Calendar Integration', key: 'calendar_integration', enabled: false },
  { id: 4, name: 'AI Assistant', key: 'ai_assistant', enabled: false },
  { id: 5, name: 'Workflow Automation', key: 'workflow_automation', enabled: true },
  { id: 6, name: 'Analytics & Reporting', key: 'analytics_reporting', enabled: false },
  { id: 7, name: 'API Access', key: 'api_access', enabled: false },
  { id: 8, name: 'Custom Fields', key: 'custom_fields', enabled: false },
  { id: 9, name: 'Bulk Operations', key: 'bulk_operations', enabled: false },
  { id: 10, name: 'Compliance & Audit', key: 'compliance_audit', enabled: false },
];

const getPlanBadgeColor = (plan: string) => {
  switch (plan) {
    case 'starter':
      return 'bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-200';
    case 'pro':
      return 'bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-200';
    case 'enterprise':
      return 'bg-orange-100 dark:bg-orange-500/20 text-orange-800 dark:text-orange-200';
    default:
      return 'bg-gray-100 dark:bg-gray-500/20 text-gray-800 dark:text-gray-200';
  }
};

const getStatusBadgeColor = (status: string) => {
  switch (status) {
    case 'active':
      return 'bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-200';
    case 'trial':
      return 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-200';
    case 'suspended':
      return 'bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-200';
    case 'canceled':
      return 'bg-gray-100 dark:bg-gray-500/20 text-gray-800 dark:text-gray-200';
    default:
      return 'bg-gray-100 dark:bg-gray-500/20 text-gray-800 dark:text-gray-200';
  }
};

export default function CustomerDetailModal({
  customer,
  isOpen,
  onClose,
  onSave,
}: CustomerDetailModalProps) {
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modules, setModules] = useState(ALL_MODULES);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (customer) {
      // Reset modules based on customer's actual modules
      // This would be replaced with actual data from API
      setModules(ALL_MODULES);
    }
  }, [customer]);

  if (!customer) return null;

  const handleCopyApiKey = async () => {
    if (customer.apiKey) {
      await navigator.clipboard.writeText(customer.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleToggleModule = (moduleId: number) => {
    setModules((prev) =>
      prev.map((m) => (m.id === moduleId ? { ...m, enabled: !m.enabled } : m))
    );
  };

  const handleSave = async () => {
    if (onSave) {
      setSaving(true);
      try {
        await onSave(customer);
        setEditMode(false);
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-gray-100">Customer Details</DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-400">
            {customer.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Customer Information */}
          <Card className="border-gray-200 dark:border-gray-800/50 bg-gray-50 dark:bg-gray-800/30 p-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Company Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Company Name
                </label>
                <p className="text-gray-900 dark:text-gray-100 font-medium mt-1">{customer.name}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Domain
                </label>
                <p className="text-gray-900 dark:text-gray-100 font-medium mt-1">{customer.domain}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Email
                </label>
                <p className="text-gray-900 dark:text-gray-100 font-medium mt-1">{customer.email}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Created
                </label>
                <p className="text-gray-900 dark:text-gray-100 font-medium mt-1">{customer.createdAt}</p>
              </div>
            </div>
          </Card>

          {/* Subscription Information */}
          <Card className="border-gray-200 dark:border-gray-800/50 bg-gray-50 dark:bg-gray-800/30 p-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Subscription</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Plan
                </label>
                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${getPlanBadgeColor(customer.plan)}`}>
                  {customer.plan.charAt(0).toUpperCase() + customer.plan.slice(1)}
                </span>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </label>
                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${getStatusBadgeColor(customer.status)}`}>
                  {customer.status.charAt(0).toUpperCase() + customer.status.slice(1)}
                </span>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Monthly Revenue
                </label>
                <p className="text-gray-900 dark:text-gray-100 font-medium mt-1">
                  ${customer.monthlyRevenue.toLocaleString()}
                </p>
              </div>
              {customer.status === 'trial' && customer.trialEndsAt && (
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Trial Ends
                  </label>
                  <p className="text-gray-900 dark:text-gray-100 font-medium mt-1">{customer.trialEndsAt}</p>
                </div>
              )}
            </div>
          </Card>

          {/* API Key */}
          <Card className="border-gray-200 dark:border-gray-800/50 bg-gray-50 dark:bg-gray-800/30 p-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">API Key</h3>
            <div className="flex items-center gap-2">
              <Input
                value={customer.apiKey || 'sk_••••••••••••••••••••'}
                readOnly
                className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-mono text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyApiKey}
                className="flex items-center gap-2 border-gray-200 dark:border-gray-700"
              >
                <Copy className="h-4 w-4" />
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </Card>

          {/* Usage Statistics */}
          <Card className="border-gray-200 dark:border-gray-800/50 bg-gray-50 dark:bg-gray-800/30 p-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Usage</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  API Calls (This Month)
                </label>
                <p className="text-gray-900 dark:text-gray-100 font-medium mt-1">
                  {(customer.monthlyApiCalls || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Tokens Used (This Month)
                </label>
                <p className="text-gray-900 dark:text-gray-100 font-medium mt-1">
                  {(customer.totalTokensUsed || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </Card>

          {/* Feature Modules */}
          <Card className="border-gray-200 dark:border-gray-800/50 bg-gray-50 dark:bg-gray-800/30 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Feature Modules</h3>
              {!editMode && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditMode(true)}
                  className="border-gray-200 dark:border-gray-700"
                >
                  Edit
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {modules.map((module) => (
                <div
                  key={module.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
                >
                  {editMode ? (
                    <input
                      type="checkbox"
                      checked={module.enabled}
                      onChange={() => handleToggleModule(module.id)}
                      className="w-4 h-4 rounded cursor-pointer accent-orange-500"
                    />
                  ) : (
                    <>
                      {module.enabled ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <X className="h-4 w-4 text-gray-400" />
                      )}
                    </>
                  )}
                  <span className={`flex-1 text-sm font-medium ${module.enabled ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-500'}`}>
                    {module.name}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-gray-200 dark:border-gray-700">
            {editMode ? 'Cancel' : 'Close'}
          </Button>
          {editMode && (
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
