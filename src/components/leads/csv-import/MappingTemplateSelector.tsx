/**
 * MappingTemplateSelector - Save and load mapping templates
 */

import React, { useState } from 'react';
import { Save, ChevronDown, FolderOpen, Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMappingTemplates } from '@/lib/hooks/useMappingTemplates';
import { toast } from 'sonner';

interface MappingTemplateSelectorProps {
  currentMappings: Record<string, string>;
  onLoadTemplate: (mappings: Record<string, string>) => void;
}

export function MappingTemplateSelector({
  currentMappings,
  onLoadTemplate,
}: MappingTemplateSelectorProps) {
  const { templates, isLoading, saveTemplate, deleteTemplate } = useMappingTemplates();
  const [isLoadOpen, setIsLoadOpen] = useState(false);
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!templateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    // Check if we have any mappings to save
    const mappingsToSave = Object.fromEntries(
      Object.entries(currentMappings).filter(([_, v]) => v && v !== '__skip__')
    );

    if (Object.keys(mappingsToSave).length === 0) {
      toast.error('No field mappings to save');
      return;
    }

    setIsSaving(true);
    try {
      await saveTemplate({
        name: templateName.trim(),
        description: templateDescription.trim() || null,
        column_mappings: mappingsToSave,
      });
      toast.success('Template saved');
      setIsSaveOpen(false);
      setTemplateName('');
      setTemplateDescription('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await deleteTemplate(templateId);
      toast.success('Template deleted');
    } catch (error) {
      toast.error('Failed to delete template');
    }
  };

  const hasValidMappings = Object.values(currentMappings).some(
    (v) => v && v !== '__skip__'
  );

  return (
    <div className="flex items-center gap-2">
      {/* Load Template Button */}
      <div className="relative">
        <button
          onClick={() => setIsLoadOpen(!isLoadOpen)}
          disabled={isLoading || templates.length === 0}
          className={cn(
            'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors',
            'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800',
            'hover:border-blue-400 dark:hover:border-blue-500',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FolderOpen className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">Load Template</span>
          <ChevronDown className="h-4 w-4" />
        </button>

        {/* Load dropdown */}
        {isLoadOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsLoadOpen(false)} />
            <div className="absolute z-20 mt-1 w-64 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 max-h-72 overflow-y-auto">
              {templates.length === 0 ? (
                <div className="px-3 py-4 text-sm text-gray-500 text-center">
                  No saved templates
                </div>
              ) : (
                templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => {
                      onLoadTemplate(template.column_mappings);
                      setIsLoadOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 group flex items-start justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {template.name}
                      </p>
                      {template.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {template.description}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {Object.keys(template.column_mappings).length} fields mapped
                        {template.usage_count > 0 && ` • Used ${template.usage_count} times`}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDelete(template.id, e)}
                      className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-500/20 rounded transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </button>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Save Template Button */}
      <div className="relative">
        <button
          onClick={() => setIsSaveOpen(!isSaveOpen)}
          disabled={!hasValidMappings}
          className={cn(
            'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
            'bg-blue-500 text-white hover:bg-blue-600',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <Save className="h-4 w-4" />
          <span className="hidden sm:inline">Save Template</span>
        </button>

        {/* Save dialog */}
        {isSaveOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsSaveOpen(false)} />
            <div className="absolute z-20 mt-1 w-72 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                Save as Template
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g., HubSpot Export"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    placeholder="Brief description"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setIsSaveOpen(false)}
                    className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving || !templateName.trim()}
                    className="px-3 py-1.5 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                  >
                    {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                    Save
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
