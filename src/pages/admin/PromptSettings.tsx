/**
 * Admin Prompt Settings Page
 *
 * Admin-only page for viewing and customizing AI prompts used throughout the application.
 * Changes are stored in the database and applied dynamically to all users.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Sparkles,
  FileText,
  Mail,
  MessageSquare,
  ClipboardList,
  PenTool,
  Zap,
  Database,
  Code,
  AlertCircle,
  CheckCircle,
  Info,
  Shield,
} from 'lucide-react';
import { usePromptTemplates, type PromptTemplateInfo } from '@/lib/hooks/usePromptTemplates';
import { getDefaultTemplate } from '@/lib/services/promptService';
import { useUser } from '@/lib/hooks/useUser';
import { isUserAdmin } from '@/lib/utils/adminUtils';
import type { PromptTemplate } from '@/lib/prompts';

// ============================================================================
// Category Configuration
// ============================================================================

const PROMPT_CATEGORIES = {
  email: {
    label: 'Email Analysis',
    icon: Mail,
    description: 'Prompts for analyzing and processing emails',
    features: ['email_analysis', 'writing_style'],
  },
  meetings: {
    label: 'Meeting Intelligence',
    icon: MessageSquare,
    description: 'Prompts for transcript analysis and meeting insights',
    features: ['transcript_analysis', 'condense_summary', 'meeting_qa', 'content_topics'],
  },
  actions: {
    label: 'Task & Action Generation',
    icon: ClipboardList,
    description: 'Prompts for generating tasks and action items',
    features: ['suggest_next_actions', 'generate_actions', 'action_item_analysis'],
  },
  proposals: {
    label: 'Proposal Generation',
    icon: FileText,
    description: 'Prompts for creating proposals and SOWs',
    features: ['proposal_focus_areas', 'proposal_goals', 'proposal_sow', 'proposal_html', 'proposal_email', 'proposal_markdown'],
  },
  workflow: {
    label: 'Workflow Engine',
    icon: Zap,
    description: 'Dynamic prompts for workflow automation',
    features: ['workflow_tools', 'workflow_mcp', 'workflow_json', 'workflow_few_shot'],
  },
  search: {
    label: 'Search & Intelligence',
    icon: Database,
    description: 'Prompts for search query parsing',
    features: ['search_query_parse'],
  },
};

const FEATURE_LABELS: Record<string, string> = {
  email_analysis: 'Email Analysis',
  writing_style: 'Writing Style Extraction',
  transcript_analysis: 'Transcript Analysis',
  condense_summary: 'Summary Condensing',
  meeting_qa: 'Meeting Q&A',
  content_topics: 'Content Topic Extraction',
  suggest_next_actions: 'Suggest Next Actions',
  generate_actions: 'Generate Action Items',
  action_item_analysis: 'Action Item Analysis',
  proposal_focus_areas: 'Focus Areas Extraction',
  proposal_goals: 'Goals Generation',
  proposal_sow: 'SOW Generation',
  proposal_html: 'HTML Proposal',
  proposal_email: 'Email Proposal',
  proposal_markdown: 'Markdown Proposal',
  workflow_tools: 'Tool Instructions',
  workflow_mcp: 'MCP Instructions',
  workflow_json: 'JSON Output',
  workflow_few_shot: 'Few-Shot Learning',
  search_query_parse: 'Search Query Parser',
};

const MODEL_OPTIONS = [
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (Fast)' },
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude Sonnet 3.5 (Balanced)' },
  { value: 'claude-3-opus-20240229', label: 'Claude Opus 3 (Powerful)' },
  { value: 'anthropic/claude-haiku-4.5', label: 'Claude Haiku 4.5 (OpenRouter)' },
  { value: 'anthropic/claude-3-5-sonnet-20241022', label: 'Claude Sonnet 3.5 (OpenRouter)' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-4o', label: 'GPT-4o' },
];

// ============================================================================
// Component
// ============================================================================

export default function PromptSettings() {
  const navigate = useNavigate();
  const { userData } = useUser();
  const {
    templates,
    userCustomizations,
    selectedPrompt,
    isLoading,
    error,
    loadTemplate,
    saveCustomization,
    resetToDefault,
    refreshTemplates,
  } = usePromptTemplates();

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    email: true,
    meetings: false,
    actions: false,
    proposals: false,
    workflow: false,
    search: false,
  });

  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [editedPrompt, setEditedPrompt] = useState<{
    name: string;
    description: string;
    systemPrompt: string;
    userPrompt: string;
    model: string;
    temperature: number;
    maxTokens: number;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showVariablesInfo, setShowVariablesInfo] = useState(false);

  // Admin access check
  useEffect(() => {
    if (userData && !isUserAdmin(userData)) {
      toast.error('Admin access required');
      navigate('/');
    }
  }, [userData, navigate]);

  // Load template when feature is selected
  useEffect(() => {
    if (selectedFeature) {
      loadTemplate(selectedFeature);
    }
  }, [selectedFeature, loadTemplate]);

  // Initialize edit form when prompt loads
  useEffect(() => {
    if (selectedPrompt) {
      setEditedPrompt({
        name: selectedPrompt.template.name,
        description: selectedPrompt.template.description,
        systemPrompt: selectedPrompt.template.systemPrompt,
        userPrompt: selectedPrompt.template.userPrompt,
        model: selectedPrompt.modelConfig.model,
        temperature: selectedPrompt.modelConfig.temperature,
        maxTokens: selectedPrompt.modelConfig.maxTokens,
      });
    }
  }, [selectedPrompt]);

  const handleSave = async () => {
    if (!selectedFeature || !editedPrompt) return;

    setIsSaving(true);
    try {
      await saveCustomization(selectedFeature, editedPrompt);
      toast.success('Prompt saved successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save prompt');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!selectedFeature) return;

    setIsSaving(true);
    try {
      await resetToDefault(selectedFeature);
      toast.success('Prompt reset to default');
      setShowResetDialog(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reset prompt');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const getTemplateInfo = (featureKey: string): PromptTemplateInfo | undefined => {
    return templates.find((t) => t.featureKey === featureKey);
  };

  const getDefaultTemplateVariables = (featureKey: string): string[] => {
    const template = getDefaultTemplate(featureKey);
    if (!template) return [];

    // Extract variable names from the template
    const matches = template.userPrompt.match(/\$\{(\w+)\}/g) || [];
    return matches.map((m) => m.replace(/\$\{|\}/g, ''));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/admin')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Shield className="h-6 w-6 text-primary" />
                  AI Prompt Settings
                  <Badge variant="secondary" className="ml-2">Admin</Badge>
                </h1>
                <p className="text-sm text-muted-foreground">
                  Customize AI prompts system-wide for all users
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Prompt List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Prompts</CardTitle>
                <CardDescription>
                  Select a prompt to view or customize
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-300px)]">
                  {Object.entries(PROMPT_CATEGORIES).map(([categoryKey, category]) => (
                    <Collapsible
                      key={categoryKey}
                      open={expandedCategories[categoryKey]}
                      onOpenChange={() => toggleCategory(categoryKey)}
                    >
                      <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/50 transition-colors border-b">
                        <div className="flex items-center gap-3">
                          <category.icon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{category.label}</span>
                        </div>
                        {expandedCategories[categoryKey] ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="py-1">
                          {category.features.map((featureKey) => {
                            const info = getTemplateInfo(featureKey);
                            const isSelected = selectedFeature === featureKey;

                            return (
                              <button
                                key={featureKey}
                                onClick={() => setSelectedFeature(featureKey)}
                                className={`w-full px-4 py-2 pl-10 text-left text-sm transition-colors flex items-center justify-between ${
                                  isSelected
                                    ? 'bg-primary/10 text-primary'
                                    : 'hover:bg-muted/50'
                                }`}
                              >
                                <span>{FEATURE_LABELS[featureKey] || featureKey}</span>
                                {info?.hasCustomization && (
                                  <Badge variant="secondary" className="text-xs">
                                    Custom
                                  </Badge>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Prompt Editor */}
          <div className="lg:col-span-2">
            {!selectedFeature ? (
              <Card className="h-[calc(100vh-300px)] flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Code className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Select a prompt to edit</p>
                  <p className="text-sm">
                    Choose from the list on the left to view or customize
                  </p>
                </div>
              </Card>
            ) : isLoading ? (
              <Card className="h-[calc(100vh-300px)] flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading prompt...</p>
                </div>
              </Card>
            ) : error ? (
              <Card className="h-[calc(100vh-300px)] flex items-center justify-center">
                <div className="text-center text-destructive">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4" />
                  <p className="text-lg font-medium">Error loading prompt</p>
                  <p className="text-sm">{error}</p>
                </div>
              </Card>
            ) : editedPrompt ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {FEATURE_LABELS[selectedFeature] || selectedFeature}
                        {selectedPrompt?.source === 'database' ? (
                          <Badge variant="secondary">Customized</Badge>
                        ) : (
                          <Badge variant="outline">Default</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {selectedPrompt?.template.description}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowVariablesInfo(true)}
                      >
                        <Info className="h-4 w-4 mr-2" />
                        Variables
                      </Button>
                      {selectedPrompt?.source === 'database' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowResetDialog(true)}
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Reset
                        </Button>
                      )}
                      <Button size="sm" onClick={handleSave} disabled={isSaving}>
                        <Save className="h-4 w-4 mr-2" />
                        {isSaving ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Model Settings */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Model</Label>
                      <Select
                        value={editedPrompt.model}
                        onValueChange={(v) =>
                          setEditedPrompt((prev) => prev && { ...prev, model: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MODEL_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Temperature: {editedPrompt.temperature.toFixed(1)}</Label>
                      <Slider
                        value={[editedPrompt.temperature]}
                        min={0}
                        max={1}
                        step={0.1}
                        onValueChange={([v]) =>
                          setEditedPrompt((prev) => prev && { ...prev, temperature: v })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Lower = more focused, Higher = more creative
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Max Tokens</Label>
                      <Input
                        type="number"
                        value={editedPrompt.maxTokens}
                        onChange={(e) =>
                          setEditedPrompt((prev) =>
                            prev && { ...prev, maxTokens: parseInt(e.target.value) || 1000 }
                          )
                        }
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* System Prompt */}
                  <div className="space-y-2">
                    <Label>System Prompt</Label>
                    <Textarea
                      value={editedPrompt.systemPrompt}
                      onChange={(e) =>
                        setEditedPrompt((prev) =>
                          prev && { ...prev, systemPrompt: e.target.value }
                        )
                      }
                      className="min-h-[150px] font-mono text-sm"
                      placeholder="System prompt that sets the AI's behavior..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Sets the AI's role and behavior. This is sent before the user message.
                    </p>
                  </div>

                  {/* User Prompt */}
                  <div className="space-y-2">
                    <Label>User Prompt Template</Label>
                    <Textarea
                      value={editedPrompt.userPrompt}
                      onChange={(e) =>
                        setEditedPrompt((prev) =>
                          prev && { ...prev, userPrompt: e.target.value }
                        )
                      }
                      className="min-h-[250px] font-mono text-sm"
                      placeholder="User prompt with ${variables}..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Use {'${variableName}'} for dynamic values. Click "Variables" to see
                      available options.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset to Default?</DialogTitle>
            <DialogDescription>
              This will delete your custom prompt and revert to the system default.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReset} disabled={isSaving}>
              {isSaving ? 'Resetting...' : 'Reset to Default'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Variables Info Dialog */}
      <Dialog open={showVariablesInfo} onOpenChange={setShowVariablesInfo}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Available Variables</DialogTitle>
            <DialogDescription>
              These variables will be replaced with actual values when the prompt runs.
              Use them in your prompt template as {'${variableName}'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedFeature && (
              <div className="rounded-lg border p-4">
                <h4 className="font-medium mb-2">
                  Variables for {FEATURE_LABELS[selectedFeature]}
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {getDefaultTemplateVariables(selectedFeature).map((varName) => (
                    <div
                      key={varName}
                      className="flex items-center gap-2 p-2 rounded bg-muted/50"
                    >
                      <code className="text-sm font-mono text-primary">
                        {'${' + varName + '}'}
                      </code>
                    </div>
                  ))}
                </div>
                {getDefaultTemplateVariables(selectedFeature).length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No variables found in the default template.
                  </p>
                )}
              </div>
            )}
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">Common Variables:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><code>{'${transcript}'}</code> - Meeting transcript text</li>
                <li><code>{'${meetingTitle}'}</code> - Meeting title</li>
                <li><code>{'${contactName}'}</code> - Contact's name</li>
                <li><code>{'${companyName}'}</code> - Company name</li>
                <li><code>{'${subject}'}</code> - Email subject</li>
                <li><code>{'${body}'}</code> - Email body content</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
