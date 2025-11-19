import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  getProposalTemplates, 
  updateProposalTemplate, 
  createProposalTemplate,
  getProposalModelSettings,
  saveProposalModelSettings,
  type ProposalTemplate,
  type ProposalModelSettings
} from '@/lib/services/proposalService';
import { AIProviderService } from '@/lib/services/aiProvider';
import { toast } from 'sonner';
import { Save, Plus, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ProposalSettings() {
  const [templates, setTemplates] = useState<ProposalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<ProposalTemplate | null>(null);
  const [modelSettings, setModelSettings] = useState<ProposalModelSettings>({
    sow_model: 'anthropic/claude-3-5-sonnet-20241022',
    proposal_model: 'anthropic/claude-3-5-sonnet-20241022',
    focus_model: 'anthropic/claude-haiku-4.5', // Claude 4.5 Haiku
    goals_model: 'anthropic/claude-3-5-sonnet-20241022',
  });
  const [availableModels, setAvailableModels] = useState<Array<{ value: string; label: string }>>([]);
  const [savingModels, setSavingModels] = useState(false);

  useEffect(() => {
    loadTemplates();
    loadModelSettings();
    loadAvailableModels();
  }, []);

  const loadModelSettings = async () => {
    try {
      const settings = await getProposalModelSettings();
      setModelSettings(settings);
    } catch (error) {
      toast.error('Failed to load model settings');
    }
  };

  const loadAvailableModels = async () => {
    try {
      const aiService = AIProviderService.getInstance();
      const models = await aiService.fetchOpenRouterModels(true);
      setAvailableModels(models);
    } catch (error) {
      toast.error('Failed to load available models');
      // Set defaults
      setAvailableModels([
        { value: 'anthropic/claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
        { value: 'anthropic/claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
        { value: 'anthropic/claude-3-opus-20240229', label: 'Claude 3 Opus' },
        { value: 'openai/gpt-4o', label: 'GPT-4o' },
        { value: 'openai/gpt-4-turbo', label: 'GPT-4 Turbo' },
      ]);
    }
  };

  const handleSaveModelSettings = async () => {
    setSavingModels(true);
    try {
      const success = await saveProposalModelSettings(modelSettings);
      if (success) {
        toast.success('Model settings saved');
      } else {
        toast.error('Failed to save model settings');
      }
    } catch (error) {
      toast.error('Error saving model settings');
    } finally {
      setSavingModels(false);
    }
  };

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await getProposalTemplates();
      setTemplates(data);
    } catch (error) {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (template: ProposalTemplate) => {
    setSaving(template.id);
    try {
      const success = await updateProposalTemplate(template.id, {
        name: template.name,
        content: template.content,
        is_default: template.is_default,
      });

      if (success) {
        toast.success('Template saved');
        await loadTemplates();
        setEditingTemplate(null);
      } else {
        toast.error('Failed to save template');
      }
    } catch (error) {
      toast.error('Error saving template');
    } finally {
      setSaving(null);
    }
  };

  const handleCreateNew = async () => {
    const newTemplate: Omit<ProposalTemplate, 'id' | 'created_at' | 'updated_at' | 'user_id'> = {
      name: 'New Template',
      type: 'goals',
      content: '',
      is_default: false,
    };

    const created = await createProposalTemplate(newTemplate);
    if (created) {
      toast.success('Template created');
      await loadTemplates();
      setEditingTemplate(created);
    } else {
      toast.error('Failed to create template');
    }
  };

  const groupedTemplates = {
    goals: templates.filter(t => t.type === 'goals'),
    sow: templates.filter(t => t.type === 'sow'),
    proposal: templates.filter(t => t.type === 'proposal'),
    design_system: templates.filter(t => t.type === 'design_system'),
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Proposal Templates</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Edit the example outputs used by AI to generate proposals, SOWs, and goals documents
          </p>
        </div>
        <Button onClick={handleCreateNew} variant="default">
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      <Tabs defaultValue="models" className="space-y-6">
        <TabsList className="bg-white border border-transparent shadow-sm dark:bg-gray-900/50 dark:backdrop-blur-xl dark:border-gray-800/50">
          <TabsTrigger value="models">AI Models</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
          <TabsTrigger value="sow">SOW</TabsTrigger>
          <TabsTrigger value="proposal">Proposal</TabsTrigger>
          <TabsTrigger value="design_system">Design System</TabsTrigger>
        </TabsList>

               <TabsContent value="models" className="space-y-4">
                 <Card>
                   <CardHeader>
                     <CardTitle>OpenRouter Model Selection</CardTitle>
                     <CardDescription>
                       Choose which AI models to use for each proposal generation step. Models are accessed via OpenRouter.
                       <br />
                       <span className="text-xs text-muted-foreground mt-1 block">
                         💡 Tip: Add your personal OpenRouter API key in <strong>Settings → AI Provider Settings</strong> to increase rate limits and avoid rate limit errors.
                       </span>
                     </CardDescription>
                   </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="focus_model">Focus Area Analysis Model</Label>
                <Select
                  value={modelSettings.focus_model}
                  onValueChange={(value) =>
                    setModelSettings({ ...modelSettings, focus_model: value })
                  }
                >
                  <SelectTrigger id="focus_model">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Used for analyzing meeting transcripts to extract focus areas. Recommended: Fast, cost-effective models like Claude Haiku.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="goals_model">Goals Generation Model</Label>
                <Select
                  value={modelSettings.goals_model}
                  onValueChange={(value) =>
                    setModelSettings({ ...modelSettings, goals_model: value })
                  }
                >
                  <SelectTrigger id="goals_model">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Used for generating goals and objectives documents. Recommended: High-quality models like Claude Sonnet or GPT-4.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sow_model">SOW Generation Model</Label>
                <Select
                  value={modelSettings.sow_model}
                  onValueChange={(value) =>
                    setModelSettings({ ...modelSettings, sow_model: value })
                  }
                >
                  <SelectTrigger id="sow_model">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Used for generating Statement of Work documents. Recommended: High-quality models like Claude Sonnet or GPT-4.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="proposal_model">Proposal Generation Model</Label>
                <Select
                  value={modelSettings.proposal_model}
                  onValueChange={(value) =>
                    setModelSettings({ ...modelSettings, proposal_model: value })
                  }
                >
                  <SelectTrigger id="proposal_model">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Used for generating HTML proposal presentations. Recommended: High-quality models with long context like Claude Sonnet or GPT-4 Turbo.
                </p>
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-800">
                <Button
                  onClick={handleSaveModelSettings}
                  disabled={savingModels}
                  variant="default"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {savingModels ? 'Saving...' : 'Save Model Settings'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {(['goals', 'sow', 'proposal', 'design_system'] as const).map((type) => (
          <TabsContent key={type} value={type} className="space-y-4">
            {groupedTemplates[type].length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-gray-500 dark:text-gray-400">
                    No {type} templates found. Create one to get started.
                  </p>
                </CardContent>
              </Card>
            ) : (
              groupedTemplates[type].map((template) => (
                <Card key={template.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">
                          {editingTemplate?.id === template.id ? (
                            <Input
                              value={editingTemplate.name}
                              onChange={(e) =>
                                setEditingTemplate({ ...editingTemplate, name: e.target.value })
                              }
                              className="max-w-md"
                            />
                          ) : (
                            template.name
                          )}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {template.is_default && (
                            <span className="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-semibold mr-2">
                              Default
                            </span>
                          )}
                          {template.type} template
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {editingTemplate?.id === template.id ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleSave(editingTemplate)}
                              disabled={saving === template.id}
                            >
                              <Save className="w-4 h-4 mr-2" />
                              {saving === template.id ? 'Saving...' : 'Save'}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setEditingTemplate(null)}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setEditingTemplate(template)}
                          >
                            Edit
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {editingTemplate?.id === template.id ? (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor={`content-${template.id}`}>Content</Label>
                          <Textarea
                            id={`content-${template.id}`}
                            value={editingTemplate.content}
                            onChange={(e) =>
                              setEditingTemplate({ ...editingTemplate, content: e.target.value })
                            }
                            rows={20}
                            className="font-mono text-sm"
                            placeholder="Enter template content..."
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            This content will be used as a reference example for AI generation
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`default-${template.id}`}
                            checked={editingTemplate.is_default}
                            onChange={(e) =>
                              setEditingTemplate({
                                ...editingTemplate,
                                is_default: e.target.checked,
                              })
                            }
                            className="rounded"
                          />
                          <Label htmlFor={`default-${template.id}`} className="cursor-pointer">
                            Set as default template for this type
                          </Label>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <pre className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 overflow-x-auto text-sm font-mono whitespace-pre-wrap">
                          {template.content.substring(0, 500)}
                          {template.content.length > 500 && '...'}
                        </pre>
                        {template.content.length > 500 && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {template.content.length} characters total
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
