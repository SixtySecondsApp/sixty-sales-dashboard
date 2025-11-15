import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { 
  Settings, 
  Plus, 
  Trash2, 
  Save, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle,
  ArrowUpDown,
  Filter,
  List,
  ChevronRight
} from 'lucide-react';

interface ListConfig {
  id?: string;
  google_list_id: string;
  list_title: string;
  sync_direction: 'bidirectional' | 'to_google' | 'from_google';
  is_primary: boolean;
  priority_filter: string[];
  task_categories: string[];
  status_filter: string[];
  auto_create_in_list: boolean;
  sync_enabled: boolean;
  display_order: number;
}

const PRIORITY_OPTIONS = [
  { value: 'critical', label: 'Critical', color: 'text-red-500' },
  { value: 'high', label: 'High', color: 'text-orange-500' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-500' },
  { value: 'low', label: 'Low', color: 'text-blue-500' }
];

const SYNC_DIRECTIONS = [
  { value: 'bidirectional', label: 'Bidirectional', description: 'Sync both ways' },
  { value: 'to_google', label: 'To Google Only', description: 'Push tasks to Google' },
  { value: 'from_google', label: 'From Google Only', description: 'Pull tasks from Google' }
];

export default function GoogleTasksSettings() {
  const [listConfigs, setListConfigs] = useState<ListConfig[]>([]);
  const [availableLists, setAvailableLists] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddList, setShowAddList] = useState(false);
  const [selectedListToAdd, setSelectedListToAdd] = useState('');

  useEffect(() => {
    loadConfigurations();
    loadAvailableLists();
  }, []);

  const loadConfigurations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('google_tasks_list_configs')
        .select('*')
        .eq('user_id', user.id)
        .order('is_primary', { ascending: false })
        .order('display_order');

      if (error) throw error;
      setListConfigs(data || []);
    } catch (error) {
      toast.error('Failed to load sync configurations');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvailableLists = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('google-tasks', {
        body: { action: 'list-tasklists' }
      });

      if (error) throw error;
      setAvailableLists(data?.items || []);
    } catch (error) {
    }
  };

  const handleAddList = async () => {
    if (!selectedListToAdd) return;

    const selectedList = availableLists.find(l => l.id === selectedListToAdd);
    if (!selectedList) return;

    // Check if list already configured
    if (listConfigs.some(c => c.google_list_id === selectedList.id)) {
      toast.error('This list is already configured');
      return;
    }

    const newConfig: ListConfig = {
      google_list_id: selectedList.id,
      list_title: selectedList.title,
      sync_direction: 'bidirectional',
      is_primary: listConfigs.length === 0,
      priority_filter: [],
      task_categories: [],
      status_filter: [],
      auto_create_in_list: true,
      sync_enabled: true,
      display_order: listConfigs.length
    };

    setListConfigs([...listConfigs, newConfig]);
    setShowAddList(false);
    setSelectedListToAdd('');
  };

  const handleUpdateConfig = (index: number, updates: Partial<ListConfig>) => {
    const updated = [...listConfigs];
    updated[index] = { ...updated[index], ...updates };
    
    // If setting as primary, unset other primary lists
    if (updates.is_primary) {
      updated.forEach((config, i) => {
        if (i !== index) config.is_primary = false;
      });
    }
    
    setListConfigs(updated);
  };

  const handleRemoveConfig = (index: number) => {
    const updated = listConfigs.filter((_, i) => i !== index);
    // If removed was primary and there are others, make first one primary
    if (listConfigs[index].is_primary && updated.length > 0) {
      updated[0].is_primary = true;
    }
    setListConfigs(updated);
  };

  const handleSaveConfigurations = async () => {
    try {
      setIsSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Delete existing configs for this user
      await supabase
        .from('google_tasks_list_configs')
        .delete()
        .eq('user_id', user.id);

      // Insert new configs
      if (listConfigs.length > 0) {
        const configsToSave = listConfigs.map(config => ({
          ...config,
          user_id: user.id,
          id: undefined // Let database generate ID
        }));

        const { error } = await supabase
          .from('google_tasks_list_configs')
          .insert(configsToSave);

        if (error) throw error;
      }

      toast.success('Sync configurations saved successfully');
      await loadConfigurations(); // Reload to get IDs
    } catch (error) {
      toast.error('Failed to save configurations');
    } finally {
      setIsSaving(false);
    }
  };

  const togglePriorityFilter = (index: number, priority: string) => {
    const config = listConfigs[index];
    const currentFilter = config.priority_filter || [];
    
    let newFilter;
    if (currentFilter.includes(priority)) {
      newFilter = currentFilter.filter(p => p !== priority);
    } else {
      newFilter = [...currentFilter, priority];
    }
    
    handleUpdateConfig(index, { priority_filter: newFilter });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="w-8 h-8 text-blue-500" />
            <h1 className="text-3xl font-bold text-white">Google Tasks Sync Settings</h1>
          </div>
          <p className="text-gray-400">
            Configure how your tasks sync with multiple Google Task lists
          </p>
        </div>

        {/* Info Card */}
        <Card className="bg-blue-500/10 border-blue-500/20 mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-white font-medium">Multi-List Sync with Priority Routing</p>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>• Configure multiple Google Task lists with different sync rules</li>
                  <li>• Route tasks based on priority (e.g., High priority → Business list)</li>
                  <li>• Set one list as primary for all tasks not matching other filters</li>
                  <li>• Control sync direction for each list independently</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* List Configurations */}
        <div className="space-y-4">
          {listConfigs.map((config, index) => (
            <Card key={index} className="bg-gray-900 border-gray-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <List className="w-5 h-5 text-gray-400" />
                    <div>
                      <CardTitle className="text-lg text-white flex items-center gap-2">
                        {config.list_title}
                        {config.is_primary && (
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                            Primary
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription className="text-sm text-gray-400">
                        {config.google_list_id === '@default' ? 'Default Google Tasks list' : `List ID: ${config.google_list_id}`}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveConfig(index)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Sync Direction */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Sync Direction
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {SYNC_DIRECTIONS.map(direction => (
                      <button
                        key={direction.value}
                        onClick={() => handleUpdateConfig(index, { sync_direction: direction.value as any })}
                        className={`p-3 rounded-lg border transition-colors ${
                          config.sync_direction === direction.value
                            ? 'bg-blue-500/20 border-blue-500 text-white'
                            : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:bg-gray-800'
                        }`}
                      >
                        <div className="font-medium">{direction.label}</div>
                        <div className="text-xs mt-1 opacity-75">{direction.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Priority Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Priority Filter
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PRIORITY_OPTIONS.map(priority => (
                      <button
                        key={priority.value}
                        onClick={() => togglePriorityFilter(index, priority.value)}
                        className={`px-3 py-1.5 rounded-lg border transition-colors ${
                          config.priority_filter?.includes(priority.value)
                            ? 'bg-blue-500/20 border-blue-500'
                            : 'bg-gray-800/50 border-gray-700 hover:bg-gray-800'
                        }`}
                      >
                        <span className={priority.color}>{priority.label}</span>
                      </button>
                    ))}
                  </div>
                  {config.priority_filter?.length === 0 && (
                    <p className="text-xs text-gray-500 mt-2">All priorities will sync to this list</p>
                  )}
                </div>

                {/* Options */}
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.is_primary}
                      onChange={(e) => handleUpdateConfig(index, { is_primary: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-300">Primary List</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.auto_create_in_list}
                      onChange={(e) => handleUpdateConfig(index, { auto_create_in_list: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-300">Auto-create tasks</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.sync_enabled}
                      onChange={(e) => handleUpdateConfig(index, { sync_enabled: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-300">Sync enabled</span>
                  </label>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Add List Button/Form */}
          {!showAddList ? (
            <Button
              onClick={() => setShowAddList(true)}
              variant="outline"
              className="w-full border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Another List
            </Button>
          ) : (
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-lg text-white">Add Task List</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Select a Google Task List
                    </label>
                    <select
                      value={selectedListToAdd}
                      onChange={(e) => setSelectedListToAdd(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Choose a list...</option>
                      {availableLists
                        .filter(list => !listConfigs.some(c => c.google_list_id === list.id))
                        .map(list => (
                          <option key={list.id} value={list.id}>
                            {list.title}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleAddList}
                      disabled={!selectedListToAdd}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Add List
                    </Button>
                    <Button
                      onClick={() => {
                        setShowAddList(false);
                        setSelectedListToAdd('');
                      }}
                      variant="outline"
                      className="border-gray-700 text-gray-300"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Example Configuration */}
        {listConfigs.length >= 2 && (
          <Card className="bg-green-500/10 border-green-500/20 mt-6">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-white font-medium">Example: Your Current Setup</p>
                  <div className="text-sm text-gray-300 space-y-1">
                    {listConfigs.find(c => c.priority_filter?.includes('high')) && (
                      <div className="flex items-center gap-2">
                        <ChevronRight className="w-4 h-4" />
                        <span>High priority tasks → {listConfigs.find(c => c.priority_filter?.includes('high'))?.list_title}</span>
                      </div>
                    )}
                    {listConfigs.find(c => c.is_primary) && (
                      <div className="flex items-center gap-2">
                        <ChevronRight className="w-4 h-4" />
                        <span>All other tasks → {listConfigs.find(c => c.is_primary)?.list_title}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Save Button */}
        <div className="mt-8 flex justify-end">
          <Button
            onClick={handleSaveConfigurations}
            disabled={isSaving || listConfigs.length === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Configurations
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}