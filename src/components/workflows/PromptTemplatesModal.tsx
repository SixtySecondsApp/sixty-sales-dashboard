import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Plus, Copy, Globe, Lock, FileText, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase/clientV2';
import type { AINodeConfig } from './AIAgentConfigModal';

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  systemPrompt: string;
  userPrompt: string;
  variables: string[];
  modelProvider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  outputFormat?: 'text' | 'json' | 'structured';
  examples?: Array<{ input: string; output: string }>;
  chainOfThought?: boolean;
  isPublic: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface PromptTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: PromptTemplate) => void;
  currentConfig?: AINodeConfig;
}

const TEMPLATE_CATEGORIES = [
  'Sales',
  'Customer Support',
  'Data Analysis',
  'Content Creation',
  'Task Automation',
  'Decision Making',
  'Custom',
];

const DEFAULT_TEMPLATES: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Lead Qualifier',
    description: 'Qualify leads based on deal value and engagement',
    category: 'Sales',
    systemPrompt: 'You are a sales qualification assistant. Analyze deal information and determine if it meets qualification criteria.',
    userPrompt: 'Analyze this deal:\nValue: {{deal.value}}\nCompany: {{deal.company}}\nStage: {{deal.stage}}\n\nDetermine if this is a qualified opportunity and provide reasoning.',
    variables: ['deal.value', 'deal.company', 'deal.stage'],
    modelProvider: 'openai',
    model: 'gpt-4-turbo-preview',
    temperature: 0.3,
    maxTokens: 500,
    outputFormat: 'text',
    isPublic: true,
  },
  {
    name: 'Task Prioritizer',
    description: 'Prioritize tasks based on urgency and importance',
    category: 'Task Automation',
    systemPrompt: 'You are a task prioritization assistant. Analyze tasks and rank them by priority.',
    userPrompt: 'Task: {{task.title}}\nDue Date: {{task.dueDate}}\nPriority: {{task.priority}}\n\nProvide a priority score (1-10) and reasoning.',
    variables: ['task.title', 'task.dueDate', 'task.priority'],
    modelProvider: 'openai',
    model: 'gpt-3.5-turbo',
    temperature: 0.2,
    maxTokens: 300,
    outputFormat: 'json',
    chainOfThought: true,
    isPublic: true,
  },
  {
    name: 'Meeting Summarizer',
    description: 'Generate concise meeting summaries with action items',
    category: 'Content Creation',
    systemPrompt: 'You are a meeting summarization expert. Extract key points and action items from meeting notes.',
    userPrompt: 'Meeting notes: {{activity.notes}}\nDate: {{activity.date}}\n\nProvide a summary with:\n1. Key decisions\n2. Action items\n3. Next steps',
    variables: ['activity.notes', 'activity.date'],
    modelProvider: 'anthropic',
    model: 'claude-3-sonnet',
    temperature: 0.5,
    maxTokens: 800,
    outputFormat: 'structured',
    isPublic: true,
  },
];

export default function PromptTemplatesModal({
  isOpen,
  onClose,
  onSelectTemplate,
  currentConfig,
}: PromptTemplatesModalProps) {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isCreating, setIsCreating] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<PromptTemplate> | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }

      // Load templates from database
      const { data, error } = await supabase
        .from('ai_prompt_templates')
        .select('*')
        .or(`user_id.eq.${user?.id},is_public.eq.true`)
        .order('created_at', { ascending: false });

      if (error) {
        // Use default templates if database is empty
        setTemplates(DEFAULT_TEMPLATES.map((t, i) => ({ 
          ...t, 
          id: `default-${i}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })));
      } else {
        setTemplates(data || []);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const saveTemplate = async () => {
    if (!editingTemplate || !userId) return;

    try {
      const templateData = {
        ...editingTemplate,
        user_id: userId,
        updated_at: new Date().toISOString(),
      };

      if (editingTemplate.id && !editingTemplate.id.startsWith('default-')) {
        // Update existing template
        const { error } = await supabase
          .from('ai_prompt_templates')
          .update(templateData)
          .eq('id', editingTemplate.id);

        if (error) throw error;
      } else {
        // Create new template
        const { id, ...newTemplate } = templateData;
        const { error } = await supabase
          .from('ai_prompt_templates')
          .insert(newTemplate);

        if (error) throw error;
      }

      await loadTemplates();
      setEditingTemplate(null);
      setIsCreating(false);
    } catch (error) {
    }
  };

  const deleteTemplate = async (templateId: string) => {
    if (templateId.startsWith('default-')) return;

    try {
      const { error } = await supabase
        .from('ai_prompt_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
      await loadTemplates();
    } catch (error) {
    }
  };

  const duplicateTemplate = (template: PromptTemplate) => {
    setEditingTemplate({
      ...template,
      id: undefined,
      name: `${template.name} (Copy)`,
      isPublic: false,
    });
    setIsCreating(true);
  };

  const filteredTemplates = templates.filter(t => 
    selectedCategory === 'All' || t.category === selectedCategory
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <FileText className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Prompt Templates</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex h-[calc(90vh-140px)]">
          {/* Sidebar */}
          <div className="w-64 border-r border-gray-800 p-4">
            <button
              onClick={() => {
                setIsCreating(true);
                setEditingTemplate({
                  name: '',
                  description: '',
                  category: 'Custom',
                  systemPrompt: '',
                  userPrompt: '',
                  variables: [],
                  modelProvider: currentConfig?.modelProvider || 'openai',
                  model: currentConfig?.model || 'gpt-3.5-turbo',
                  temperature: currentConfig?.temperature || 0.7,
                  maxTokens: currentConfig?.maxTokens || 1000,
                  isPublic: false,
                });
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors mb-4"
            >
              <Plus className="w-4 h-4" />
              New Template
            </button>

            <div className="space-y-1">
              <button
                onClick={() => setSelectedCategory('All')}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  selectedCategory === 'All'
                    ? 'bg-purple-600/20 text-purple-400'
                    : 'hover:bg-gray-800 text-gray-400'
                }`}
              >
                All Templates
              </button>
              {TEMPLATE_CATEGORIES.map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    selectedCategory === category
                      ? 'bg-purple-600/20 text-purple-400'
                      : 'hover:bg-gray-800 text-gray-400'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {isCreating || editingTemplate ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">
                  {editingTemplate?.id ? 'Edit Template' : 'Create New Template'}
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Template Name
                    </label>
                    <input
                      type="text"
                      value={editingTemplate?.name || ''}
                      onChange={(e) => setEditingTemplate({
                        ...editingTemplate,
                        name: e.target.value,
                      })}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Category
                    </label>
                    <select
                      value={editingTemplate?.category || 'Custom'}
                      onChange={(e) => setEditingTemplate({
                        ...editingTemplate,
                        category: e.target.value,
                      })}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {TEMPLATE_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={editingTemplate?.description || ''}
                    onChange={(e) => setEditingTemplate({
                      ...editingTemplate,
                      description: e.target.value,
                    })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    System Prompt
                  </label>
                  <textarea
                    value={editingTemplate?.systemPrompt || ''}
                    onChange={(e) => setEditingTemplate({
                      ...editingTemplate,
                      systemPrompt: e.target.value,
                    })}
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    User Prompt
                  </label>
                  <textarea
                    value={editingTemplate?.userPrompt || ''}
                    onChange={(e) => setEditingTemplate({
                      ...editingTemplate,
                      userPrompt: e.target.value,
                    })}
                    rows={4}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-gray-300">
                    <input
                      type="checkbox"
                      checked={editingTemplate?.isPublic || false}
                      onChange={(e) => setEditingTemplate({
                        ...editingTemplate,
                        isPublic: e.target.checked,
                      })}
                      className="rounded border-gray-600 bg-gray-800 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm">Make this template public</span>
                  </label>

                  <label className="flex items-center gap-2 text-gray-300">
                    <input
                      type="checkbox"
                      checked={editingTemplate?.chainOfThought || false}
                      onChange={(e) => setEditingTemplate({
                        ...editingTemplate,
                        chainOfThought: e.target.checked,
                      })}
                      className="rounded border-gray-600 bg-gray-800 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm">Enable Chain of Thought</span>
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                  <button
                    onClick={() => {
                      setEditingTemplate(null);
                      setIsCreating(false);
                    }}
                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveTemplate}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    Save Template
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loading ? (
                  <div className="col-span-2 text-center py-8 text-gray-400">
                    Loading templates...
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="col-span-2 text-center py-8 text-gray-400">
                    No templates found. Create your first template!
                  </div>
                ) : (
                  filteredTemplates.map(template => (
                    <div
                      key={template.id}
                      className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h4 className="text-white font-medium">{template.name}</h4>
                          {template.isPublic ? (
                            <Globe className="w-4 h-4 text-blue-400" />
                          ) : (
                            <Lock className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        <span className="text-xs text-purple-400 bg-purple-500/20 px-2 py-1 rounded">
                          {template.category}
                        </span>
                      </div>

                      <p className="text-sm text-gray-400 mb-3">{template.description}</p>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {template.modelProvider} / {template.model}
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              onSelectTemplate(template);
                              onClose();
                            }}
                            className="p-1.5 hover:bg-gray-600 rounded transition-colors"
                            title="Use Template"
                          >
                            <Sparkles className="w-4 h-4 text-purple-400" />
                          </button>
                          <button
                            onClick={() => duplicateTemplate(template)}
                            className="p-1.5 hover:bg-gray-600 rounded transition-colors"
                            title="Duplicate"
                          >
                            <Copy className="w-4 h-4 text-gray-400" />
                          </button>
                          {!template.id.startsWith('default-') && template.user_id === userId && (
                            <button
                              onClick={() => deleteTemplate(template.id)}
                              className="p-1.5 hover:bg-gray-600 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}