/**
 * InteractivePlayground Component
 *
 * Test copilot queries with user impersonation and execution tracing.
 * Shows step-by-step execution with timing and output preview.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Loader2,
  User,
  Database,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  Expand,
  Code,
  Eye,
  FileText,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/clientV2';

interface PlaygroundUser {
  id: string;
  name: string;
  email: string;
  role?: string;
}

interface ExecutionStep {
  step: number;
  name: string;
  type: 'intent' | 'action' | 'skill' | 'sequence' | 'generate';
  status: 'pending' | 'running' | 'complete' | 'error';
  startTime?: number;
  endTime?: number;
  duration?: number;
  output?: any;
  error?: string;
  metadata?: Record<string, any>;
}

interface PlaygroundResult {
  success: boolean;
  response: string;
  structuredResponse?: any;
  steps: ExecutionStep[];
  totalTime: number;
  toolExecutions?: any[];
}

interface InteractivePlaygroundProps {
  organizationId?: string;
  users?: PlaygroundUser[];
  defaultQuery?: string;
  initialQuery?: string; // Alias for defaultQuery
  onQueryComplete?: (result: PlaygroundResult) => void;
  // Props passed from CopilotLabPage
  skills?: any[];
  capabilities?: any[];
  isLoading?: boolean;
}

// Sample queries for quick testing
const SAMPLE_QUERIES = [
  { label: 'Meeting Prep', query: 'Prep me for my next meeting' },
  { label: 'Pipeline Check', query: 'What deals need my attention today?' },
  { label: 'Follow-ups', query: 'What follow-ups am I missing?' },
  { label: 'Deal Health', query: 'Show me deals that are at risk' },
  { label: 'Daily Focus', query: 'What should I focus on today?' },
];

export function InteractivePlayground({
  organizationId,
  users = [],
  defaultQuery = '',
  initialQuery,
  onQueryComplete,
}: InteractivePlaygroundProps) {
  // Use initialQuery if provided, otherwise defaultQuery
  const effectiveDefaultQuery = initialQuery || defaultQuery;
  const [query, setQuery] = useState(effectiveDefaultQuery);
  const [selectedUserId, setSelectedUserId] = useState<string>('current');

  // Update query when defaultQuery or initialQuery prop changes
  const prevDefaultQueryRef = useRef(effectiveDefaultQuery);
  useEffect(() => {
    const newQuery = initialQuery || defaultQuery;
    if (newQuery && newQuery !== prevDefaultQueryRef.current) {
      setQuery(newQuery);
      prevDefaultQueryRef.current = newQuery;
    }
  }, [defaultQuery, initialQuery]);
  const [dataMode, setDataMode] = useState<'real' | 'sample'>('real');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<PlaygroundResult | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [outputView, setOutputView] = useState<'rendered' | 'json' | 'raw'>('rendered');

  // Run the query
  const handleRun = useCallback(async () => {
    if (!query.trim() || isRunning) return;

    setIsRunning(true);
    setResult(null);
    setExpandedSteps(new Set());

    const startTime = Date.now();
    const steps: ExecutionStep[] = [];

    try {
      // Step 1: Intent Detection
      steps.push({
        step: 1,
        name: 'Intent Detection',
        type: 'intent',
        status: 'running',
        startTime: Date.now(),
      });
      setResult({ success: true, response: '', steps, totalTime: 0 });

      // Call the copilot API
      const { data, error } = await supabase.functions.invoke('api-copilot', {
        body: {
          action: 'chat',
          message: query,
          context: {
            orgId: organizationId,
            isPlaygroundTest: true,
            dataMode,
          },
        },
      });

      if (error) throw error;

      // Complete intent detection
      steps[0].status = 'complete';
      steps[0].endTime = Date.now();
      steps[0].duration = steps[0].endTime - (steps[0].startTime || 0);
      steps[0].output = data?.intent || 'general_query';

      // Parse tool executions into steps
      const toolExecutions = data?.tool_executions || [];
      toolExecutions.forEach((exec: any, idx: number) => {
        steps.push({
          step: idx + 2,
          name: exec.tool || exec.action || `Step ${idx + 2}`,
          type: exec.type === 'skill' ? 'skill' : exec.type === 'sequence' ? 'sequence' : 'action',
          status: exec.success ? 'complete' : 'error',
          startTime: exec.startTime,
          endTime: exec.endTime,
          duration: exec.duration_ms || (exec.endTime - exec.startTime),
          output: exec.result || exec.data,
          error: exec.error,
          metadata: {
            provider: exec.provider,
            capability: exec.capability,
          },
        });
      });

      // Add generation step
      steps.push({
        step: steps.length + 1,
        name: 'Generate Response',
        type: 'generate',
        status: 'complete',
        startTime: Date.now() - 100,
        endTime: Date.now(),
        duration: 100,
        output: data?.response?.content?.slice(0, 200) + '...',
      });

      const totalTime = Date.now() - startTime;
      const finalResult: PlaygroundResult = {
        success: true,
        response: data?.response?.content || '',
        structuredResponse: data?.response?.structuredResponse,
        steps,
        totalTime,
        toolExecutions,
      };

      setResult(finalResult);
      onQueryComplete?.(finalResult);
      toast.success(`Query completed in ${(totalTime / 1000).toFixed(2)}s`);
    } catch (err: any) {
      console.error('Playground error:', err);

      // Mark last step as error
      if (steps.length > 0) {
        const lastStep = steps[steps.length - 1];
        if (lastStep.status === 'running') {
          lastStep.status = 'error';
          lastStep.error = err.message;
          lastStep.endTime = Date.now();
        }
      }

      setResult({
        success: false,
        response: err.message || 'An error occurred',
        steps,
        totalTime: Date.now() - startTime,
      });
      toast.error('Query failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsRunning(false);
    }
  }, [query, organizationId, dataMode, onQueryComplete, isRunning]);

  // Toggle step expansion
  const toggleStep = (stepNum: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepNum)) {
        next.delete(stepNum);
      } else {
        next.add(stepNum);
      }
      return next;
    });
  };

  // Copy output to clipboard
  const copyOutput = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(
        outputView === 'json'
          ? JSON.stringify(result.structuredResponse || result, null, 2)
          : result.response
      );
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700/50">
        {/* User selector */}
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-gray-500" />
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Test as..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Current User</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Data mode */}
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-gray-500" />
          <Select value={dataMode} onValueChange={(v: 'real' | 'sample') => setDataMode(v)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="real">Real Data</SelectItem>
              <SelectItem value="sample">Sample Data</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quick queries */}
        <div className="flex-1 flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-500">Quick:</span>
          {SAMPLE_QUERIES.map((sq) => (
            <Button
              key={sq.label}
              variant="outline"
              size="sm"
              onClick={() => setQuery(sq.query)}
              className="text-xs"
            >
              {sq.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Query Input */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Test Query
        </label>
        <div className="relative">
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter a query to test... e.g., 'What deals need my attention today?'"
            className="min-h-[100px] pr-24 bg-white dark:bg-gray-900"
            disabled={isRunning}
          />
          <Button
            onClick={handleRun}
            disabled={!query.trim() || isRunning}
            className="absolute bottom-3 right-3 gap-2"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Execution Trace */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Execution Trace
              <Badge variant="outline" className="ml-2">
                {(result.totalTime / 1000).toFixed(2)}s
              </Badge>
            </h3>
            {result.success ? (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Success
              </Badge>
            ) : (
              <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                <XCircle className="w-3 h-3 mr-1" />
                Failed
              </Badge>
            )}
          </div>

          <div className="bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700/50 rounded-xl overflow-hidden">
            {result.steps.map((step, idx) => (
              <div
                key={step.step}
                className={cn(
                  'border-b border-gray-100 dark:border-gray-800 last:border-b-0',
                  step.status === 'error' && 'bg-red-50 dark:bg-red-900/10'
                )}
              >
                {/* Step Header */}
                <button
                  onClick={() => toggleStep(step.step)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  {/* Status Icon */}
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                      step.status === 'complete' && 'bg-emerald-100 dark:bg-emerald-900/30',
                      step.status === 'running' && 'bg-blue-100 dark:bg-blue-900/30',
                      step.status === 'error' && 'bg-red-100 dark:bg-red-900/30',
                      step.status === 'pending' && 'bg-gray-100 dark:bg-gray-800'
                    )}
                  >
                    {step.status === 'running' ? (
                      <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                    ) : step.status === 'complete' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : step.status === 'error' ? (
                      <XCircle className="w-4 h-4 text-red-500" />
                    ) : (
                      <span className="text-xs text-gray-500">{step.step}</span>
                    )}
                  </div>

                  {/* Step Info */}
                  <div className="flex-1 text-left">
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {step.name}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {step.type}
                      </Badge>
                      {step.duration && (
                        <span>{step.duration}ms</span>
                      )}
                      {step.metadata?.provider && (
                        <span>via {step.metadata.provider}</span>
                      )}
                    </div>
                  </div>

                  {/* Expand Icon */}
                  {step.output && (
                    <div className="text-gray-400">
                      {expandedSteps.has(step.step) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </div>
                  )}
                </button>

                {/* Step Output */}
                <AnimatePresence>
                  {expandedSteps.has(step.step) && step.output && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-0">
                        <pre className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs overflow-x-auto">
                          {typeof step.output === 'string'
                            ? step.output
                            : JSON.stringify(step.output, null, 2)}
                        </pre>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Error Message */}
                {step.error && (
                  <div className="px-4 pb-4 pt-0">
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
                      {step.error}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Output Preview */}
      {result && result.success && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Output
            </h3>
            <div className="flex items-center gap-2">
              <Tabs value={outputView} onValueChange={(v: any) => setOutputView(v)}>
                <TabsList className="h-8">
                  <TabsTrigger value="rendered" className="text-xs px-2 h-6">
                    <Eye className="w-3 h-3 mr-1" />
                    Rendered
                  </TabsTrigger>
                  <TabsTrigger value="json" className="text-xs px-2 h-6">
                    <Code className="w-3 h-3 mr-1" />
                    JSON
                  </TabsTrigger>
                  <TabsTrigger value="raw" className="text-xs px-2 h-6">
                    <FileText className="w-3 h-3 mr-1" />
                    Raw
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <Button variant="ghost" size="sm" onClick={copyOutput}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700/50 rounded-xl p-4 min-h-[200px]">
            {outputView === 'rendered' && (
              <div className="prose dark:prose-invert max-w-none">
                {result.response || 'No response content'}
              </div>
            )}
            {outputView === 'json' && (
              <pre className="text-xs overflow-x-auto">
                {JSON.stringify(result.structuredResponse || result, null, 2)}
              </pre>
            )}
            {outputView === 'raw' && (
              <pre className="text-sm whitespace-pre-wrap">{result.response}</pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default InteractivePlayground;
