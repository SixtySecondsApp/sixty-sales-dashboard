import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExtractionRulesService, type TaskExtractionRule, type MeetingTypeTemplate } from '@/lib/services/extractionRulesService';
import { useUser } from '@/lib/hooks/useUser';
import { Plus, Trash2, Edit, X, Save, AlertCircle, CheckCircle2, Target, FileText, Info, Sparkles, Lightbulb, Zap } from 'lucide-react';
import { toast } from 'sonner';

export default function ExtractionRules() {
  const { userData: user } = useUser();
  const [rules, setRules] = useState<TaskExtractionRule[]>([]);
  const [templates, setTemplates] = useState<MeetingTypeTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [showNewRuleForm, setShowNewRuleForm] = useState(false);
  const [showNewTemplateForm, setShowNewTemplateForm] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const [rulesData, templatesData] = await Promise.all([
        ExtractionRulesService.getExtractionRules(user.id),
        ExtractionRulesService.getMeetingTypeTemplates(user.id),
      ]);
      setRules(rulesData);
      setTemplates(templatesData);
    } catch (error) {
      console.error('Error loading extraction rules:', error);
      toast.error('Failed to load extraction rules');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = async (ruleData: Omit<TaskExtractionRule, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user) return;

    try {
      await ExtractionRulesService.createExtractionRule(user.id, ruleData);
      toast.success('Extraction rule created');
      setShowNewRuleForm(false);
      loadData();
    } catch (error) {
      console.error('Error creating rule:', error);
      toast.error('Failed to create extraction rule');
    }
  };

  const handleUpdateRule = async (ruleId: string, updates: Partial<TaskExtractionRule>) => {
    if (!user) return;

    try {
      await ExtractionRulesService.updateExtractionRule(user.id, ruleId, updates);
      toast.success('Extraction rule updated');
      setEditingRule(null);
      loadData();
    } catch (error) {
      console.error('Error updating rule:', error);
      toast.error('Failed to update extraction rule');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!user) return;

    if (!confirm('Are you sure you want to delete this extraction rule?')) return;

    try {
      await ExtractionRulesService.deleteExtractionRule(user.id, ruleId);
      toast.success('Extraction rule deleted');
      loadData();
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast.error('Failed to delete extraction rule');
    }
  };

  const handleUpsertTemplate = async (templateData: Omit<MeetingTypeTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user) return;

    try {
      await ExtractionRulesService.upsertMeetingTypeTemplate(user.id, templateData);
      toast.success('Meeting type template saved');
      setShowNewTemplateForm(false);
      setEditingTemplate(null);
      loadData();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template');
    }
  };

  const handleDeleteTemplate = async (meetingType: string) => {
    if (!user) return;

    if (!confirm(`Are you sure you want to delete the ${meetingType.replace('_', ' ')} template?`)) return;

    try {
      await ExtractionRulesService.deleteMeetingTypeTemplate(user.id, meetingType);
      toast.success('Meeting type template deleted');
      loadData();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading extraction rules...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-start justify-between">
            <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Extraction Rules
          </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Automatically create tasks from meeting transcripts using your custom rules
              </p>
            </div>
          </div>

          {/* How It Works Info Card */}
          <Card className="mt-6 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <Sparkles className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                    How It Works
                  </h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                    When meetings are processed, the system scans transcripts for your trigger phrases. When found, tasks are automatically created with your specified settings.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Task Extraction Rules</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Create rules that trigger when specific phrases appear in transcripts</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Meeting Type Templates</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Set default task settings based on meeting type (discovery, demo, etc.)</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <Tabs defaultValue="rules" className="space-y-6">
          <TabsList>
            <TabsTrigger value="rules">Task Extraction Rules</TabsTrigger>
            <TabsTrigger value="templates">Meeting Type Templates</TabsTrigger>
          </TabsList>

          {/* Task Extraction Rules Tab */}
          <TabsContent value="rules" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Create rules that automatically extract tasks when specific phrases appear in meeting transcripts
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <Lightbulb className="w-4 h-4" />
                  <span>
                    <strong>Example:</strong> If you add a rule with trigger phrase "send proposal", 
                    any meeting transcript containing those words will automatically create a task.
                  </span>
                </div>
              </div>
              <Button onClick={() => setShowNewRuleForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Rule
              </Button>
            </div>

            {/* New Rule Form */}
            {showNewRuleForm && (
              <NewRuleForm
                onSave={handleCreateRule}
                onCancel={() => setShowNewRuleForm(false)}
              />
            )}

            {/* Rules List */}
            {rules.length === 0 && !showNewRuleForm ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500 dark:text-gray-400 mb-4">No extraction rules yet</p>
                  <Button onClick={() => setShowNewRuleForm(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Rule
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {rules.map((rule) => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    isEditing={editingRule === rule.id}
                    onEdit={() => setEditingRule(rule.id)}
                    onCancel={() => setEditingRule(null)}
                    onSave={(updates) => handleUpdateRule(rule.id, updates)}
                    onDelete={() => handleDeleteRule(rule.id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Meeting Type Templates Tab */}
          <TabsContent value="templates" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Configure default task settings and email templates for different meeting types
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <Lightbulb className="w-4 h-4" />
                  <span>
                    <strong>Example:</strong> Set discovery meetings to always create high-priority tasks 
                    with a 2-day deadline, or configure demo meetings to use a specific follow-up email template.
                  </span>
                </div>
              </div>
              <Button onClick={() => setShowNewTemplateForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Template
              </Button>
            </div>

            {/* New Template Form */}
            {showNewTemplateForm && (
              <NewTemplateForm
                onSave={handleUpsertTemplate}
                onCancel={() => setShowNewTemplateForm(false)}
                existingTypes={templates.map(t => t.meeting_type)}
              />
            )}

            {/* Templates List */}
            {templates.length === 0 && !showNewTemplateForm ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500 dark:text-gray-400 mb-4">No meeting type templates yet</p>
                  <Button onClick={() => setShowNewTemplateForm(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Template
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {templates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    isEditing={editingTemplate === template.id}
                    onEdit={() => setEditingTemplate(template.id)}
                    onCancel={() => setEditingTemplate(null)}
                    onSave={handleUpsertTemplate}
                    onDelete={() => handleDeleteTemplate(template.meeting_type)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// New Rule Form Component
function NewRuleForm({ onSave, onCancel }: { onSave: (rule: any) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [triggerPhrases, setTriggerPhrases] = useState<string[]>(['']);
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [deadlineDays, setDeadlineDays] = useState<number | null>(null);
  const [isActive, setIsActive] = useState(true);

  const addPhrase = () => {
    setTriggerPhrases([...triggerPhrases, '']);
  };

  const removePhrase = (index: number) => {
    setTriggerPhrases(triggerPhrases.filter((_, i) => i !== index));
  };

  const updatePhrase = (index: number, value: string) => {
    const updated = [...triggerPhrases];
    updated[index] = value;
    setTriggerPhrases(updated);
  };

  const handleSubmit = () => {
    if (!name || !category || triggerPhrases.filter(p => p.trim()).length === 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    onSave({
      name,
      trigger_phrases: triggerPhrases.filter(p => p.trim()),
      task_category: category,
      default_priority: priority,
      default_deadline_days: deadlineDays,
      is_active: isActive,
    });
  };

  return (
    <Card className="border-2 border-gray-200 dark:border-gray-700">
      <CardHeader>
        <CardTitle>Create New Extraction Rule</CardTitle>
        <CardDescription>
          Define trigger phrases that will automatically create tasks when found in transcripts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Example Preview */}
        <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-gray-600 dark:text-gray-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-gray-700 dark:text-gray-300">
              <strong>How it works:</strong> When a meeting transcript contains any of your trigger phrases, 
              a task will be automatically created with the settings you configure below.
            </div>
          </div>
        </div>
        <div>
          <Label>Rule Name *</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Follow-up on pricing"
          />
        </div>

        <div>
          <Label>Trigger Phrases *</Label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Add phrases that, when found in meeting transcripts, will trigger task creation. The search is case-insensitive.
          </p>
          <div className="space-y-2">
            {triggerPhrases.map((phrase, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={phrase}
                  onChange={(e) => updatePhrase(index, e.target.value)}
                  placeholder="e.g., follow up, send quote, schedule demo"
                />
                {triggerPhrases.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removePhrase(index)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" onClick={addPhrase} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Add Another Phrase
            </Button>
          </div>
          {triggerPhrases.some(p => p.trim()) && (
            <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs">
              <p className="text-gray-600 dark:text-gray-400 mb-1">
                <strong>Preview:</strong> Tasks will be created when transcripts contain:
              </p>
              <div className="flex flex-wrap gap-1">
                {triggerPhrases.filter(p => p.trim()).map((phrase, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">"{phrase}"</Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Task Category *</Label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g., Follow-up, Proposal, Demo"
            />
          </div>
          <div>
            <Label>Default Priority</Label>
            <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Default Deadline (days from meeting)</Label>
          <Input
            type="number"
            value={deadlineDays || ''}
            onChange={(e) => setDeadlineDays(e.target.value ? parseInt(e.target.value) : null)}
            placeholder="e.g., 3"
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <div>
              <Label>Active</Label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Only active rules are used when processing meetings
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button onClick={handleSubmit}>Create Rule</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Rule Card Component
function RuleCard({
  rule,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  onDelete,
}: {
  rule: TaskExtractionRule;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (updates: any) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(rule.name);
  const [triggerPhrases, setTriggerPhrases] = useState(rule.trigger_phrases);
  const [category, setCategory] = useState(rule.task_category);
  const [priority, setPriority] = useState(rule.default_priority);
  const [deadlineDays, setDeadlineDays] = useState(rule.default_deadline_days);
  const [isActive, setIsActive] = useState(rule.is_active);

  const handleSave = () => {
    onSave({
      name,
      trigger_phrases: triggerPhrases,
      task_category: category,
      default_priority: priority,
      default_deadline_days: deadlineDays,
      is_active: isActive,
    });
  };

  if (isEditing) {
    return (
      <Card className="border-2 border-gray-200 dark:border-gray-700">
        <CardContent className="pt-6 space-y-4">
          <div>
            <Label>Rule Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Trigger Phrases</Label>
            <div className="space-y-2">
              {triggerPhrases.map((phrase, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={phrase}
                    onChange={(e) => {
                      const updated = [...triggerPhrases];
                      updated[index] = e.target.value;
                      setTriggerPhrases(updated);
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setTriggerPhrases(triggerPhrases.filter((_, i) => i !== index))}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" onClick={() => setTriggerPhrases([...triggerPhrases, ''])}>
                <Plus className="w-4 h-4 mr-2" />
                Add Phrase
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Category</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Deadline Days</Label>
            <Input
              type="number"
              value={deadlineDays || ''}
              onChange={(e) => setDeadlineDays(e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Active</Label>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onCancel}>Cancel</Button>
              <Button onClick={handleSave}>Save</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-semibold text-lg">{rule.name}</h3>
              <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                {rule.is_active ? 'Active' : 'Inactive'}
              </Badge>
              <Badge variant="outline">{rule.task_category}</Badge>
              <Badge variant="outline">{rule.default_priority}</Badge>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Trigger Phrases:</p>
                <div className="flex flex-wrap gap-2">
                  {rule.trigger_phrases.map((phrase, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      "{phrase}"
                    </Badge>
                  ))}
                </div>
              </div>
              {rule.default_deadline_days && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Default deadline: {rule.default_deadline_days} days
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Edit className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Template Card Component
function TemplateCard({
  template,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  onDelete,
}: {
  template: MeetingTypeTemplate;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (template: any) => void;
  onDelete: () => void;
}) {
  // Parse existing template data or use defaults
  const extractionTemplate = template.extraction_template || {};
  const contentTemplates = template.content_templates || {};
  
  const [defaultPriority, setDefaultPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>(
    (extractionTemplate.default_priority as 'low' | 'medium' | 'high' | 'urgent') || 'medium'
  );
  const [defaultDeadlineDays, setDefaultDeadlineDays] = useState<number | null>(
    extractionTemplate.default_deadline_days || null
  );
  const [preferredCategories, setPreferredCategories] = useState<string[]>(
    extractionTemplate.preferred_categories || []
  );
  const [followUpEmailTemplate, setFollowUpEmailTemplate] = useState(
    contentTemplates.follow_up_email || ''
  );
  const [isActive, setIsActive] = useState(template.is_active);

  const categoryOptions = [
    { value: 'follow_up', label: 'Follow Up' },
    { value: 'proposal', label: 'Proposal' },
    { value: 'demo', label: 'Demo' },
    { value: 'email', label: 'Email' },
    { value: 'call', label: 'Call' },
    { value: 'meeting', label: 'Meeting' },
    { value: 'general', label: 'General' },
  ];

  const toggleCategory = (category: string) => {
    setPreferredCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleSave = () => {
    // Build extraction template from form fields
    const extractionTemplateData: Record<string, any> = {
      default_priority: defaultPriority,
    };
    
    if (defaultDeadlineDays !== null) {
      extractionTemplateData.default_deadline_days = defaultDeadlineDays;
    }
    
    if (preferredCategories.length > 0) {
      extractionTemplateData.preferred_categories = preferredCategories;
    }

    // Build content templates from form fields
    const contentTemplatesData: Record<string, any> = {};
    
    if (followUpEmailTemplate.trim()) {
      contentTemplatesData.follow_up_email = followUpEmailTemplate.trim();
    }

    onSave({
      meeting_type: template.meeting_type,
      extraction_template: extractionTemplateData,
      content_templates: contentTemplatesData,
      is_active: isActive,
    });
  };

  if (isEditing) {
    return (
      <Card className="border-2 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="capitalize">{template.meeting_type.replace('_', ' ')} Template</CardTitle>
          <CardDescription>
            Configure default settings for tasks and content when this meeting type is detected
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Task Extraction Settings */}
          <div className="space-y-4 border-t pt-4">
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Target className="w-4 h-4" />
                Task Extraction Settings
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                These settings apply to tasks automatically extracted from {template.meeting_type.replace('_', ' ')} meetings
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Default Task Priority</Label>
                <Select value={defaultPriority} onValueChange={(v: any) => setDefaultPriority(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Priority assigned to tasks from {template.meeting_type.replace('_', ' ')} meetings
                </p>
              </div>

              <div>
                <Label>Default Deadline (days)</Label>
                <Input
                  type="number"
                  min="0"
                  value={defaultDeadlineDays || ''}
                  onChange={(e) => setDefaultDeadlineDays(e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="e.g., 3"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Days from meeting date (leave empty for no default)
                </p>
              </div>
            </div>

            <div>
              <Label>Preferred Task Categories</Label>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                Select categories that are commonly used for {template.meeting_type.replace('_', ' ')} meetings
              </p>
              <div className="flex flex-wrap gap-2">
                {categoryOptions.map((cat) => (
                  <Badge
                    key={cat.value}
                    variant={preferredCategories.includes(cat.value) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleCategory(cat.value)}
                  >
                    {cat.label}
                  </Badge>
                ))}
              </div>
              {preferredCategories.length > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Selected: {preferredCategories.map(c => categoryOptions.find(o => o.value === c)?.label).join(', ')}
                </p>
              )}
            </div>
          </div>

          {/* Content Templates */}
          <div className="space-y-4 border-t pt-4">
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Content Templates
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                Email templates that can be used when generating follow-up content for {template.meeting_type.replace('_', ' ')} meetings
              </p>
            </div>

            <div>
              <Label>Follow-Up Email Template (Optional)</Label>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                This template will be available when generating follow-up emails after {template.meeting_type.replace('_', ' ')} meetings
              </p>
              <textarea
                className="w-full h-32 p-3 border rounded-md text-sm dark:bg-gray-800"
                value={followUpEmailTemplate}
                onChange={(e) => setFollowUpEmailTemplate(e.target.value)}
                placeholder={`Hi {{contact_name}},\n\nThank you for taking the time to discuss {{topic}} today. As we discussed...\n\nBest regards,\n{{your_name}}`}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                You can use variables like {"{"}{"{"}contact_name{"}"}{"}"}, {"{"}{"{"}meeting_date{"}"}{"}"}, {"{"}{"{"}company_name{"}"}{"}"}
              </p>
            </div>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between border-t pt-4">
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <div>
                <Label>Active</Label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Only active templates are used when processing meetings
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onCancel}>Cancel</Button>
              <Button onClick={handleSave}>Save Changes</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Use the already declared extractionTemplate and contentTemplates from above
  const categoryOptionsDisplay = [
    { value: 'follow_up', label: 'Follow Up' },
    { value: 'proposal', label: 'Proposal' },
    { value: 'demo', label: 'Demo' },
    { value: 'email', label: 'Email' },
    { value: 'call', label: 'Call' },
    { value: 'meeting', label: 'Meeting' },
    { value: 'general', label: 'General' },
  ];

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <h3 className="font-semibold text-lg capitalize">{template.meeting_type.replace('_', ' ')}</h3>
              <Badge variant={template.is_active ? 'default' : 'secondary'}>
                {template.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            
            {/* Show configured settings */}
            <div className="space-y-2">
              {extractionTemplate.default_priority && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Default Priority:</span>
                  <Badge variant="outline" className="text-xs">{extractionTemplate.default_priority}</Badge>
                </div>
              )}
              {extractionTemplate.default_deadline_days && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Default Deadline:</span>
                  <Badge variant="outline" className="text-xs">{extractionTemplate.default_deadline_days} days</Badge>
                </div>
              )}
              {extractionTemplate.preferred_categories && extractionTemplate.preferred_categories.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Preferred Categories:</span>
                  {extractionTemplate.preferred_categories.map((cat: string) => (
                    <Badge key={cat} variant="outline" className="text-xs">
                      {categoryOptionsDisplay.find(o => o.value === cat)?.label || cat}
                    </Badge>
                  ))}
                </div>
              )}
              {contentTemplates.follow_up_email && (
                <div className="flex items-start gap-2 mt-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Follow-up Email:</span>
                  <span className="text-xs text-gray-600 dark:text-gray-300">Configured</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={onEdit} title="Edit template">
              <Edit className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete} title="Delete template">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// New Template Form Component
function NewTemplateForm({ 
  onSave, 
  onCancel,
  existingTypes 
}: { 
  onSave: (template: any) => void; 
  onCancel: () => void;
  existingTypes: string[];
}) {
  const [meetingType, setMeetingType] = useState<string>('');
  const [defaultPriority, setDefaultPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [defaultDeadlineDays, setDefaultDeadlineDays] = useState<number | null>(null);
  const [preferredCategories, setPreferredCategories] = useState<string[]>([]);
  const [followUpEmailTemplate, setFollowUpEmailTemplate] = useState('');
  const [isActive, setIsActive] = useState(true);

  const availableTypes: Array<{ value: string; label: string; description: string }> = [
    { value: 'discovery', label: 'Discovery', description: 'Initial meetings to understand customer needs' },
    { value: 'demo', label: 'Demo', description: 'Product demonstrations and walkthroughs' },
    { value: 'negotiation', label: 'Negotiation', description: 'Pricing and contract discussions' },
    { value: 'closing', label: 'Closing', description: 'Final steps to close the deal' },
    { value: 'follow_up', label: 'Follow Up', description: 'Ongoing relationship building' },
    { value: 'general', label: 'General', description: 'Other types of meetings' },
  ];

  const availableTypesFiltered = availableTypes.filter(
    type => !existingTypes.includes(type.value)
  );

  const categoryOptions = [
    { value: 'follow_up', label: 'Follow Up' },
    { value: 'proposal', label: 'Proposal' },
    { value: 'demo', label: 'Demo' },
    { value: 'email', label: 'Email' },
    { value: 'call', label: 'Call' },
    { value: 'meeting', label: 'Meeting' },
    { value: 'general', label: 'General' },
  ];

  const toggleCategory = (category: string) => {
    setPreferredCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleSubmit = () => {
    if (!meetingType) {
      toast.error('Please select a meeting type');
      return;
    }

    // Build extraction template from form fields
    const extractionTemplate: Record<string, any> = {
      default_priority: defaultPriority,
    };
    
    if (defaultDeadlineDays !== null) {
      extractionTemplate.default_deadline_days = defaultDeadlineDays;
    }
    
    if (preferredCategories.length > 0) {
      extractionTemplate.preferred_categories = preferredCategories;
    }

    // Build content templates from form fields
    const contentTemplates: Record<string, any> = {};
    
    if (followUpEmailTemplate.trim()) {
      contentTemplates.follow_up_email = followUpEmailTemplate.trim();
    }

    onSave({
      meeting_type: meetingType,
      extraction_template: extractionTemplate,
      content_templates: contentTemplates,
      is_active: isActive,
    });
  };

  const selectedType = availableTypes.find(t => t.value === meetingType);

  return (
    <Card className="border-2 border-gray-200 dark:border-gray-700">
      <CardHeader>
        <CardTitle>Create Meeting Type Template</CardTitle>
        <CardDescription>
          Configure default settings for tasks and content when this meeting type is detected
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Meeting Type Selection */}
        <div>
          <Label>Meeting Type *</Label>
          <Select value={meetingType} onValueChange={setMeetingType}>
            <SelectTrigger>
              <SelectValue placeholder="Select meeting type" />
            </SelectTrigger>
            <SelectContent>
              {availableTypesFiltered.length > 0 ? (
                availableTypesFiltered.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div>
                      <div className="font-medium">{type.label}</div>
                      <div className="text-xs text-gray-500">{type.description}</div>
                    </div>
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="" disabled>
                  All meeting types already have templates
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {selectedType && (
            <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <strong>What this does:</strong> When a meeting is classified as "{selectedType.label}", 
                tasks extracted from the transcript will use these default settings.
              </p>
            </div>
          )}
          {existingTypes.length > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Already configured: {existingTypes.map(t => t.replace('_', ' ')).join(', ')}
            </p>
          )}
        </div>

        {/* Task Extraction Settings */}
        <div className="space-y-4 border-t pt-4">
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Target className="w-4 h-4" />
              Task Extraction Settings
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
              These settings apply to tasks automatically extracted from {selectedType?.label.toLowerCase() || 'this type of'} meetings
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Default Task Priority</Label>
              <Select value={defaultPriority} onValueChange={(v: any) => setDefaultPriority(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Priority assigned to tasks from {selectedType?.label.toLowerCase() || 'these'} meetings
              </p>
            </div>

            <div>
              <Label>Default Deadline (days)</Label>
              <Input
                type="number"
                min="0"
                value={defaultDeadlineDays || ''}
                onChange={(e) => setDefaultDeadlineDays(e.target.value ? parseInt(e.target.value) : null)}
                placeholder="e.g., 3"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Days from meeting date (leave empty for no default)
              </p>
            </div>
          </div>

          <div>
            <Label>Preferred Task Categories</Label>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
              Select categories that are commonly used for {selectedType?.label.toLowerCase() || 'this type of'} meetings
            </p>
            <div className="flex flex-wrap gap-2">
              {categoryOptions.map((cat) => (
                <Badge
                  key={cat.value}
                  variant={preferredCategories.includes(cat.value) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleCategory(cat.value)}
                >
                  {cat.label}
                </Badge>
              ))}
            </div>
            {preferredCategories.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Selected: {preferredCategories.map(c => categoryOptions.find(o => o.value === c)?.label).join(', ')}
              </p>
            )}
          </div>
        </div>

        {/* Content Templates */}
        <div className="space-y-4 border-t pt-4">
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Content Templates
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
              Email templates that can be used when generating follow-up content for {selectedType?.label.toLowerCase() || 'this type of'} meetings
            </p>
          </div>

          <div>
            <Label>Follow-Up Email Template (Optional)</Label>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
              This template will be available when generating follow-up emails after {selectedType?.label.toLowerCase() || 'these'} meetings
            </p>
            <textarea
              className="w-full h-32 p-3 border rounded-md text-sm dark:bg-gray-800"
              value={followUpEmailTemplate}
              onChange={(e) => setFollowUpEmailTemplate(e.target.value)}
              placeholder={`Hi {{contact_name}},\n\nThank you for taking the time to discuss {{topic}} today. As we discussed...\n\nBest regards,\n{{your_name}}`}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              You can use variables like {"{"}{"{"}contact_name{"}"}{"}"}, {"{"}{"{"}meeting_date{"}"}{"}"}, {"{"}{"{"}company_name{"}"}{"}"}
            </p>
          </div>
        </div>

        {/* Active Toggle */}
        <div className="flex items-center justify-between border-t pt-4">
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <div>
              <Label>Active</Label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Only active templates are used when processing meetings
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!meetingType || availableTypesFiltered.length === 0}>
              Create Template
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

