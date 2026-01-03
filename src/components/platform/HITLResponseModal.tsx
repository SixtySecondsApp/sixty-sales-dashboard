/**
 * HITLResponseModal Component
 *
 * Modal for users to respond to Human-in-the-Loop (HITL) requests.
 * Supports different request types: confirmation, question, choice, and input.
 */

import { useState, useEffect } from 'react';
import {
  MessageSquare,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Send,
  HelpCircle,
  List,
  Keyboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { useRespondToHITL, useCancelHITL } from '@/lib/hooks/useHITLRequests';
import type { HITLRequestWithDetails } from '@/lib/hooks/useHITLRequests';

// =============================================================================
// Types
// =============================================================================

interface HITLResponseModalProps {
  request: HITLRequestWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// =============================================================================
// Request Type Info
// =============================================================================

const REQUEST_TYPE_CONFIG = {
  confirmation: {
    label: 'Confirmation Required',
    description: 'Please approve or reject this action',
    icon: CheckCircle2,
    color: 'text-green-500',
  },
  question: {
    label: 'Response Required',
    description: 'Please provide your answer',
    icon: HelpCircle,
    color: 'text-blue-500',
  },
  choice: {
    label: 'Selection Required',
    description: 'Please select an option',
    icon: List,
    color: 'text-purple-500',
  },
  input: {
    label: 'Input Required',
    description: 'Please provide the requested information',
    icon: Keyboard,
    color: 'text-orange-500',
  },
} as const;

// =============================================================================
// Helper Components
// =============================================================================

function TimeRemaining({ expiresAt }: { expiresAt: string | null }) {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    if (!expiresAt) {
      setTimeLeft('No timeout');
      return;
    }

    const updateTimeLeft = () => {
      const now = new Date();
      const expires = new Date(expiresAt);
      const diff = expires.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft('Expired');
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours % 24}h remaining`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes % 60}m remaining`);
      } else {
        setTimeLeft(`${minutes}m remaining`);
      }
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [expiresAt]);

  const isExpired = timeLeft === 'Expired';
  const isLow = timeLeft.includes('m remaining') && !timeLeft.includes('h');

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-xs',
        isExpired ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-muted-foreground'
      )}
    >
      <Clock className="h-3.5 w-3.5" />
      <span>{timeLeft}</span>
    </div>
  );
}

// =============================================================================
// Confirmation Response
// =============================================================================

function ConfirmationResponse({
  onRespond,
  isLoading,
}: {
  onRespond: (value: string) => void;
  isLoading: boolean;
}) {
  return (
    <div className="flex gap-3">
      <Button
        variant="outline"
        className="flex-1 border-red-200 hover:bg-red-50 hover:border-red-300 text-red-700"
        onClick={() => onRespond('no')}
        disabled={isLoading}
      >
        <XCircle className="h-4 w-4 mr-2" />
        Reject
      </Button>
      <Button
        className="flex-1 bg-green-600 hover:bg-green-700"
        onClick={() => onRespond('yes')}
        disabled={isLoading}
      >
        <CheckCircle2 className="h-4 w-4 mr-2" />
        Approve
      </Button>
    </div>
  );
}

// =============================================================================
// Question Response
// =============================================================================

function QuestionResponse({
  onRespond,
  isLoading,
}: {
  onRespond: (value: string) => void;
  isLoading: boolean;
}) {
  const [answer, setAnswer] = useState('');

  const handleSubmit = () => {
    if (answer.trim()) {
      onRespond(answer.trim());
    }
  };

  return (
    <div className="space-y-3">
      <Textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Type your response here..."
        rows={4}
        className="resize-none"
      />
      <Button
        onClick={handleSubmit}
        disabled={!answer.trim() || isLoading}
        className="w-full"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Send className="h-4 w-4 mr-2" />
        )}
        Submit Response
      </Button>
    </div>
  );
}

// =============================================================================
// Choice Response
// =============================================================================

function ChoiceResponse({
  options,
  onRespond,
  isLoading,
}: {
  options: Array<{ value: string; label: string }>;
  onRespond: (value: string) => void;
  isLoading: boolean;
}) {
  const [selected, setSelected] = useState<string>('');

  const handleSubmit = () => {
    if (selected) {
      onRespond(selected);
    }
  };

  if (!options || options.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        No options configured for this request.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <RadioGroup value={selected} onValueChange={setSelected}>
        {options.map((option) => (
          <div
            key={option.value}
            className={cn(
              'flex items-center space-x-3 p-3 rounded-lg border transition-all cursor-pointer',
              selected === option.value
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50 hover:bg-muted/50'
            )}
            onClick={() => setSelected(option.value)}
          >
            <RadioGroupItem value={option.value} id={option.value} />
            <Label htmlFor={option.value} className="cursor-pointer flex-1">
              {option.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
      <Button
        onClick={handleSubmit}
        disabled={!selected || isLoading}
        className="w-full"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Send className="h-4 w-4 mr-2" />
        )}
        Submit Selection
      </Button>
    </div>
  );
}

// =============================================================================
// Input Response (Structured Form)
// =============================================================================

function InputResponse({
  onRespond,
  isLoading,
}: {
  onRespond: (value: string, context?: Record<string, unknown>) => void;
  isLoading: boolean;
}) {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [fieldName, setFieldName] = useState('');
  const [fieldValue, setFieldValue] = useState('');

  const handleAddField = () => {
    if (fieldName.trim() && fieldValue.trim()) {
      setInputs((prev) => ({ ...prev, [fieldName.trim()]: fieldValue.trim() }));
      setFieldName('');
      setFieldValue('');
    }
  };

  const handleRemoveField = (key: string) => {
    setInputs((prev) => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  };

  const handleSubmit = () => {
    if (Object.keys(inputs).length > 0) {
      // Send as JSON string with context
      onRespond(JSON.stringify(inputs), { structured_input: inputs });
    }
  };

  return (
    <div className="space-y-4">
      {/* Existing inputs */}
      {Object.entries(inputs).length > 0 && (
        <div className="space-y-2">
          {Object.entries(inputs).map(([key, value]) => (
            <div
              key={key}
              className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg"
            >
              <span className="font-mono text-sm font-medium">{key}:</span>
              <span className="flex-1 text-sm truncate">{value}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveField(key)}
                className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <XCircle className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add new field */}
      <div className="flex gap-2">
        <Input
          value={fieldName}
          onChange={(e) => setFieldName(e.target.value)}
          placeholder="Field name"
          className="flex-1"
        />
        <Input
          value={fieldValue}
          onChange={(e) => setFieldValue(e.target.value)}
          placeholder="Value"
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddField();
            }
          }}
        />
        <Button
          variant="outline"
          onClick={handleAddField}
          disabled={!fieldName.trim() || !fieldValue.trim()}
        >
          Add
        </Button>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={Object.keys(inputs).length === 0 || isLoading}
        className="w-full"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Send className="h-4 w-4 mr-2" />
        )}
        Submit Data
      </Button>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function HITLResponseModal({
  request,
  open,
  onOpenChange,
  onSuccess,
}: HITLResponseModalProps) {
  const respondMutation = useRespondToHITL();
  const cancelMutation = useCancelHITL();

  if (!request) return null;

  const typeConfig = REQUEST_TYPE_CONFIG[request.request_type];
  const TypeIcon = typeConfig.icon;

  const handleRespond = async (
    value: string,
    context?: Record<string, unknown>
  ) => {
    try {
      await respondMutation.mutateAsync({
        requestId: request.id,
        responseValue: value,
        responseContext: context,
      });
      toast.success('Response submitted successfully');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to submit response'
      );
    }
  };

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync(request.id);
      toast.success('Request cancelled');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to cancel request'
      );
    }
  };

  const isLoading = respondMutation.isPending || cancelMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <MessageSquare className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <DialogTitle className="flex items-center gap-2">
                {typeConfig.label}
                <Badge variant="secondary" className="text-[10px]">
                  <TypeIcon className={cn('h-3 w-3 mr-1', typeConfig.color)} />
                  {request.request_type}
                </Badge>
              </DialogTitle>
              <DialogDescription className="flex items-center justify-between mt-1">
                <span>Step {request.step_index + 1} • {request.sequence_key}</span>
                <TimeRemaining expiresAt={request.expires_at} />
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Prompt */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm whitespace-pre-wrap">{request.prompt}</p>
          </div>

          {/* Requester info */}
          {request.requester_name && (
            <div className="text-xs text-muted-foreground">
              Requested by: <span className="font-medium">{request.requester_name}</span>
              {request.requester_email && (
                <span className="text-muted-foreground"> ({request.requester_email})</span>
              )}
            </div>
          )}

          {/* Response input based on type */}
          {request.request_type === 'confirmation' && (
            <ConfirmationResponse onRespond={handleRespond} isLoading={isLoading} />
          )}
          {request.request_type === 'question' && (
            <QuestionResponse onRespond={handleRespond} isLoading={isLoading} />
          )}
          {request.request_type === 'choice' && (
            <ChoiceResponse
              options={request.options || []}
              onRespond={handleRespond}
              isLoading={isLoading}
            />
          )}
          {request.request_type === 'input' && (
            <InputResponse onRespond={handleRespond} isLoading={isLoading} />
          )}

          {/* Timeout action info */}
          {request.timeout_action !== 'fail' && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
              <AlertTriangle className="h-3.5 w-3.5 text-blue-600 mt-0.5 shrink-0" />
              <span>
                {request.timeout_action === 'continue'
                  ? 'If not responded in time, the workflow will continue without a response.'
                  : `If not responded in time, the default value "${request.default_value}" will be used.`}
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={handleCancel}
            disabled={isLoading}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            {cancelMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4 mr-2" />
            )}
            Cancel Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default HITLResponseModal;
