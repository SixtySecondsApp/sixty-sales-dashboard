/**
 * Admin API Keys Management
 *
 * Interface for managing API keys, permissions, rate limits, and usage
 */

import { useState } from 'react';
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
import { Search, Plus, Copy, RotateCcw, Trash2, Eye, EyeOff, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  fullKey?: string;
  permissions: string[];
  rateLimit: number;
  period: 'minute' | 'hour' | 'day' | 'month';
  status: 'active' | 'revoked' | 'expired';
  createdAt: string;
  lastUsedAt?: string;
  usageThisMonth: number;
}

// Mock API keys data
const MOCK_API_KEYS: ApiKey[] = [
  {
    id: '1',
    name: 'default',
    prefix: 'sk_dba251053e92d77ed',
    fullKey: 'sk_dba251053e92d77ed8cd3a72fb2896114f05d481386e37f7f080bea622cd7796',
    permissions: ['read:*', 'write:*', 'execute:workflows'],
    rateLimit: 1000,
    period: 'month',
    status: 'active',
    createdAt: '2025-11-26',
    lastUsedAt: '2025-11-26 14:32:00',
    usageThisMonth: 245,
  },
  {
    id: '2',
    name: 'integration-zapier',
    prefix: 'sk_8c2f4a9b1e5d7c3f',
    permissions: ['read:deals', 'write:deals', 'read:contacts'],
    rateLimit: 500,
    period: 'month',
    status: 'active',
    createdAt: '2025-11-20',
    lastUsedAt: '2025-11-25 09:15:00',
    usageThisMonth: 89,
  },
  {
    id: '3',
    name: 'webhook-processor',
    prefix: 'sk_5e9b2d1c4f7a3e6b',
    permissions: ['write:activities', 'write:tasks'],
    rateLimit: 2000,
    period: 'day',
    status: 'active',
    createdAt: '2025-11-15',
    lastUsedAt: '2025-11-26 08:45:00',
    usageThisMonth: 1243,
  },
  {
    id: '4',
    name: 'deprecated-old-key',
    prefix: 'sk_1a3b5c7d9e2f4g6h',
    permissions: ['read:*'],
    rateLimit: 100,
    period: 'month',
    status: 'revoked',
    createdAt: '2025-10-01',
    usageThisMonth: 0,
  },
];

interface NewKeyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate?: (key: Omit<ApiKey, 'id' | 'prefix' | 'fullKey' | 'usageThisMonth' | 'lastUsedAt'>) => Promise<void>;
}

function NewKeyDialog({ isOpen, onClose, onCreate }: NewKeyDialogProps) {
  const [name, setName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(['read:*']);
  const [rateLimit, setRateLimit] = useState(1000);
  const [period, setPeriod] = useState<'minute' | 'hour' | 'day' | 'month'>('month');
  const [creating, setCreating] = useState(false);

  const permissions = [
    { value: 'read:*', label: 'Read All' },
    { value: 'write:*', label: 'Write All' },
    { value: 'read:deals', label: 'Read Deals' },
    { value: 'write:deals', label: 'Write Deals' },
    { value: 'read:contacts', label: 'Read Contacts' },
    { value: 'write:contacts', label: 'Write Contacts' },
    { value: 'execute:workflows', label: 'Execute Workflows' },
  ];

  const handleCreate = async () => {
    if (!name.trim()) return;

    setCreating(true);
    try {
      if (onCreate) {
        await onCreate({
          name,
          permissions: selectedPermissions,
          rateLimit,
          period,
          status: 'active',
          createdAt: new Date().toISOString().split('T')[0],
        });
      }
      setName('');
      setSelectedPermissions(['read:*']);
      setRateLimit(1000);
      setPeriod('month');
      onClose();
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-gray-100">Create New API Key</DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-400">
            Generate a new API key for customer integrations and automations
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-900 dark:text-gray-100">Key Name</label>
            <Input
              placeholder="e.g., integration-zapier"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 block">
              Permissions
            </label>
            <div className="space-y-2">
              {permissions.map((perm) => (
                <label key={perm.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPermissions.includes(perm.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPermissions([...selectedPermissions, perm.value]);
                      } else {
                        setSelectedPermissions(selectedPermissions.filter((p) => p !== perm.value));
                      }
                    }}
                    className="w-4 h-4 rounded cursor-pointer accent-orange-500"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">{perm.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-gray-900 dark:text-gray-100">Rate Limit</label>
              <Input
                type="number"
                value={rateLimit}
                onChange={(e) => setRateLimit(parseInt(e.target.value))}
                className="mt-1 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-900 dark:text-gray-100">Period</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as any)}
                className="mt-1 w-full px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-100"
              >
                <option value="minute">Per Minute</option>
                <option value="hour">Per Hour</option>
                <option value="day">Per Day</option>
                <option value="month">Per Month</option>
              </select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-gray-200 dark:border-gray-700">
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {creating ? 'Creating...' : 'Create Key'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminApiKeys() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(MOCK_API_KEYS);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [isNewKeyDialogOpen, setIsNewKeyDialogOpen] = useState(false);

  const filteredKeys = apiKeys.filter((key) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      key.name.toLowerCase().includes(searchLower) ||
      key.prefix.toLowerCase().includes(searchLower)
    );
  });

  const toggleKeyVisibility = (keyId: string) => {
    const newVisible = new Set(visibleKeys);
    if (newVisible.has(keyId)) {
      newVisible.delete(keyId);
    } else {
      newVisible.add(keyId);
    }
    setVisibleKeys(newVisible);
  };

  const handleCopyKey = async (key: ApiKey) => {
    if (key.fullKey) {
      await navigator.clipboard.writeText(key.fullKey);
    }
  };

  const handleRevokeKey = (keyId: string) => {
    setApiKeys((prev) =>
      prev.map((key) => (key.id === keyId ? { ...key, status: 'revoked' as const } : key))
    );
  };

  const handleDeleteKey = (keyId: string) => {
    setApiKeys((prev) => prev.filter((key) => key.id !== keyId));
  };

  const handleCreateKey = async (newKey: Omit<ApiKey, 'id' | 'prefix' | 'fullKey' | 'usageThisMonth' | 'lastUsedAt'>) => {
    // In real implementation, this would call an API
    const key: ApiKey = {
      ...newKey,
      id: Math.random().toString(36).substr(2, 9),
      prefix: `sk_${Math.random().toString(36).substr(2, 18)}`,
      fullKey: `sk_${Math.random().toString(36).substr(2, 64)}`,
      usageThisMonth: 0,
    };
    setApiKeys([...apiKeys, key]);
  };

  return (
    <div className="space-y-6">
      {/* Header and Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">API Keys</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage customer API keys, permissions, and rate limits
          </p>
        </div>
        <Button
          onClick={() => setIsNewKeyDialogOpen(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Key
        </Button>
      </div>

      {/* Search */}
      <Card className="border-gray-200 dark:border-gray-800/50 bg-white dark:bg-gray-900/50 dark:backdrop-blur-xl p-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search by name or key prefix..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700"
          />
        </div>
      </Card>

      {/* API Keys List */}
      <div className="space-y-4">
        {filteredKeys.length === 0 ? (
          <Card className="border-gray-200 dark:border-gray-800/50 bg-white dark:bg-gray-900/50 dark:backdrop-blur-xl p-12 text-center">
            <p className="text-gray-600 dark:text-gray-400">No API keys found</p>
          </Card>
        ) : (
          filteredKeys.map((apiKey) => (
            <Card
              key={apiKey.id}
              className="border-gray-200 dark:border-gray-800/50 bg-white dark:bg-gray-900/50 dark:backdrop-blur-xl p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">{apiKey.name}</h4>
                    <span
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        apiKey.status === 'active'
                          ? 'bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-200'
                          : apiKey.status === 'revoked'
                            ? 'bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-200'
                            : 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-200'
                      }`}
                    >
                      {apiKey.status}
                    </span>
                  </div>

                  {/* Key Display */}
                  <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <code className="flex-1 text-sm text-gray-600 dark:text-gray-400 font-mono">
                      {visibleKeys.has(apiKey.id) && apiKey.fullKey
                        ? apiKey.fullKey
                        : apiKey.prefix + '••••••••••••••••••••'}
                    </code>
                    <button
                      onClick={() => toggleKeyVisibility(apiKey.id)}
                      className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {visibleKeys.has(apiKey.id) ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleCopyKey(apiKey)}
                      className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Created
                      </p>
                      <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{apiKey.createdAt}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Rate Limit
                      </p>
                      <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">
                        {apiKey.rateLimit.toLocaleString()} / {apiKey.period}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Usage This Month
                      </p>
                      <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">
                        {apiKey.usageThisMonth.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Last Used
                      </p>
                      <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">
                        {apiKey.lastUsedAt || 'Never'}
                      </p>
                    </div>
                  </div>

                  {/* Permissions */}
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                      Permissions
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {apiKey.permissions.map((perm) => (
                        <span
                          key={perm}
                          className="inline-flex px-2.5 py-0.5 rounded-full text-xs bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-200"
                        >
                          {perm}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <span className="text-xl">⋯</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {apiKey.status === 'active' && (
                        <DropdownMenuItem
                          onClick={() => handleRevokeKey(apiKey.id)}
                          className="text-orange-600"
                        >
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Revoke Key
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => handleDeleteKey(apiKey.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <NewKeyDialog
        isOpen={isNewKeyDialogOpen}
        onClose={() => setIsNewKeyDialogOpen(false)}
        onCreate={handleCreateKey}
      />
    </div>
  );
}
