import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface FathomWorkflowConfigProps {
  workflowId?: string;
  onSave?: (config: any) => void;
}

export const FathomWorkflowConfig: React.FC<FathomWorkflowConfigProps> = ({ 
  workflowId, 
  onSave 
}) => {
  const [config, setConfig] = useState({
    priority_mapping: {
      urgent: 'eeb122d5-d850-4381-b914-2ad09e48421b',
      high: '42641fa1-9e6c-48fd-8c08-ada611ccc92a',
      medium: 'e6153e53-d1c7-431a-afde-cd7c21b02ebb',
      low: '1c00bc94-5358-4348-aaf3-cb2baa4747c4'
    },
    user_mapping: {
      'Andrew Bryce': 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459',
      'Steve Gibson': 'e6380a9c-f0cf-46ad-96c3-73b1d1d48c9f'
    },
    categories: [
      'Call',
      'Email',
      'Whatsapp / Text',
      'LinkedIn Message',
      'LinkedIn Connection',
      'Proposal',
      'Send Information'
    ],
    deadline_defaults: {
      urgent: 1,
      high: 2,
      medium: 3,
      low: 7
    }
  });

  const [newUser, setNewUser] = useState({ name: '', id: '' });
  const [newCategory, setNewCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [priorities, setPriorities] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    loadPriorities();
    loadUsers();
    if (workflowId) {
      loadWorkflowConfig();
    }
  }, [workflowId]);

  const loadPriorities = async () => {
    const { data } = await supabase
      .from('priorities')
      .select('id, name')
      .order('name');
    
    if (data) {
      setPriorities(data);
    }
  };

  const loadUsers = async () => {
    const { data } = await supabase
      .from('auth.users')
      .select('id, email')
      .order('email');
    
    if (data) {
      setUsers(data);
    }
  };

  const loadWorkflowConfig = async () => {
    if (!workflowId) return;
    
    const { data } = await supabase
      .from('user_automation_rules')
      .select('action_config')
      .eq('id', workflowId)
      .single();
    
    if (data?.action_config) {
      setConfig(data.action_config);
    }
  };

  const saveConfig = async () => {
    setLoading(true);
    
    if (workflowId) {
      const { error } = await supabase
        .from('user_automation_rules')
        .update({ action_config: config })
        .eq('id', workflowId);
      
      if (!error) {
        onSave?.(config);
      }
    } else {
      onSave?.(config);
    }
    
    setLoading(false);
  };

  const addUserMapping = () => {
    if (newUser.name && newUser.id) {
      setConfig({
        ...config,
        user_mapping: {
          ...config.user_mapping,
          [newUser.name]: newUser.id
        }
      });
      setNewUser({ name: '', id: '' });
    }
  };

  const removeUserMapping = (name: string) => {
    const updated = { ...config.user_mapping };
    delete updated[name];
    setConfig({
      ...config,
      user_mapping: updated
    });
  };

  const addCategory = () => {
    if (newCategory && !config.categories.includes(newCategory)) {
      setConfig({
        ...config,
        categories: [...config.categories, newCategory]
      });
      setNewCategory('');
    }
  };

  const removeCategory = (category: string) => {
    setConfig({
      ...config,
      categories: config.categories.filter(c => c !== category)
    });
  };

  return (
    <div className="space-y-6 p-6 bg-gray-800 rounded-lg">
      <h2 className="text-xl font-semibold text-white">Fathom Workflow Configuration</h2>
      
      {/* Priority Mapping */}
      <div className="space-y-3">
        <h3 className="text-lg font-medium text-gray-200">Priority Mapping</h3>
        <p className="text-sm text-gray-400">Map priority levels to your CRM priority IDs</p>
        
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(config.priority_mapping).map(([level, id]) => (
            <div key={level} className="flex items-center space-x-2">
              <label className="text-sm text-gray-300 w-20 capitalize">{level}:</label>
              <select
                value={id}
                onChange={(e) => setConfig({
                  ...config,
                  priority_mapping: {
                    ...config.priority_mapping,
                    [level]: e.target.value
                  }
                })}
                className="flex-1 px-3 py-1 bg-gray-700 text-white rounded"
              >
                {priorities.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* User Mapping */}
      <div className="space-y-3">
        <h3 className="text-lg font-medium text-gray-200">Sales Rep Mapping</h3>
        <p className="text-sm text-gray-400">Map names from Fathom to CRM user IDs</p>
        
        <div className="space-y-2">
          {Object.entries(config.user_mapping).map(([name, id]) => (
            <div key={name} className="flex items-center justify-between p-2 bg-gray-700 rounded">
              <span className="text-sm text-gray-300">{name}</span>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-400">{id.slice(0, 8)}...</span>
                <button
                  onClick={() => removeUserMapping(name)}
                  className="text-red-400 hover:text-red-300"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="Name (e.g., John Doe)"
            value={newUser.name}
            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
            className="flex-1 px-3 py-2 bg-gray-700 text-white rounded"
          />
          <select
            value={newUser.id}
            onChange={(e) => setNewUser({ ...newUser, id: e.target.value })}
            className="flex-1 px-3 py-2 bg-gray-700 text-white rounded"
          >
            <option value="">Select User</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.email}</option>
            ))}
          </select>
          <button
            onClick={addUserMapping}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
          >
            Add
          </button>
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-3">
        <h3 className="text-lg font-medium text-gray-200">Task Categories</h3>
        <p className="text-sm text-gray-400">Available categories for action item classification</p>
        
        <div className="flex flex-wrap gap-2">
          {config.categories.map(category => (
            <div
              key={category}
              className="flex items-center space-x-1 px-3 py-1 bg-gray-700 rounded"
            >
              <span className="text-sm text-gray-300">{category}</span>
              <button
                onClick={() => removeCategory(category)}
                className="text-red-400 hover:text-red-300"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="New category..."
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="flex-1 px-3 py-2 bg-gray-700 text-white rounded"
            onKeyPress={(e) => e.key === 'Enter' && addCategory()}
          />
          <button
            onClick={addCategory}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
          >
            Add Category
          </button>
        </div>
      </div>

      {/* Deadline Defaults */}
      <div className="space-y-3">
        <h3 className="text-lg font-medium text-gray-200">Default Deadlines</h3>
        <p className="text-sm text-gray-400">Days to deadline based on priority (weekends excluded)</p>
        
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(config.deadline_defaults).map(([priority, days]) => (
            <div key={priority} className="flex items-center space-x-2">
              <label className="text-sm text-gray-300 w-20 capitalize">{priority}:</label>
              <input
                type="number"
                value={days}
                onChange={(e) => setConfig({
                  ...config,
                  deadline_defaults: {
                    ...config.deadline_defaults,
                    [priority]: parseInt(e.target.value) || 1
                  }
                })}
                min="0"
                max="30"
                className="w-20 px-3 py-1 bg-gray-700 text-white rounded"
              />
              <span className="text-sm text-gray-400">days</span>
            </div>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={saveConfig}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded"
        >
          {loading ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      {/* Preview */}
      <div className="mt-6 p-4 bg-gray-900 rounded">
        <h4 className="text-sm font-medium text-gray-400 mb-2">Configuration Preview</h4>
        <pre className="text-xs text-gray-300 overflow-x-auto">
          {JSON.stringify(config, null, 2)}
        </pre>
      </div>
    </div>
  );
};