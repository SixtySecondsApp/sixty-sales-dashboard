/**
 * TemplateLibrary Component
 *
 * Comprehensive template management interface for intervention templates.
 * Features:
 * - Browse templates by type and performance
 * - View detailed metrics (recovery rate, response rate)
 * - Create and edit custom templates
 * - Manage A/B test variants
 * - Preview personalization
 */

import { useState, useMemo } from 'react';
import { useInterventionTemplates } from '@/lib/hooks/useRelationshipHealth';
import type {
  InterventionTemplate,
  CreateTemplateInput,
} from '@/lib/services/interventionTemplateService';
import {
  FileText,
  Plus,
  Edit2,
  TrendingUp,
  BarChart3,
  Eye,
  Copy,
  Archive,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface TemplateLibraryProps {
  onSelectTemplate?: (template: InterventionTemplate) => void;
  allowEdit?: boolean;
  allowCreate?: boolean;
}

type TemplateType = 'permission_to_close' | 'value_add' | 'pattern_interrupt' | 'soft_checkin' | 'channel_switch' | 'all';

export function TemplateLibrary({
  onSelectTemplate,
  allowEdit = true,
  allowCreate = true,
}: TemplateLibraryProps) {
  const { templates, isLoading, createTemplate, updateTemplate, archiveTemplate } = useInterventionTemplates();

  const [selectedType, setSelectedType] = useState<TemplateType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [sortBy, setSortBy] = useState<'performance' | 'recent' | 'name'>('performance');
  const [selectedTemplate, setSelectedTemplate] = useState<InterventionTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<InterventionTemplate | null>(null);

  // Filter and sort templates
  const filteredTemplates = useMemo(() => {
    let filtered = templates;

    // Filter by type
    if (selectedType !== 'all') {
      filtered = filtered.filter((t) => t.template_type === selectedType);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.template_name.toLowerCase().includes(query) ||
          t.template_body.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query)
      );
    }

    // Filter archived
    if (!showArchived) {
      filtered = filtered.filter((t) => !t.is_archived);
    }

    // Sort
    if (sortBy === 'performance') {
      filtered.sort((a, b) => (b.recovery_rate_percent || 0) - (a.recovery_rate_percent || 0));
    } else if (sortBy === 'recent') {
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      filtered.sort((a, b) => a.template_name.localeCompare(b.template_name));
    }

    return filtered;
  }, [templates, selectedType, searchQuery, showArchived, sortBy]);

  const handleCreateTemplate = async (input: CreateTemplateInput) => {
    await createTemplate(input);
    setIsCreating(false);
  };

  const handleArchive = async (templateId: string) => {
    await archiveTemplate(templateId);
  };

  const templateTypes = [
    { value: 'all' as const, label: 'All Templates', icon: FileText },
    { value: 'permission_to_close' as const, label: 'Permission to Close', icon: CheckCircle2 },
    { value: 'value_add' as const, label: 'Value Add', icon: TrendingUp },
    { value: 'pattern_interrupt' as const, label: 'Pattern Interrupt', icon: AlertCircle },
    { value: 'soft_checkin' as const, label: 'Soft Check-in', icon: Eye },
    { value: 'channel_switch' as const, label: 'Channel Switch', icon: BarChart3 },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Template Library</h2>
          <p className="text-gray-400 mt-1">
            Manage intervention templates with performance tracking
          </p>
        </div>
        {allowCreate && (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Type filters */}
        <div className="flex flex-wrap gap-2">
          {templateTypes.map((type) => {
            const Icon = type.icon;
            const isSelected = selectedType === type.value;
            return (
              <button
                key={type.value}
                onClick={() => setSelectedType(type.value)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isSelected
                    ? 'bg-blue-500 text-white'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                <Icon className="w-4 h-4" />
                {type.label}
              </button>
            );
          })}
        </div>

        {/* Sort and view options */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="performance">Best Performance</option>
              <option value="recent">Most Recent</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-gray-600 bg-white/5 text-blue-500 focus:ring-blue-500"
            />
            Show archived
          </label>
        </div>
      </div>

      {/* Template Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No templates found</p>
          {allowCreate && (
            <button
              onClick={() => setIsCreating(true)}
              className="mt-4 text-blue-400 hover:text-blue-300"
            >
              Create your first template
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onSelect={onSelectTemplate}
              onEdit={allowEdit ? () => {
                setSelectedTemplate(template);
                setIsEditing(true);
              } : undefined}
              onArchive={allowEdit ? () => handleArchive(template.id) : undefined}
              onPreview={() => setPreviewTemplate(template)}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(isCreating || isEditing) && (
        <TemplateEditorModal
          template={isEditing ? selectedTemplate : null}
          onSave={isCreating ? handleCreateTemplate : (input) => {
            if (selectedTemplate) {
              updateTemplate(selectedTemplate.id, input);
            }
            setIsEditing(false);
          }}
          onClose={() => {
            setIsCreating(false);
            setIsEditing(false);
            setSelectedTemplate(null);
          }}
        />
      )}

      {/* Preview Modal */}
      {previewTemplate && (
        <TemplatePreviewModal
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
        />
      )}
    </div>
  );
}

interface TemplateCardProps {
  template: InterventionTemplate;
  onSelect?: (template: InterventionTemplate) => void;
  onEdit?: () => void;
  onArchive?: () => void;
  onPreview: () => void;
}

function TemplateCard({ template, onSelect, onEdit, onArchive, onPreview }: TemplateCardProps) {
  const recoveryRate = template.recovery_rate_percent || 0;
  const responseRate = template.times_sent > 0
    ? Math.round((template.times_replied / template.times_sent) * 100)
    : 0;

  const getPerformanceColor = (rate: number) => {
    if (rate >= 70) return 'text-green-400';
    if (rate >= 40) return 'text-yellow-400';
    return 'text-orange-400';
  };

  return (
    <div className={`p-4 bg-white/5 border rounded-lg ${template.is_archived ? 'border-gray-700 opacity-50' : 'border-white/10'}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-white font-semibold mb-1">{template.template_name}</h3>
          {template.description && (
            <p className="text-sm text-gray-400">{template.description}</p>
          )}
        </div>
        {template.is_archived && (
          <span className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded">
            Archived
          </span>
        )}
      </div>

      {/* Template Type & Variant */}
      <div className="flex items-center gap-2 mb-3">
        <span className="px-2 py-1 text-xs bg-blue-500/10 text-blue-400 rounded">
          {template.template_type.replace('_', ' ')}
        </span>
        {template.variant_name && (
          <span className="px-2 py-1 text-xs bg-purple-500/10 text-purple-400 rounded">
            {template.variant_name}
          </span>
        )}
        {template.is_control_variant && (
          <span className="px-2 py-1 text-xs bg-green-500/10 text-green-400 rounded">
            Control
          </span>
        )}
      </div>

      {/* Performance Metrics */}
      {template.times_sent > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">Recovery Rate</p>
            <p className={`text-lg font-bold ${getPerformanceColor(recoveryRate)}`}>
              {recoveryRate}%
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Response Rate</p>
            <p className={`text-lg font-bold ${getPerformanceColor(responseRate)}`}>
              {responseRate}%
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Times Sent</p>
            <p className="text-lg font-bold text-white">{template.times_sent}</p>
          </div>
        </div>
      )}

      {/* Personalization Fields */}
      {template.personalization_fields && (template.personalization_fields as any).fields && (
        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-2">Personalization:</p>
          <div className="flex flex-wrap gap-1">
            {((template.personalization_fields as any).fields as string[]).map((field) => (
              <span key={field} className="px-2 py-0.5 text-xs bg-white/5 text-gray-300 rounded">
                {field}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-white/10">
        <button
          onClick={onPreview}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-300 hover:text-white transition-colors"
        >
          <Eye className="w-4 h-4" />
          Preview
        </button>
        {onSelect && (
          <button
            onClick={() => onSelect(template)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-500/10 text-blue-400 rounded hover:bg-blue-500/20 transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            Use Template
          </button>
        )}
        {onEdit && (
          <button
            onClick={onEdit}
            className="ml-auto flex items-center gap-1 px-3 py-1.5 text-sm text-gray-300 hover:text-white transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
        )}
        {onArchive && !template.is_archived && (
          <button
            onClick={onArchive}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-400 hover:text-gray-300 transition-colors"
          >
            <Archive className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

interface TemplateEditorModalProps {
  template: InterventionTemplate | null;
  onSave: (input: CreateTemplateInput) => void;
  onClose: () => void;
}

function TemplateEditorModal({ template, onSave, onClose }: TemplateEditorModalProps) {
  const [formData, setFormData] = useState<CreateTemplateInput>({
    templateName: template?.template_name || '',
    templateType: template?.template_type || 'permission_to_close',
    templateBody: template?.template_body || '',
    subjectLine: template?.subject_line || '',
    description: template?.description || '',
    personalizationFields: template?.personalization_fields || { fields: [] },
    variantName: template?.variant_name || undefined,
    isControlVariant: template?.is_control_variant || false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 border border-white/10 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <h2 className="text-xl font-bold text-white mb-4">
            {template ? 'Edit Template' : 'Create New Template'}
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Template Name
            </label>
            <input
              type="text"
              value={formData.templateName}
              onChange={(e) => setFormData({ ...formData, templateName: e.target.value })}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Template Type
              </label>
              <select
                value={formData.templateType}
                onChange={(e) => setFormData({ ...formData, templateType: e.target.value as any })}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="permission_to_close">Permission to Close</option>
                <option value="value_add">Value Add</option>
                <option value="pattern_interrupt">Pattern Interrupt</option>
                <option value="soft_checkin">Soft Check-in</option>
                <option value="channel_switch">Channel Switch</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Variant Name (Optional)
              </label>
              <input
                type="text"
                value={formData.variantName || ''}
                onChange={(e) => setFormData({ ...formData, variantName: e.target.value || undefined })}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Variant A"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Subject Line (Optional)
            </label>
            <input
              type="text"
              value={formData.subjectLine || ''}
              onChange={(e) => setFormData({ ...formData, subjectLine: e.target.value || undefined })}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Template Body
            </label>
            <textarea
              value={formData.templateBody}
              onChange={(e) => setFormData({ ...formData, templateBody: e.target.value })}
              rows={8}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              placeholder="Use {{variable}} for personalization fields"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Description (Optional)
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value || undefined })}
              rows={2}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.isControlVariant}
              onChange={(e) => setFormData({ ...formData, isControlVariant: e.target.checked })}
              className="rounded border-gray-600 bg-white/5 text-blue-500 focus:ring-blue-500"
            />
            <label className="text-sm text-gray-300">
              Mark as control variant for A/B testing
            </label>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              {template ? 'Save Changes' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface TemplatePreviewModalProps {
  template: InterventionTemplate;
  onClose: () => void;
}

function TemplatePreviewModal({ template, onClose }: TemplatePreviewModalProps) {
  // Sample personalization data
  const sampleData = {
    first_name: 'Sarah',
    last_meaningful_interaction: 'our call last Tuesday',
    personalized_assumption: "you've decided to move forward with a different solution",
    specific_value_point: 'the automated reporting feature you mentioned needing',
    company_name: 'Acme Corp',
    deal_value: '$15,000',
  };

  // Replace personalization fields with sample data
  let previewBody = template.template_body;
  Object.entries(sampleData).forEach(([key, value]) => {
    previewBody = previewBody.replace(new RegExp(`{{${key}}}`, 'g'), value);
  });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 border border-white/10 rounded-xl max-w-2xl w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Template Preview</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          {template.subject_line && (
            <div className="mb-4">
              <p className="text-xs text-gray-400 mb-1">Subject:</p>
              <p className="text-white font-medium">{template.subject_line}</p>
            </div>
          )}

          <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
            <p className="text-white whitespace-pre-wrap leading-relaxed">
              {previewBody}
            </p>
          </div>

          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-xs text-blue-400">
              <strong>Note:</strong> This is a preview with sample personalization data.
              Actual values will be dynamically inserted based on the relationship context.
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-full mt-4 px-4 py-2 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
