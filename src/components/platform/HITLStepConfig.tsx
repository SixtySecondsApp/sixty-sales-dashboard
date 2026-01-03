/**
 * HITLStepConfig Component
 *
 * Configuration panel for Human-in-the-Loop (HITL) settings on a sequence step.
 * Allows users to configure when to pause execution and request user input.
 */

import { useState } from 'react';
import {
  MessageSquare,
  HelpCircle,
  List,
  Keyboard,
  Hash,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Info,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import { Checkbox } from '@/components/ui/checkbox';
import type { HITLConfig } from '@/lib/hooks/useAgentSequences';

// =============================================================================
// Types
// =============================================================================

interface HITLStepConfigProps {
  config: HITLConfig;
  onChange: (config: HITLConfig) => void;
  position: 'before' | 'after'; // Whether this HITL runs before or after the step
  stepIndex: number;
  availableVariables?: string[]; // Variables available for prompt interpolation
  className?: string;
}

// =============================================================================
// Request Type Info
// =============================================================================

const REQUEST_TYPES = {
  confirmation: {
    label: 'Confirmation',
    description: 'Simple yes/no approval',
    icon: CheckCircle2,
    color: 'text-green-500',
  },
  question: {
    label: 'Question',
    description: 'Open-ended text response',
    icon: HelpCircle,
    color: 'text-blue-500',
  },
  choice: {
    label: 'Multiple Choice',
    description: 'Select from predefined options',
    icon: List,
    color: 'text-purple-500',
  },
  input: {
    label: 'Structured Input',
    description: 'Form-like data entry',
    icon: Keyboard,
    color: 'text-orange-500',
  },
} as const;

const TIMEOUT_ACTIONS = {
  fail: {
    label: 'Fail the sequence',
    description: 'Stop execution with an error',
    icon: AlertTriangle,
    color: 'text-red-500',
  },
  continue: {
    label: 'Continue without response',
    description: 'Proceed to next step with null response',
    icon: ChevronDown,
    color: 'text-yellow-500',
  },
  use_default: {
    label: 'Use default value',
    description: 'Use the configured default response',
    icon: CheckCircle2,
    color: 'text-blue-500',
  },
} as const;

// =============================================================================
// Choice Options Editor
// =============================================================================

interface ChoiceOption {
  value: string;
  label: string;
}

function ChoiceOptionsEditor({
  options,
  onChange,
}: {
  options: ChoiceOption[];
  onChange: (options: ChoiceOption[]) => void;
}) {
  const [newValue, setNewValue] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const handleAdd = () => {
    if (newValue && newLabel) {
      onChange([...options, { value: newValue, label: newLabel }]);
      setNewValue('');
      setNewLabel('');
    }
  };

  const handleRemove = (index: number) => {
    onChange(options.filter((_, i) => i !== index));
  };

  const handleUpdate = (index: number, field: 'value' | 'label', value: string) => {
    const updated = [...options];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {options.map((option, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            value={option.value}
            onChange={(e) => handleUpdate(index, 'value', e.target.value)}
            placeholder="Value"
            className="flex-1 font-mono text-sm h-8"
          />
          <Input
            value={option.label}
            onChange={(e) => handleUpdate(index, 'label', e.target.value)}
            placeholder="Display label"
            className="flex-1 text-sm h-8"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => handleRemove(index)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder="New option value"
          className="flex-1 font-mono text-sm h-8"
        />
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Display label"
          className="flex-1 text-sm h-8"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-8 shrink-0"
          onClick={handleAdd}
          disabled={!newValue || !newLabel}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function HITLStepConfig({
  config,
  onChange,
  position,
  stepIndex,
  availableVariables = [],
  className,
}: HITLStepConfigProps) {
  const [isExpanded, setIsExpanded] = useState(config.enabled);

  const handleToggle = (enabled: boolean) => {
    onChange({ ...config, enabled });
    if (enabled) {
      setIsExpanded(true);
    }
  };

  const handleChange = <K extends keyof HITLConfig>(key: K, value: HITLConfig[K]) => {
    onChange({ ...config, [key]: value });
  };

  const handleChannelToggle = (channel: 'slack' | 'in_app', checked: boolean) => {
    const newChannels = checked
      ? [...config.channels, channel]
      : config.channels.filter((c) => c !== channel);
    // Ensure at least one channel is selected
    if (newChannels.length === 0) {
      newChannels.push('in_app');
    }
    onChange({ ...config, channels: newChannels as Array<'slack' | 'in_app'> });
  };

  const RequestTypeIcon = REQUEST_TYPES[config.request_type].icon;

  return (
    <div
      className={cn(
        'rounded-lg border transition-all',
        config.enabled ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20' : 'bg-muted/30',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-3">
        <MessageSquare
          className={cn(
            'h-4 w-4',
            config.enabled ? 'text-amber-600' : 'text-muted-foreground'
          )}
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              Human Approval {position === 'before' ? 'Before' : 'After'} Step {stepIndex + 1}
            </span>
            {config.enabled && (
              <Badge variant="secondary" className="text-[10px]">
                <RequestTypeIcon className={cn('h-3 w-3 mr-1', REQUEST_TYPES[config.request_type].color)} />
                {REQUEST_TYPES[config.request_type].label}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {position === 'before'
              ? 'Pause for approval before running this step'
              : 'Pause for approval after this step completes'}
          </p>
        </div>
        <Switch checked={config.enabled} onCheckedChange={handleToggle} />
      </div>

      {/* Expanded Content */}
      {config.enabled && (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between px-3 py-1 h-auto">
              <span className="text-xs text-muted-foreground">Configure HITL settings</span>
              {isExpanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="p-4 pt-2 space-y-4 border-t">
              {/* Request Type */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Request Type</Label>
                <Select
                  value={config.request_type}
                  onValueChange={(v) => handleChange('request_type', v as HITLConfig['request_type'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(REQUEST_TYPES).map(([value, info]) => {
                      const Icon = info.icon;
                      return (
                        <SelectItem key={value} value={value}>
                          <div className="flex items-center gap-2">
                            <Icon className={cn('h-4 w-4', info.color)} />
                            <div>
                              <div className="font-medium">{info.label}</div>
                              <div className="text-xs text-muted-foreground">{info.description}</div>
                            </div>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Prompt */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">Prompt Message</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs">
                          The message shown to the user. Use{' '}
                          <code className="bg-muted px-1 rounded">${'{'}variable{'}'}</code> to
                          insert values from previous steps.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Textarea
                  value={config.prompt}
                  onChange={(e) => handleChange('prompt', e.target.value)}
                  placeholder={
                    config.request_type === 'confirmation'
                      ? 'Should we proceed with sending the email to ${contact.email}?'
                      : config.request_type === 'question'
                      ? 'What additional context should we include for ${contact.name}?'
                      : config.request_type === 'choice'
                      ? 'Which approach should we use for ${deal.name}?'
                      : 'Please provide the following information:'
                  }
                  rows={2}
                  className="text-sm"
                />
                {availableVariables.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-xs text-muted-foreground mr-1">Available:</span>
                    {availableVariables.map((v) => (
                      <Badge
                        key={v}
                        variant="secondary"
                        className="text-[10px] font-mono cursor-pointer hover:bg-primary/20"
                        onClick={() => {
                          const currentPrompt = config.prompt || '';
                          handleChange('prompt', currentPrompt + `\${${v}}`);
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

              {/* Choice Options (only for 'choice' type) */}
              {config.request_type === 'choice' && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Options</Label>
                  <ChoiceOptionsEditor
                    options={config.options || []}
                    onChange={(options) => handleChange('options', options)}
                  />
                </div>
              )}

              {/* Notification Channels */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Notification Channels</Label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={config.channels.includes('in_app')}
                      onCheckedChange={(checked) => handleChannelToggle('in_app', !!checked)}
                    />
                    <span className="text-sm">In-App</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={config.channels.includes('slack')}
                      onCheckedChange={(checked) => handleChannelToggle('slack', !!checked)}
                    />
                    <span className="text-sm">Slack</span>
                    <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                  </label>
                </div>
              </div>

              {/* Slack Channel (if Slack enabled) */}
              {config.channels.includes('slack') && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Slack Channel (optional)</Label>
                  <Input
                    value={config.slack_channel_id || ''}
                    onChange={(e) => handleChange('slack_channel_id', e.target.value || undefined)}
                    placeholder="Leave empty for default channel"
                    className="text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Specify a channel ID or leave empty to use the default notification channel.
                  </p>
                </div>
              )}

              {/* Timeout Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">Timeout</Label>
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={10080} // 1 week
                      value={config.timeout_minutes}
                      onChange={(e) => handleChange('timeout_minutes', parseInt(e.target.value) || 60)}
                      className="text-sm"
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">minutes</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">On Timeout</Label>
                  <Select
                    value={config.timeout_action}
                    onValueChange={(v) => handleChange('timeout_action', v as HITLConfig['timeout_action'])}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TIMEOUT_ACTIONS).map(([value, info]) => {
                        const Icon = info.icon;
                        return (
                          <SelectItem key={value} value={value}>
                            <div className="flex items-center gap-2">
                              <Icon className={cn('h-3.5 w-3.5', info.color)} />
                              <span>{info.label}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Default Value (if timeout_action is 'use_default') */}
              {config.timeout_action === 'use_default' && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Default Value</Label>
                  <Input
                    value={config.default_value || ''}
                    onChange={(e) => handleChange('default_value', e.target.value || undefined)}
                    placeholder={
                      config.request_type === 'confirmation' ? 'yes' : 'Enter default response...'
                    }
                    className="text-sm"
                  />
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

export default HITLStepConfig;
