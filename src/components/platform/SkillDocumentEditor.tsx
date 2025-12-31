/**
 * SkillDocumentEditor Component
 *
 * Split-pane editor for creating/editing platform skill documents.
 * Left panel: Frontmatter form (metadata)
 * Right panel: Markdown textarea for content template
 */

import { useState, useRef, useCallback } from 'react';
import {
  Save,
  X,
  AlertTriangle,
  Info,
  Plus,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ContextVariablePicker } from './ContextVariablePicker';
import {
  type PlatformSkill,
  type SkillCategory,
  type CreatePlatformSkillInput,
  type UpdatePlatformSkillInput,
  SKILL_CATEGORIES,
  extractVariablesFromTemplate,
} from '@/lib/hooks/usePlatformSkills';

interface SkillDocumentEditorProps {
  skill?: PlatformSkill;
  category: SkillCategory;
  onSave: (input: CreatePlatformSkillInput | UpdatePlatformSkillInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function SkillDocumentEditor({
  skill,
  category,
  onSave,
  onCancel,
  isLoading = false,
}: SkillDocumentEditorProps) {
  const isEditing = !!skill;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Form state
  const [skillKey, setSkillKey] = useState(skill?.skill_key || '');
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory>(
    skill?.category || category
  );
  const [name, setName] = useState(skill?.frontmatter.name || '');
  const [description, setDescription] = useState(skill?.frontmatter.description || '');
  const [triggers, setTriggers] = useState<string[]>(skill?.frontmatter.triggers || []);
  const [requiresContext, setRequiresContext] = useState<string[]>(
    skill?.frontmatter.requires_context || []
  );
  const [contentTemplate, setContentTemplate] = useState(skill?.content_template || '');

  // New trigger/context input
  const [newTrigger, setNewTrigger] = useState('');
  const [newContext, setNewContext] = useState('');

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Extract variables from template for display
  const extractedVariables = extractVariablesFromTemplate(contentTemplate);

  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};

    if (!skillKey.trim()) {
      newErrors.skillKey = 'Skill key is required';
    } else if (!/^[a-z0-9-]+$/.test(skillKey)) {
      newErrors.skillKey = 'Skill key must be lowercase with dashes only';
    }

    if (!name.trim()) {
      newErrors.name = 'Skill name is required';
    }

    if (!description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!contentTemplate.trim()) {
      newErrors.contentTemplate = 'Content template is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [skillKey, name, description, contentTemplate]);

  const handleSave = async () => {
    if (!validateForm()) return;

    const frontmatter = {
      name: name.trim(),
      description: description.trim(),
      triggers: triggers.filter((t) => t.trim()),
      requires_context: requiresContext.filter((c) => c.trim()),
    };

    if (isEditing) {
      await onSave({
        frontmatter,
        content_template: contentTemplate,
      } as UpdatePlatformSkillInput);
    } else {
      await onSave({
        skill_key: skillKey.trim(),
        category: selectedCategory,
        frontmatter,
        content_template: contentTemplate,
      } as CreatePlatformSkillInput);
    }
  };

  const handleInsertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = contentTemplate;
    const variableText = `\${${variable}}`;

    setContentTemplate(text.slice(0, start) + variableText + text.slice(end));

    // Restore focus and cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variableText.length, start + variableText.length);
    }, 0);
  };

  const addTrigger = () => {
    if (newTrigger.trim() && !triggers.includes(newTrigger.trim())) {
      setTriggers([...triggers, newTrigger.trim()]);
      setNewTrigger('');
    }
  };

  const removeTrigger = (index: number) => {
    setTriggers(triggers.filter((_, i) => i !== index));
  };

  const addContext = () => {
    if (newContext.trim() && !requiresContext.includes(newContext.trim())) {
      setRequiresContext([...requiresContext, newContext.trim()]);
      setNewContext('');
    }
  };

  const removeContext = (index: number) => {
    setRequiresContext(requiresContext.filter((_, i) => i !== index));
  };

  return (
    <div className="flex h-full">
      {/* Left Panel: Frontmatter Form */}
      <div className="w-1/3 border-r border-gray-200 dark:border-gray-700/50 overflow-y-auto">
        <div className="p-6 space-y-5">
          <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm uppercase tracking-wide">
            Skill Metadata
          </h3>

          {/* Skill Key */}
          <div>
            <Label
              htmlFor="skillKey"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Skill Key *
            </Label>
            <Input
              id="skillKey"
              value={skillKey}
              onChange={(e) => setSkillKey(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              placeholder="lead-qualification"
              disabled={isEditing}
              className={cn(
                'mt-1.5 bg-white dark:bg-gray-800/50',
                'border-gray-300 dark:border-gray-700/50',
                'text-gray-900 dark:text-gray-100 font-mono text-sm',
                errors.skillKey && 'border-red-500'
              )}
            />
            {errors.skillKey && (
              <p className="text-xs text-red-500 mt-1">{errors.skillKey}</p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Unique identifier (lowercase, dashes only)
            </p>
          </div>

          {/* Category */}
          <div>
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Category *
            </Label>
            <Select
              value={selectedCategory}
              onValueChange={(v) => setSelectedCategory(v as SkillCategory)}
              disabled={isEditing}
            >
              <SelectTrigger className="mt-1.5 bg-white dark:bg-gray-800/50 border-gray-300 dark:border-gray-700/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SKILL_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Name */}
          <div>
            <Label
              htmlFor="name"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Display Name *
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Lead Qualification"
              className={cn(
                'mt-1.5 bg-white dark:bg-gray-800/50',
                'border-gray-300 dark:border-gray-700/50',
                'text-gray-900 dark:text-gray-100',
                errors.name && 'border-red-500'
              )}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          {/* Description */}
          <div>
            <Label
              htmlFor="description"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Description *
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Qualify leads based on company ICP..."
              rows={3}
              className={cn(
                'mt-1.5 bg-white dark:bg-gray-800/50',
                'border-gray-300 dark:border-gray-700/50',
                'text-gray-900 dark:text-gray-100 resize-none',
                errors.description && 'border-red-500'
              )}
            />
            {errors.description && (
              <p className="text-xs text-red-500 mt-1">{errors.description}</p>
            )}
          </div>

          {/* Triggers */}
          <div>
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Triggers
            </Label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Events that activate this skill
            </p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {triggers.map((trigger, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 gap-1"
                >
                  {trigger}
                  <button
                    type="button"
                    onClick={() => removeTrigger(index)}
                    className="hover:text-blue-900 dark:hover:text-blue-200"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newTrigger}
                onChange={(e) => setNewTrigger(e.target.value)}
                placeholder="lead_created"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTrigger())}
                className="flex-1 bg-white dark:bg-gray-800/50 border-gray-300 dark:border-gray-700/50 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addTrigger}
                className="shrink-0"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Required Context */}
          <div>
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Required Context
            </Label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Context variables needed by this skill
            </p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {requiresContext.map((ctx, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800 gap-1 font-mono text-xs"
                >
                  {ctx}
                  <button
                    type="button"
                    onClick={() => removeContext(index)}
                    className="hover:text-purple-900 dark:hover:text-purple-200"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newContext}
                onChange={(e) => setNewContext(e.target.value)}
                placeholder="company_name"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addContext())}
                className="flex-1 bg-white dark:bg-gray-800/50 border-gray-300 dark:border-gray-700/50 text-sm font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addContext}
                className="shrink-0"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Extracted Variables */}
          {extractedVariables.length > 0 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    Detected Variables
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {extractedVariables.map((v) => (
                      <code
                        key={v}
                        className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs rounded font-mono"
                      >
                        {v}
                      </code>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Content Template */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="border-b border-gray-200 dark:border-gray-700/50 px-4 py-2 flex items-center justify-between bg-gray-50 dark:bg-gray-800/30">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Content Template
          </span>
          <ContextVariablePicker onInsert={handleInsertVariable} />
        </div>

        {/* Editor */}
        <div className="flex-1 p-4">
          <Textarea
            ref={textareaRef}
            value={contentTemplate}
            onChange={(e) => setContentTemplate(e.target.value)}
            placeholder={`# Skill Content\n\nWrite your skill content here using markdown.\n\nUse \${variable_name} for context variables.\n\n## Example\n\nCompany: \${company_name}\nIndustry: \${industry}\nProducts: \${products|join(', ')}`}
            className={cn(
              'w-full h-full min-h-[400px]',
              'bg-white dark:bg-gray-800/50',
              'border-gray-300 dark:border-gray-700/50',
              'text-gray-900 dark:text-gray-100',
              'font-mono text-sm leading-relaxed resize-none',
              'focus:outline-none focus:ring-2 focus:ring-blue-500',
              errors.contentTemplate && 'border-red-500'
            )}
          />
          {errors.contentTemplate && (
            <p className="text-xs text-red-500 mt-1">{errors.contentTemplate}</p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700/50 px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-gray-800/30">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Use <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">{'${variable}'}</code>{' '}
            syntax for context variables
          </p>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onCancel} disabled={isLoading}>
              <X className="w-4 h-4 mr-1.5" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isLoading}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Save className="w-4 h-4 mr-1.5" />
              {isLoading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Skill'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
