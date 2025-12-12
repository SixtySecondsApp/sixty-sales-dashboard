/**
 * Coaching Scorecard Settings Page
 *
 * Admin-only page for managing coaching scorecard templates.
 * Features:
 * - List all templates by meeting type
 * - Create, edit, and delete templates
 * - Toggle template active status
 * - Preview template configuration
 * - 4 default templates included
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Edit2,
  Trash2,
  Copy,
  ToggleLeft,
  ToggleRight,
  Search,
  Filter,
  BarChart3,
  ListChecks,
  Route,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Settings,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useScorecardTemplates } from '@/lib/hooks/useCoachingScorecard';
import { ScorecardTemplateEditor } from '@/components/admin/ScorecardTemplateEditor';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import type { CoachingScorecardTemplate, MeetingType } from '@/lib/types/meetingIntelligence';

const MEETING_TYPE_CONFIG: Record<MeetingType, { label: string; color: string; icon: string }> = {
  discovery: { label: 'Discovery', color: 'bg-blue-500', icon: 'Search' },
  demo: { label: 'Demo', color: 'bg-purple-500', icon: 'Monitor' },
  negotiation: { label: 'Negotiation', color: 'bg-orange-500', icon: 'Scale' },
  closing: { label: 'Closing', color: 'bg-green-500', icon: 'CheckCircle' },
  general: { label: 'General', color: 'bg-gray-500', icon: 'MessageSquare' },
};

export default function CoachingScorecardSettings() {
  const { user } = useAuth();
  const { templates, loading, error, refresh } = useScorecardTemplates();

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<MeetingType | 'all'>('all');
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CoachingScorecardTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Filter templates
  const filteredTemplates = templates.filter((template) => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || template.meeting_type === filterType;
    return matchesSearch && matchesType;
  });

  // Group templates by meeting type
  const groupedTemplates = filteredTemplates.reduce((acc, template) => {
    const type = template.meeting_type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(template);
    return acc;
  }, {} as Record<MeetingType, CoachingScorecardTemplate[]>);

  // Handle save template
  const handleSaveTemplate = async (templateData: Partial<CoachingScorecardTemplate>) => {
    if (!user) return;

    try {
      setSaving(true);

      // Get user's org_id
      const { data: membership } = await supabase
        .from('organization_memberships')
        .select('org_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (!membership?.org_id) {
        throw new Error('Organization not found');
      }

      if (templateData.id) {
        // Update existing template
        const { error: updateError } = await supabase
          .from('coaching_scorecard_templates')
          .update({
            name: templateData.name,
            description: templateData.description,
            meeting_type: templateData.meeting_type,
            metrics: templateData.metrics,
            checklist_items: templateData.checklist_items,
            script_flow: templateData.script_flow,
            is_active: templateData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', templateData.id)
          .eq('org_id', membership.org_id);

        if (updateError) throw updateError;
        toast.success('Template updated successfully');
      } else {
        // Create new template
        const { error: insertError } = await supabase
          .from('coaching_scorecard_templates')
          .insert({
            org_id: membership.org_id,
            name: templateData.name,
            description: templateData.description,
            meeting_type: templateData.meeting_type,
            metrics: templateData.metrics,
            checklist_items: templateData.checklist_items,
            script_flow: templateData.script_flow,
            is_active: templateData.is_active ?? true,
            created_by: user.id,
          });

        if (insertError) throw insertError;
        toast.success('Template created successfully');
      }

      setShowEditor(false);
      setEditingTemplate(null);
      refresh();
    } catch (err) {
      console.error('Failed to save template:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  // Handle delete template
  const handleDeleteTemplate = async (templateId: string) => {
    try {
      setDeletingId(templateId);

      const { error: deleteError } = await supabase
        .from('coaching_scorecard_templates')
        .delete()
        .eq('id', templateId);

      if (deleteError) throw deleteError;

      toast.success('Template deleted');
      setShowDeleteConfirm(null);
      refresh();
    } catch (err) {
      console.error('Failed to delete template:', err);
      toast.error('Failed to delete template');
    } finally {
      setDeletingId(null);
    }
  };

  // Handle toggle active status
  const handleToggleActive = async (template: CoachingScorecardTemplate) => {
    try {
      const { error: updateError } = await supabase
        .from('coaching_scorecard_templates')
        .update({ is_active: !template.is_active })
        .eq('id', template.id);

      if (updateError) throw updateError;

      toast.success(`Template ${template.is_active ? 'deactivated' : 'activated'}`);
      refresh();
    } catch (err) {
      console.error('Failed to toggle template:', err);
      toast.error('Failed to update template');
    }
  };

  // Handle duplicate template
  const handleDuplicateTemplate = async (template: CoachingScorecardTemplate) => {
    const duplicateData: Partial<CoachingScorecardTemplate> = {
      name: `${template.name} (Copy)`,
      description: template.description,
      meeting_type: template.meeting_type,
      metrics: template.metrics,
      checklist_items: template.checklist_items,
      script_flow: template.script_flow,
      is_active: false,
    };

    setEditingTemplate(null);
    setShowEditor(true);
    // Pre-populate the editor with duplicate data by setting editing template
    setTimeout(() => {
      setEditingTemplate(duplicateData as CoachingScorecardTemplate);
    }, 0);
  };

  // Create default templates
  const handleCreateDefaultTemplates = async () => {
    try {
      setSaving(true);

      const { data: membership } = await supabase
        .from('organization_memberships')
        .select('org_id')
        .eq('user_id', user?.id)
        .limit(1)
        .single();

      if (!membership?.org_id) {
        throw new Error('Organization not found');
      }

      const defaultTemplates = getDefaultTemplates(membership.org_id, user?.id || '');

      const { error: insertError } = await supabase
        .from('coaching_scorecard_templates')
        .insert(defaultTemplates);

      if (insertError) throw insertError;

      toast.success('Default templates created');
      refresh();
    } catch (err) {
      console.error('Failed to create default templates:', err);
      toast.error('Failed to create default templates');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/admin"
            className="p-2 hover:bg-muted rounded-md"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Coaching Scorecard Templates</h1>
            <p className="text-muted-foreground">
              Configure AI-powered coaching scorecards for different meeting types
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {templates.length === 0 && (
            <button
              onClick={handleCreateDefaultTemplates}
              disabled={saving}
              className="px-4 py-2 text-sm border rounded-md hover:bg-muted flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Create Default Templates
            </button>
          )}
          <button
            onClick={() => {
              setEditingTemplate(null);
              setShowEditor(true);
            }}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            New Template
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-10 pr-4 py-2 border rounded-md bg-background"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as MeetingType | 'all')}
          className="px-3 py-2 border rounded-md bg-background"
        >
          <option value="all">All Types</option>
          {Object.entries(MEETING_TYPE_CONFIG).map(([type, config]) => (
            <option key={type} value={type}>
              {config.label}
            </option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.entries(MEETING_TYPE_CONFIG).map(([type, config]) => {
          const count = templates.filter(t => t.meeting_type === type).length;
          const activeCount = templates.filter(t => t.meeting_type === type && t.is_active).length;
          return (
            <div
              key={type}
              className={cn(
                'p-4 rounded-lg border cursor-pointer transition-colors',
                filterType === type ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
              )}
              onClick={() => setFilterType(filterType === type ? 'all' : type as MeetingType)}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={cn('w-3 h-3 rounded-full', config.color)} />
                <span className="text-sm font-medium">{config.label}</span>
              </div>
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-xs text-muted-foreground">
                {activeCount} active
              </div>
            </div>
          );
        })}
      </div>

      {/* Template List */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-lg">
          <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium mb-2">No Templates Found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {templates.length === 0
              ? 'Get started by creating your first scorecard template'
              : 'Try adjusting your search or filter criteria'}
          </p>
          {templates.length === 0 && (
            <button
              onClick={handleCreateDefaultTemplates}
              disabled={saving}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Create Default Templates
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedTemplates).map(([type, typeTemplates]) => (
            <div key={type}>
              <div className="flex items-center gap-2 mb-3">
                <div className={cn('w-3 h-3 rounded-full', MEETING_TYPE_CONFIG[type as MeetingType].color)} />
                <h3 className="font-medium">{MEETING_TYPE_CONFIG[type as MeetingType].label} Templates</h3>
                <span className="text-sm text-muted-foreground">({typeTemplates.length})</span>
              </div>
              <div className="grid gap-4">
                {typeTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onEdit={() => {
                      setEditingTemplate(template);
                      setShowEditor(true);
                    }}
                    onDelete={() => setShowDeleteConfirm(template.id)}
                    onDuplicate={() => handleDuplicateTemplate(template)}
                    onToggleActive={() => handleToggleActive(template)}
                    deleting={deletingId === template.id}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      <AnimatePresence>
        {showEditor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => {
              if (!saving) {
                setShowEditor(false);
                setEditingTemplate(null);
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              <ScorecardTemplateEditor
                template={editingTemplate}
                onSave={handleSaveTemplate}
                onCancel={() => {
                  setShowEditor(false);
                  setEditingTemplate(null);
                }}
                saving={saving}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setShowDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-background rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-full bg-red-500/10">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <h3 className="font-semibold">Delete Template</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Are you sure you want to delete this template? This action cannot be undone.
                Existing scorecards using this template will not be affected.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="px-4 py-2 text-sm border rounded-md hover:bg-muted"
                  disabled={!!deletingId}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteTemplate(showDeleteConfirm)}
                  className="px-4 py-2 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 flex items-center gap-2"
                  disabled={!!deletingId}
                >
                  {deletingId ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Template Card Component
function TemplateCard({
  template,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleActive,
  deleting,
}: {
  template: CoachingScorecardTemplate;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleActive: () => void;
  deleting: boolean;
}) {
  const metricsCount = template.metrics?.length || 0;
  const checklistCount = template.checklist_items?.length || 0;
  const scriptSteps = template.script_flow?.length || 0;

  return (
    <div className={cn(
      'p-4 border rounded-lg transition-colors',
      template.is_active ? 'bg-background' : 'bg-muted/30 opacity-75'
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium">{template.name}</h4>
            {!template.is_active && (
              <span className="px-2 py-0.5 text-xs bg-muted rounded">Inactive</span>
            )}
          </div>
          {template.description && (
            <p className="text-sm text-muted-foreground mb-3">{template.description}</p>
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <BarChart3 className="h-3.5 w-3.5" />
              {metricsCount} metrics
            </div>
            <div className="flex items-center gap-1">
              <ListChecks className="h-3.5 w-3.5" />
              {checklistCount} checklist items
            </div>
            {scriptSteps > 0 && (
              <div className="flex items-center gap-1">
                <Route className="h-3.5 w-3.5" />
                {scriptSteps} script steps
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleActive}
            className={cn(
              'p-2 rounded hover:bg-muted',
              template.is_active ? 'text-green-500' : 'text-muted-foreground'
            )}
            title={template.is_active ? 'Deactivate' : 'Activate'}
          >
            {template.is_active ? (
              <ToggleRight className="h-5 w-5" />
            ) : (
              <ToggleLeft className="h-5 w-5" />
            )}
          </button>
          <button
            onClick={onDuplicate}
            className="p-2 rounded hover:bg-muted text-muted-foreground"
            title="Duplicate"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            onClick={onEdit}
            className="p-2 rounded hover:bg-muted text-muted-foreground"
            title="Edit"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="p-2 rounded hover:bg-red-500/10 text-red-500"
            title="Delete"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Default templates helper
function getDefaultTemplates(orgId: string, userId: string): Partial<CoachingScorecardTemplate>[] {
  return [
    {
      org_id: orgId,
      name: 'Discovery Call Excellence',
      description: 'Evaluate discovery call effectiveness with focus on qualification and pain exploration',
      meeting_type: 'discovery',
      is_active: true,
      created_by: userId,
      metrics: [
        { id: 'talk_time', name: 'Talk Time Ratio', weight: 20, ideal_range: { min: 30, max: 40 }, description: 'Rep should listen more than talk' },
        { id: 'discovery_qs', name: 'Discovery Questions', weight: 30, ideal_range: { min: 8, max: 15 }, description: 'Open-ended questions asked' },
        { id: 'monologues', name: 'Monologue Control', weight: 20, ideal_range: { min: 0, max: 2 }, description: 'Extended speaking periods >90s' },
        { id: 'checklist', name: 'Checklist Completion', weight: 30, ideal_range: { min: 80, max: 100 }, description: 'Key items covered' },
      ],
      checklist_items: [
        { id: 'pain_1', question: 'Asked about current process/pain points', required: true, category: 'discovery' },
        { id: 'pain_2', question: 'Identified decision makers', required: true, category: 'qualification' },
        { id: 'pain_3', question: 'Discussed budget/timeline', required: true, category: 'qualification' },
        { id: 'pain_4', question: 'Uncovered success criteria', required: false, category: 'discovery' },
        { id: 'pain_5', question: 'Asked about competitors considered', required: false, category: 'discovery' },
        { id: 'pain_6', question: 'Established clear next steps', required: true, category: 'closing' },
      ],
      script_flow: [
        { step_number: 1, step_name: 'Introduction', expected_topics: ['rapport', 'agenda'], duration_guidance: '2-3 min' },
        { step_number: 2, step_name: 'Pain Discovery', expected_topics: ['challenges', 'impact', 'timeline'], duration_guidance: '10-15 min' },
        { step_number: 3, step_name: 'Qualification', expected_topics: ['decision process', 'budget', 'stakeholders'], duration_guidance: '5-8 min' },
        { step_number: 4, step_name: 'Next Steps', expected_topics: ['demo scheduling', 'follow-up items'], duration_guidance: '3-5 min' },
      ],
    },
    {
      org_id: orgId,
      name: 'Demo Call Mastery',
      description: 'Assess demo effectiveness with focus on tailoring to prospect needs and engagement',
      meeting_type: 'demo',
      is_active: true,
      created_by: userId,
      metrics: [
        { id: 'talk_time', name: 'Talk Time Ratio', weight: 20, ideal_range: { min: 40, max: 55 }, description: 'More talking expected during demo' },
        { id: 'engagement', name: 'Engagement Checks', weight: 25, ideal_range: { min: 4, max: 8 }, description: 'Questions to confirm understanding' },
        { id: 'tailoring', name: 'Pain Tailoring', weight: 30, ideal_range: { min: 3, max: 6 }, description: 'References to their specific challenges' },
        { id: 'checklist', name: 'Checklist Completion', weight: 25, ideal_range: { min: 75, max: 100 }, description: 'Key demo items covered' },
      ],
      checklist_items: [
        { id: 'demo_1', question: 'Confirmed attendees and roles', required: true, category: 'qualification' },
        { id: 'demo_2', question: 'Recapped discovered pain points', required: true, category: 'presentation' },
        { id: 'demo_3', question: 'Tailored demo to stated needs', required: true, category: 'presentation' },
        { id: 'demo_4', question: 'Asked for feedback during demo', required: false, category: 'relationship_building' },
        { id: 'demo_5', question: 'Addressed questions/objections', required: true, category: 'objection_handling' },
        { id: 'demo_6', question: 'Established clear next steps', required: true, category: 'closing' },
      ],
      script_flow: [
        { step_number: 1, step_name: 'Recap Pain', expected_topics: ['previous findings', 'agenda confirmation'], duration_guidance: '3-5 min' },
        { step_number: 2, step_name: 'Feature Demo', expected_topics: ['core features', 'value mapping'], duration_guidance: '15-20 min' },
        { step_number: 3, step_name: 'Use Case Demo', expected_topics: ['specific scenarios', 'workflow examples'], duration_guidance: '10-15 min' },
        { step_number: 4, step_name: 'Q&A', expected_topics: ['objections', 'technical questions'], duration_guidance: '5-10 min' },
        { step_number: 5, step_name: 'Next Steps', expected_topics: ['proposal', 'stakeholder alignment'], duration_guidance: '3-5 min' },
      ],
    },
    {
      org_id: orgId,
      name: 'Negotiation Navigation',
      description: 'Guide reps through effective negotiation with focus on value and objection handling',
      meeting_type: 'negotiation',
      is_active: true,
      created_by: userId,
      metrics: [
        { id: 'talk_time', name: 'Talk Time Ratio', weight: 20, ideal_range: { min: 35, max: 50 }, description: 'Balanced conversation' },
        { id: 'value_statements', name: 'Value Reinforcement', weight: 30, ideal_range: { min: 3, max: 6 }, description: 'ROI and value mentions' },
        { id: 'objections', name: 'Objection Resolution', weight: 25, ideal_range: { min: 80, max: 100 }, description: 'Concerns addressed successfully' },
        { id: 'checklist', name: 'Checklist Completion', weight: 25, ideal_range: { min: 80, max: 100 }, description: 'Negotiation items covered' },
      ],
      checklist_items: [
        { id: 'neg_1', question: 'Confirmed decision process', required: true, category: 'qualification' },
        { id: 'neg_2', question: 'Addressed outstanding concerns', required: true, category: 'objection_handling' },
        { id: 'neg_3', question: 'Discussed pricing/terms', required: true, category: 'closing' },
        { id: 'neg_4', question: 'Identified blockers to signing', required: true, category: 'objection_handling' },
        { id: 'neg_5', question: 'Agreed on timeline to close', required: true, category: 'closing' },
      ],
      script_flow: [
        { step_number: 1, step_name: 'Status Check', expected_topics: ['stakeholder alignment', 'concerns'], duration_guidance: '5-8 min' },
        { step_number: 2, step_name: 'Value Recap', expected_topics: ['ROI', 'business impact'], duration_guidance: '5-10 min' },
        { step_number: 3, step_name: 'Terms Discussion', expected_topics: ['pricing', 'contract terms', 'implementation'], duration_guidance: '10-15 min' },
        { step_number: 4, step_name: 'Commitment', expected_topics: ['next steps', 'timeline', 'signatures'], duration_guidance: '5-8 min' },
      ],
    },
    {
      org_id: orgId,
      name: 'Closing Excellence',
      description: 'Final push to close with focus on commitment and onboarding preparation',
      meeting_type: 'closing',
      is_active: true,
      created_by: userId,
      metrics: [
        { id: 'talk_time', name: 'Talk Time Ratio', weight: 15, ideal_range: { min: 30, max: 45 }, description: 'Customer should be confirming' },
        { id: 'commitment', name: 'Commitment Asks', weight: 35, ideal_range: { min: 2, max: 4 }, description: 'Direct close attempts' },
        { id: 'objections', name: 'Final Objection Handling', weight: 25, ideal_range: { min: 90, max: 100 }, description: 'Last concerns resolved' },
        { id: 'checklist', name: 'Checklist Completion', weight: 25, ideal_range: { min: 90, max: 100 }, description: 'Closing items covered' },
      ],
      checklist_items: [
        { id: 'close_1', question: 'Final objection handling', required: true, category: 'objection_handling' },
        { id: 'close_2', question: 'Contract terms confirmed', required: true, category: 'closing' },
        { id: 'close_3', question: 'Implementation timeline set', required: true, category: 'follow_up' },
        { id: 'close_4', question: 'Stakeholder sign-off confirmed', required: true, category: 'qualification' },
        { id: 'close_5', question: 'Onboarding next steps defined', required: true, category: 'follow_up' },
      ],
      script_flow: [
        { step_number: 1, step_name: 'Final Questions', expected_topics: ['outstanding concerns', 'blockers'], duration_guidance: '5-8 min' },
        { step_number: 2, step_name: 'Agreement Review', expected_topics: ['terms confirmation', 'signatures'], duration_guidance: '5-10 min' },
        { step_number: 3, step_name: 'Onboarding Preview', expected_topics: ['implementation', 'success metrics'], duration_guidance: '5-8 min' },
        { step_number: 4, step_name: 'Celebration', expected_topics: ['thanks', 'relationship building'], duration_guidance: '2-3 min' },
      ],
    },
  ];
}
