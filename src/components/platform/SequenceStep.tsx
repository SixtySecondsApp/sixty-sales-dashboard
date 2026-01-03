/**
 * SequenceStep Component
 *
 * Individual step in the sequence builder with skill selection,
 * input mapping, and failure handling configuration.
 */

import { useState } from 'react';
import { GripVertical, Trash2, ChevronDown, ChevronUp, AlertCircle, Info, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { SkillSelector, SkillInfo } from './SkillSelector';
import { HITLStepConfig } from './HITLStepConfig';
import { createDefaultHITLConfig, type SequenceStep as SequenceStepType, type HITLConfig } from '@/lib/hooks/useAgentSequences';

// =============================================================================
// Types
// =============================================================================

interface SequenceStepProps {
  step: SequenceStepType;
  index: number;
  availableOutputs: string[]; // Output keys from previous steps
  onChange: (step: SequenceStepType) => void;
  onDelete: () => void;
  isDragging?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

// =============================================================================
// Input Mapping Editor
// =============================================================================

interface InputMappingEditorProps {
  mapping: Record<string, string>;
  availableVariables: string[];
  onChange: (mapping: Record<string, string>) => void;
}

function InputMappingEditor({ mapping, availableVariables, onChange }: InputMappingEditorProps) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const handleAdd = () => {
    if (newKey && newValue) {
      onChange({ ...mapping, [newKey]: newValue });
      setNewKey('');
      setNewValue('');
    }
  };

  const handleRemove = (key: string) => {
    const updated = { ...mapping };
    delete updated[key];
    onChange(updated);
  };

  const handleChange = (oldKey: string, newKey: string, value: string) => {
    const updated = { ...mapping };
    if (oldKey !== newKey) {
      delete updated[oldKey];
    }
    updated[newKey] = value;
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {/* Existing mappings */}
      {Object.entries(mapping).map(([key, value]) => (
        <div key={key} className="flex items-center gap-2">
          <Input
            value={key}
            onChange={(e) => handleChange(key, e.target.value, value)}
            placeholder="Parameter name"
            className="flex-1 font-mono text-sm h-8"
          />
          <span className="text-muted-foreground">=</span>
          <div className="flex-1 relative">
            <Input
              value={value}
              onChange={(e) => handleChange(key, key, e.target.value)}
              placeholder="${variable}"
              className="font-mono text-sm h-8 pr-20"
            />
            {availableVariables.length > 0 && (
              <Select
                value=""
                onValueChange={(v) => handleChange(key, key, `\${${v}}`)}
              >
                <SelectTrigger className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-16 text-xs">
                  <span className="text-muted-foreground">Insert</span>
                </SelectTrigger>
                <SelectContent>
                  {availableVariables.map((v) => (
                    <SelectItem key={v} value={v} className="font-mono text-xs">
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => handleRemove(key)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}

      {/* Add new mapping */}
      <div className="flex items-center gap-2">
        <Input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="New parameter"
          className="flex-1 font-mono text-sm h-8"
        />
        <span className="text-muted-foreground">=</span>
        <Input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder="${variable}"
          className="flex-1 font-mono text-sm h-8"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-8 shrink-0"
          onClick={handleAdd}
          disabled={!newKey || !newValue}
        >
          Add
        </Button>
      </div>

      {availableVariables.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-2">
          <span className="text-xs text-muted-foreground mr-1">Available:</span>
          {availableVariables.map((v) => (
            <Badge key={v} variant="secondary" className="text-[10px] font-mono cursor-pointer"
              onClick={() => {
                setNewValue(`\${${v}}`);
              }}
            >
              ${'{'}
              {v}
              {'}'}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function SequenceStep({
  step,
  index,
  availableOutputs,
  onChange,
  onDelete,
  isDragging = false,
  dragHandleProps,
}: SequenceStepProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleSkillChange = (skillKey: string) => {
    onChange({ ...step, skill_key: skillKey });
  };

  const handleOutputKeyChange = (outputKey: string) => {
    onChange({ ...step, output_key: outputKey });
  };

  const handleOnFailureChange = (onFailure: 'stop' | 'continue' | 'fallback') => {
    onChange({ ...step, on_failure: onFailure });
  };

  const handleInputMappingChange = (mapping: Record<string, string>) => {
    onChange({ ...step, input_mapping: mapping });
  };

  // Build available variables from previous steps' outputs
  const availableVariables = availableOutputs.flatMap((outputKey) => [
    outputKey,
    `${outputKey}.id`,
    `${outputKey}.name`,
    `${outputKey}.email`,
  ]);

  return (
    <div
      className={cn(
        'rounded-lg border bg-card transition-all',
        isDragging && 'opacity-50 shadow-lg',
        'hover:border-primary/50'
      )}
    >
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        {/* Header */}
        <div className="flex items-center gap-2 p-3 border-b">
          {/* Drag Handle */}
          <div
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* Step Number */}
          <Badge variant="outline" className="shrink-0">
            Step {index + 1}
          </Badge>

          {/* HITL Indicator */}
          {(step.hitl_before?.enabled || step.hitl_after?.enabled) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="shrink-0 bg-amber-100 text-amber-700 border-amber-300">
                    <MessageSquare className="h-3 w-3 mr-1" />
                    HITL
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">
                    {step.hitl_before?.enabled && step.hitl_after?.enabled
                      ? 'Human approval required before and after'
                      : step.hitl_before?.enabled
                      ? 'Human approval required before step'
                      : 'Human approval required after step'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Skill Selector */}
          <div className="flex-1 min-w-0">
            <SkillSelector
              value={step.skill_key}
              onChange={handleSkillChange}
              placeholder="Select a skill..."
              className="h-9"
            />
          </div>

          {/* Expand/Collapse */}
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>

          {/* Delete */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Expanded Content */}
        <CollapsibleContent>
          <div className="p-4 space-y-4">
            {/* Skill Info */}
            {step.skill_key && (
              <SkillInfo skillKey={step.skill_key} className="bg-muted/50" />
            )}

            {/* Input Mapping */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Input Mapping</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">
                        Map input parameters to variables from previous steps. Use{' '}
                        <code className="bg-muted px-1 rounded">${'{'}variable{'}'}</code> syntax.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <InputMappingEditor
                mapping={step.input_mapping}
                availableVariables={availableVariables}
                onChange={handleInputMappingChange}
              />
            </div>

            {/* Output Key */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor={`output-key-${index}`} className="text-sm font-medium">
                  Output Key
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">
                        The key under which this step's output will be stored.
                        Later steps can reference it as <code className="bg-muted px-1 rounded">${'{'}key{'}'}</code>.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id={`output-key-${index}`}
                value={step.output_key}
                onChange={(e) => handleOutputKeyChange(e.target.value)}
                placeholder="e.g., contact, deal, result"
                className="font-mono"
              />
            </div>

            {/* On Failure */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">On Failure</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">
                        What to do if this step fails: stop the sequence, continue to
                        the next step, or run a fallback skill.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Select value={step.on_failure} onValueChange={handleOnFailureChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stop">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                      Stop sequence
                    </div>
                  </SelectItem>
                  <SelectItem value="continue">
                    <div className="flex items-center gap-2">
                      <ChevronDown className="h-3.5 w-3.5 text-yellow-500" />
                      Continue to next step
                    </div>
                  </SelectItem>
                  <SelectItem value="fallback">
                    <div className="flex items-center gap-2">
                      <ChevronDown className="h-3.5 w-3.5 text-blue-500" />
                      Run fallback skill
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Fallback Skill (if fallback selected) */}
            {step.on_failure === 'fallback' && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Fallback Skill</Label>
                <SkillSelector
                  value={step.fallback_skill_key || ''}
                  onChange={(v) => onChange({ ...step, fallback_skill_key: v })}
                  placeholder="Select fallback skill..."
                  excludeSkillKeys={[step.skill_key]}
                />
              </div>
            )}

            {/* HITL Configuration */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium">Human-in-the-Loop</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">
                        Add approval checkpoints before or after this step. Users will be
                        notified via Slack or in-app and can provide input or confirmation.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* HITL Before Step */}
              <HITLStepConfig
                config={step.hitl_before || createDefaultHITLConfig()}
                onChange={(config) => onChange({ ...step, hitl_before: config })}
                position="before"
                stepIndex={index}
                availableVariables={availableVariables}
              />

              {/* HITL After Step */}
              <HITLStepConfig
                config={step.hitl_after || createDefaultHITLConfig()}
                onChange={(config) => onChange({ ...step, hitl_after: config })}
                position="after"
                stepIndex={index}
                availableVariables={[...availableVariables, step.output_key]}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export default SequenceStep;
