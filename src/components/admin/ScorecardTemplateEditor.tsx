/**
 * Scorecard Template Editor Component
 *
 * Admin component for creating and editing coaching scorecard templates.
 * Features:
 * - Configure metrics with weights and ideal ranges
 * - Define checklist items with categories
 * - Set up script flow steps
 * - Preview template configuration
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  GripVertical,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  Settings,
  ListChecks,
  Route,
  BarChart3,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  CoachingScorecardTemplate,
  MetricConfig,
  ChecklistItem,
  ScriptStep,
  MeetingType,
} from '@/lib/types/meetingIntelligence';

// Backwards-compatible aliases for older editor terminology.
type ScorecardMetric = MetricConfig;
type ScriptFlowStep = ScriptStep & {
  key_questions?: string[];
  duration_guidance?: string;
};

interface ScorecardTemplateEditorProps {
  template?: CoachingScorecardTemplate | null;
  onSave: (template: Partial<CoachingScorecardTemplate>) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
}

const MEETING_TYPES: { value: MeetingType; label: string; description: string }[] = [
  { value: 'discovery', label: 'Discovery Call', description: 'Initial qualification and pain point exploration' },
  { value: 'demo', label: 'Demo Call', description: 'Product demonstration tailored to prospect needs' },
  { value: 'negotiation', label: 'Negotiation Call', description: 'Terms discussion and objection handling' },
  { value: 'closing', label: 'Closing Call', description: 'Final agreement and contract signing' },
  { value: 'general', label: 'General Meeting', description: 'Standard meeting without specific template' },
];

const CHECKLIST_CATEGORIES = [
  'discovery',
  'qualification',
  'presentation',
  'objection_handling',
  'closing',
  'follow_up',
  'relationship_building',
];

export function ScorecardTemplateEditor({
  template,
  onSave,
  onCancel,
  saving = false,
}: ScorecardTemplateEditorProps) {
  const isEditing = !!template?.id;

  // Form state
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [meetingType, setMeetingType] = useState<MeetingType>(template?.meeting_type || 'general');
  const [metrics, setMetrics] = useState<ScorecardMetric[]>(template?.metrics || getDefaultMetrics());
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(template?.checklist_items || []);
  const [scriptFlow, setScriptFlow] = useState<ScriptFlowStep[]>(template?.script_flow || []);
  const [isActive, setIsActive] = useState(template?.is_active ?? true);

  // UI state
  const [activeTab, setActiveTab] = useState<'metrics' | 'checklist' | 'script'>('metrics');
  const [errors, setErrors] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    metrics: true,
    checklist: false,
    script: false,
  });

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    if (!name.trim()) {
      newErrors.push('Template name is required');
    }

    if (metrics.length === 0) {
      newErrors.push('At least one metric is required');
    }

    const totalWeight = metrics.reduce((sum, m) => sum + m.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      newErrors.push(`Metric weights must sum to 100% (current: ${totalWeight.toFixed(1)}%)`);
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  // Handle save
  const handleSave = async () => {
    if (!validateForm()) return;

    const templateData: Partial<CoachingScorecardTemplate> = {
      name: name.trim(),
      description: description.trim() || null,
      meeting_type: meetingType,
      metrics,
      checklist_items: checklistItems,
      script_flow: scriptFlow.length > 0 ? scriptFlow : null,
      is_active: isActive,
    };

    if (template?.id) {
      templateData.id = template.id;
    }

    await onSave(templateData);
  };

  return (
    <div className="bg-background rounded-lg border shadow-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">
          {isEditing ? 'Edit Template' : 'Create Scorecard Template'}
        </h2>
        <button
          onClick={onCancel}
          className="p-2 hover:bg-muted rounded-md"
          disabled={saving}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Template Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Discovery Call Excellence"
                className="w-full px-3 py-2 border rounded-md bg-background"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Meeting Type *</label>
              <select
                value={meetingType}
                onChange={(e) => setMeetingType(e.target.value as MeetingType)}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                {MEETING_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the purpose and goals of this scorecard template..."
              rows={2}
              className="w-full px-3 py-2 border rounded-md bg-background resize-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="is-active" className="text-sm">
              Template is active and can be used for scoring
            </label>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <div className="flex gap-4">
            <TabButton
              active={activeTab === 'metrics'}
              onClick={() => setActiveTab('metrics')}
              icon={BarChart3}
              label="Metrics"
              count={metrics.length}
            />
            <TabButton
              active={activeTab === 'checklist'}
              onClick={() => setActiveTab('checklist')}
              icon={ListChecks}
              label="Checklist"
              count={checklistItems.length}
            />
            <TabButton
              active={activeTab === 'script'}
              onClick={() => setActiveTab('script')}
              icon={Route}
              label="Script Flow"
              count={scriptFlow.length}
            />
          </div>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'metrics' && (
            <MetricsEditor
              key="metrics"
              metrics={metrics}
              onChange={setMetrics}
            />
          )}
          {activeTab === 'checklist' && (
            <ChecklistEditor
              key="checklist"
              items={checklistItems}
              onChange={setChecklistItems}
            />
          )}
          {activeTab === 'script' && (
            <ScriptFlowEditor
              key="script"
              steps={scriptFlow}
              onChange={setScriptFlow}
            />
          )}
        </AnimatePresence>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            {errors.map((error, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 p-4 border-t bg-muted/30">
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 text-sm border rounded-md hover:bg-muted"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {isEditing ? 'Update Template' : 'Create Template'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// Tab Button Component
function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
      <span className={cn(
        'px-1.5 py-0.5 rounded-full text-xs',
        active ? 'bg-primary/10' : 'bg-muted'
      )}>
        {count}
      </span>
    </button>
  );
}

// Metrics Editor Component
function MetricsEditor({
  metrics,
  onChange,
}: {
  metrics: ScorecardMetric[];
  onChange: (metrics: ScorecardMetric[]) => void;
}) {
  const addMetric = () => {
    const newMetric: ScorecardMetric = {
      id: `metric_${Date.now()}`,
      name: '',
      weight: 0,
      enabled: true,
      ideal_range: { min: 0, max: 100 },
      description: '',
    };
    onChange([...metrics, newMetric]);
  };

  const updateMetric = (index: number, updates: Partial<ScorecardMetric>) => {
    const updated = [...metrics];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const removeMetric = (index: number) => {
    onChange(metrics.filter((_, i) => i !== index));
  };

  const totalWeight = metrics.reduce((sum, m) => sum + m.weight, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Scoring Metrics</h3>
          <p className="text-sm text-muted-foreground">
            Define metrics that will be used to score reps. Weights must sum to 100%.
          </p>
        </div>
        <div className={cn(
          'text-sm font-medium px-2 py-1 rounded',
          Math.abs(totalWeight - 100) > 0.01
            ? 'bg-yellow-500/10 text-yellow-600'
            : 'bg-green-500/10 text-green-600'
        )}>
          Total: {totalWeight.toFixed(0)}%
        </div>
      </div>

      <div className="space-y-3">
        {metrics.map((metric, index) => (
          <div
            key={metric.id}
            className="p-4 border rounded-lg bg-muted/30 space-y-3"
          >
            <div className="flex items-start gap-3">
              <GripVertical className="h-5 w-5 text-muted-foreground mt-2 cursor-grab" />
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Metric Name</label>
                  <input
                    type="text"
                    value={metric.name}
                    onChange={(e) => updateMetric(index, { name: e.target.value })}
                    placeholder="e.g., Talk Time Ratio"
                    className="w-full px-2 py-1.5 text-sm border rounded bg-background"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Weight (%)</label>
                  <input
                    type="number"
                    value={metric.weight}
                    onChange={(e) => updateMetric(index, { weight: parseFloat(e.target.value) || 0 })}
                    min={0}
                    max={100}
                    className="w-full px-2 py-1.5 text-sm border rounded bg-background"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-medium mb-1">Ideal Min</label>
                    <input
                      type="number"
                      value={metric.ideal_range.min}
                      onChange={(e) => updateMetric(index, {
                        ideal_range: { ...metric.ideal_range, min: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-full px-2 py-1.5 text-sm border rounded bg-background"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium mb-1">Ideal Max</label>
                    <input
                      type="number"
                      value={metric.ideal_range.max}
                      onChange={(e) => updateMetric(index, {
                        ideal_range: { ...metric.ideal_range, max: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-full px-2 py-1.5 text-sm border rounded bg-background"
                    />
                  </div>
                </div>
              </div>
              <button
                onClick={() => removeMetric(index)}
                className="p-1.5 hover:bg-red-500/10 rounded text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Description</label>
              <input
                type="text"
                value={metric.description || ''}
                onChange={(e) => updateMetric(index, { description: e.target.value })}
                placeholder="Brief description of this metric..."
                className="w-full px-2 py-1.5 text-sm border rounded bg-background"
              />
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addMetric}
        className="w-full py-2 border-2 border-dashed rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-primary transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="h-4 w-4" />
        Add Metric
      </button>
    </motion.div>
  );
}

// Checklist Editor Component
function ChecklistEditor({
  items,
  onChange,
}: {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
}) {
  const addItem = () => {
    const newItem: ChecklistItem = {
      id: `checklist_${Date.now()}`,
      question: '',
      required: false,
      category: 'discovery',
      order: items.length,
    };
    onChange([...items, newItem]);
  };

  const updateItem = (index: number, updates: Partial<ChecklistItem>) => {
    const updated = [...items];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4"
    >
      <div>
        <h3 className="font-medium">Checklist Items</h3>
        <p className="text-sm text-muted-foreground">
          Define items that reps should cover during the call. AI will detect if each was addressed.
        </p>
      </div>

      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30"
          >
            <GripVertical className="h-5 w-5 text-muted-foreground mt-1.5 cursor-grab" />
            <div className="flex-1 space-y-2">
              <input
                type="text"
                value={item.question}
                onChange={(e) => updateItem(index, { question: e.target.value })}
                placeholder="e.g., Asked about current process/pain points"
                className="w-full px-2 py-1.5 text-sm border rounded bg-background"
              />
              <div className="flex items-center gap-4">
                <select
                  value={item.category}
                  onChange={(e) => updateItem(index, { category: e.target.value })}
                  className="px-2 py-1 text-xs border rounded bg-background"
                >
                  {CHECKLIST_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={item.required}
                    onChange={(e) => updateItem(index, { required: e.target.checked })}
                    className="rounded"
                  />
                  Required
                </label>
              </div>
            </div>
            <button
              onClick={() => removeItem(index)}
              className="p-1.5 hover:bg-red-500/10 rounded text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addItem}
        className="w-full py-2 border-2 border-dashed rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-primary transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="h-4 w-4" />
        Add Checklist Item
      </button>
    </motion.div>
  );
}

// Script Flow Editor Component
function ScriptFlowEditor({
  steps,
  onChange,
}: {
  steps: ScriptFlowStep[];
  onChange: (steps: ScriptFlowStep[]) => void;
}) {
  const addStep = () => {
    const newStep: ScriptFlowStep = {
      step_number: steps.length + 1,
      step_name: '',
      expected_topics: [],
      key_questions: [],
      duration_guidance: '',
      required: false,
    };
    onChange([...steps, newStep]);
  };

  const updateStep = (index: number, updates: Partial<ScriptFlowStep>) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const removeStep = (index: number) => {
    const updated = steps.filter((_, i) => i !== index);
    // Renumber steps
    updated.forEach((step, i) => {
      step.step_number = i + 1;
    });
    onChange(updated);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4"
    >
      <div>
        <h3 className="font-medium">Script Flow</h3>
        <p className="text-sm text-muted-foreground">
          Define the expected flow of the call. AI will analyze how well reps followed the script.
        </p>
      </div>

      <div className="space-y-3">
        {steps.map((step, index) => (
          <div
            key={index}
            className="p-4 border rounded-lg bg-muted/30 space-y-3"
          >
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-medium text-sm">
                {step.step_number}
              </div>
              <div className="flex-1 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Step Name</label>
                    <input
                      type="text"
                      value={step.step_name}
                      onChange={(e) => updateStep(index, { step_name: e.target.value })}
                      placeholder="e.g., Pain Discovery"
                      className="w-full px-2 py-1.5 text-sm border rounded bg-background"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Duration Guidance</label>
                    <input
                      type="text"
                      value={step.duration_guidance || ''}
                      onChange={(e) => updateStep(index, { duration_guidance: e.target.value })}
                      placeholder="e.g., 5-10 minutes"
                      className="w-full px-2 py-1.5 text-sm border rounded bg-background"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Expected Topics (comma-separated)</label>
                  <input
                    type="text"
                    value={step.expected_topics.join(', ')}
                    onChange={(e) => updateStep(index, {
                      expected_topics: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                    })}
                    placeholder="e.g., current challenges, desired outcomes, timeline"
                    className="w-full px-2 py-1.5 text-sm border rounded bg-background"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Key Questions (comma-separated)</label>
                  <input
                    type="text"
                    value={step.key_questions?.join(', ') || ''}
                    onChange={(e) => updateStep(index, {
                      key_questions: e.target.value.split(',').map(q => q.trim()).filter(Boolean)
                    })}
                    placeholder="e.g., What's your biggest challenge?, Who else is involved?"
                    className="w-full px-2 py-1.5 text-sm border rounded bg-background"
                  />
                </div>
              </div>
              <button
                onClick={() => removeStep(index)}
                className="p-1.5 hover:bg-red-500/10 rounded text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addStep}
        className="w-full py-2 border-2 border-dashed rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-primary transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="h-4 w-4" />
        Add Script Step
      </button>
    </motion.div>
  );
}

// Default metrics helper
function getDefaultMetrics(): ScorecardMetric[] {
  return [
    {
      id: 'talk_time_ratio',
      name: 'Talk Time Ratio',
      weight: 25,
      enabled: true,
      ideal_range: { min: 30, max: 50 },
      description: 'Percentage of time the rep spoke (ideal: listen more)',
    },
    {
      id: 'discovery_questions',
      name: 'Discovery Questions',
      weight: 25,
      enabled: true,
      ideal_range: { min: 5, max: 15 },
      description: 'Number of open-ended discovery questions asked',
    },
    {
      id: 'monologue_score',
      name: 'Monologue Score',
      weight: 20,
      enabled: true,
      ideal_range: { min: 0, max: 3 },
      description: 'Number of extended monologues (>90 seconds)',
    },
    {
      id: 'checklist_completion',
      name: 'Checklist Completion',
      weight: 30,
      enabled: true,
      ideal_range: { min: 80, max: 100 },
      description: 'Percentage of checklist items covered',
    },
  ];
}

export default ScorecardTemplateEditor;
