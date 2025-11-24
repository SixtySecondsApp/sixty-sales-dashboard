import { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Edit,
  Save,
  XCircle,
  Eye,
  Copy,
  TrendingUp,
  Mail,
  BarChart3,
  Search,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  SalesTemplateService,
  type SalesTemplate,
  type TemplateCategory,
  type TemplateTone
} from '@/lib/services/salesTemplateService';
import logger from '@/lib/utils/logger';
import { cn } from '@/lib/utils';

const TEMPLATE_CATEGORIES: { value: TemplateCategory; label: string; description: string }[] = [
  { value: 'meeting_followup', label: 'Meeting Follow-up', description: 'Post-meeting follow-ups and action items' },
  { value: 'initial_outreach', label: 'Initial Outreach', description: 'Cold outreach and introductions' },
  { value: 'nurture_sequence', label: 'Nurture Sequence', description: 'Ongoing relationship building' },
  { value: 'deal_progression', label: 'Deal Progression', description: 'Moving deals forward through pipeline' },
  { value: 'reengagement', label: 'Re-engagement', description: 'Reconnecting with cold leads' },
  { value: 'thank_you', label: 'Thank You', description: 'Gratitude and appreciation emails' },
  { value: 'custom', label: 'Custom', description: 'User-defined templates' }
];

const TONE_OPTIONS: { value: TemplateTone; label: string }[] = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'concise', label: 'Concise' },
  { value: 'urgent', label: 'Urgent' }
];

interface EditingTemplate {
  id: string | null;
  name: string;
  description: string;
  category: TemplateCategory;
  subject_template: string;
  body_template: string;
  ai_instructions: string;
  tone: TemplateTone;
  is_shared: boolean;
}

export function SalesTemplateManager() {
  const [templates, setTemplates] = useState<SalesTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<SalesTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<TemplateCategory | 'all'>('all');
  const [showPreview, setShowPreview] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<SalesTemplate | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);

  const [editingTemplate, setEditingTemplate] = useState<EditingTemplate>({
    id: null,
    name: '',
    description: '',
    category: 'meeting_followup',
    subject_template: '',
    body_template: '',
    ai_instructions: '',
    tone: 'professional',
    is_shared: false
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    filterTemplates();
  }, [templates, searchQuery, categoryFilter]);

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      const data = await SalesTemplateService.getTemplates({
        includeShared: true,
        includeDefault: true
      });
      setTemplates(data);
      logger.log('✅ Fetched templates:', data.length);
    } catch (error) {
      logger.error('Error fetching templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  };

  const filterTemplates = () => {
    let filtered = [...templates];

    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(t => t.category === categoryFilter);
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.subject_template.toLowerCase().includes(query) ||
        t.body_template.toLowerCase().includes(query)
      );
    }

    setFilteredTemplates(filtered);
  };

  const handleEdit = (template: SalesTemplate) => {
    setEditingTemplate({
      id: template.id,
      name: template.name,
      description: template.description || '',
      category: template.category,
      subject_template: template.subject_template,
      body_template: template.body_template,
      ai_instructions: template.ai_instructions || '',
      tone: template.tone,
      is_shared: template.is_shared
    });
    setIsEditing(true);
  };

  const handleAddNew = () => {
    setEditingTemplate({
      id: null,
      name: '',
      description: '',
      category: 'meeting_followup',
      subject_template: '',
      body_template: '',
      ai_instructions: '',
      tone: 'professional',
      is_shared: false
    });
    setIsEditing(true);
  };

  const handleDuplicate = async (template: SalesTemplate) => {
    setEditingTemplate({
      id: null,
      name: `${template.name} (Copy)`,
      description: template.description || '',
      category: template.category,
      subject_template: template.subject_template,
      body_template: template.body_template,
      ai_instructions: template.ai_instructions || '',
      tone: template.tone,
      is_shared: false
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingTemplate({
      id: null,
      name: '',
      description: '',
      category: 'meeting_followup',
      subject_template: '',
      body_template: '',
      ai_instructions: '',
      tone: 'professional',
      is_shared: false
    });
  };

  const handleSave = async () => {
    if (!editingTemplate.name || !editingTemplate.subject_template || !editingTemplate.body_template) {
      toast.error('Name, subject, and body are required');
      return;
    }

    try {
      if (editingTemplate.id) {
        // Update existing template
        await SalesTemplateService.updateTemplate(editingTemplate.id, {
          name: editingTemplate.name,
          description: editingTemplate.description || null,
          category: editingTemplate.category,
          subject_template: editingTemplate.subject_template,
          body_template: editingTemplate.body_template,
          ai_instructions: editingTemplate.ai_instructions || null,
          tone: editingTemplate.tone,
          is_shared: editingTemplate.is_shared
        });
        toast.success('Template updated successfully');
      } else {
        // Create new template
        await SalesTemplateService.createTemplate({
          name: editingTemplate.name,
          description: editingTemplate.description || null,
          category: editingTemplate.category,
          subject_template: editingTemplate.subject_template,
          body_template: editingTemplate.body_template,
          ai_instructions: editingTemplate.ai_instructions || null,
          tone: editingTemplate.tone,
          required_variables: [],
          optional_variables: [],
          context_types: [],
          is_active: true,
          is_shared: editingTemplate.is_shared,
          is_default: false,
          user_id: '', // Will be set by service
          org_id: null
        });
        toast.success('Template created successfully');
      }

      fetchTemplates();
      handleCancel();
    } catch (error) {
      logger.error('Error saving template:', error);
      toast.error('Failed to save template');
    }
  };

  const handleDelete = async () => {
    if (!deleteTemplateId) return;

    try {
      await SalesTemplateService.deleteTemplate(deleteTemplateId);
      toast.success('Template deleted successfully');
      fetchTemplates();
      setShowDeleteConfirm(false);
      setDeleteTemplateId(null);
    } catch (error) {
      logger.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  const handlePreview = (template: SalesTemplate) => {
    setPreviewTemplate(template);
    setShowPreview(true);
  };

  const getCategoryBadgeColor = (category: TemplateCategory): string => {
    const colors: Record<TemplateCategory, string> = {
      meeting_followup: 'bg-blue-500/20 text-blue-400',
      initial_outreach: 'bg-green-500/20 text-green-400',
      nurture_sequence: 'bg-purple-500/20 text-purple-400',
      deal_progression: 'bg-yellow-500/20 text-yellow-400',
      reengagement: 'bg-orange-500/20 text-orange-400',
      thank_you: 'bg-pink-500/20 text-pink-400',
      custom: 'bg-gray-500/20 text-gray-400'
    };
    return colors[category];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-[#37bd7e]" />
                Sales Template Manager
              </CardTitle>
              <CardDescription>
                Create and manage AI-powered sales email templates
              </CardDescription>
            </div>
            <Button onClick={handleAddNew} className="bg-[#37bd7e] hover:bg-[#2da76c]">
              <Plus className="w-4 h-4 mr-2" />
              New Template
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={categoryFilter}
              onValueChange={(value) => setCategoryFilter(value as TemplateCategory | 'all')}
            >
              <SelectTrigger className="w-[200px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {TEMPLATE_CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="bg-gray-800/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Total Templates</p>
                    <p className="text-2xl font-bold">{templates.length}</p>
                  </div>
                  <Mail className="w-8 h-8 text-gray-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Total Usage</p>
                    <p className="text-2xl font-bold">
                      {templates.reduce((sum, t) => sum + t.usage_count, 0)}
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-gray-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Avg Response Rate</p>
                    <p className="text-2xl font-bold">
                      {templates.length > 0
                        ? Math.round(
                            templates.reduce((sum, t) => sum + t.avg_response_rate, 0) / templates.length
                          )
                        : 0}%
                    </p>
                  </div>
                  <BarChart3 className="w-8 h-8 text-gray-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Avg Conversion</p>
                    <p className="text-2xl font-bold">
                      {templates.length > 0
                        ? Math.round(
                            templates.reduce((sum, t) => sum + t.avg_conversion_rate, 0) / templates.length
                          )
                        : 0}%
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-gray-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Template List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#37bd7e]" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">
                {searchQuery || categoryFilter !== 'all'
                  ? 'No templates found matching your filters'
                  : 'No templates yet. Create your first one!'}
              </p>
            </div>
          ) : (
            <div className="border border-gray-800 rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800 hover:bg-gray-800/50">
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Tone</TableHead>
                    <TableHead className="text-right">Usage</TableHead>
                    <TableHead className="text-right">Response Rate</TableHead>
                    <TableHead className="text-right">Conversion</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTemplates.map((template) => (
                    <TableRow
                      key={template.id}
                      className="border-gray-800 hover:bg-gray-800/50"
                    >
                      <TableCell>
                        <div>
                          <div className="font-medium">{template.name}</div>
                          {template.description && (
                            <div className="text-sm text-gray-400 truncate max-w-md">
                              {template.description}
                            </div>
                          )}
                          <div className="flex gap-2 mt-1">
                            {template.is_default && (
                              <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-400">
                                Default
                              </Badge>
                            )}
                            {template.is_shared && (
                              <Badge variant="outline" className="text-xs border-purple-500/50 text-purple-400">
                                Shared
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getCategoryBadgeColor(template.category)}>
                          {TEMPLATE_CATEGORIES.find(c => c.value === template.category)?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="capitalize text-gray-400">{template.tone}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        {template.usage_count}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={cn(
                          "font-medium",
                          template.avg_response_rate >= 30 ? "text-green-400" :
                          template.avg_response_rate >= 15 ? "text-yellow-400" :
                          "text-gray-400"
                        )}>
                          {template.avg_response_rate.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={cn(
                          "font-medium",
                          template.avg_conversion_rate >= 20 ? "text-green-400" :
                          template.avg_conversion_rate >= 10 ? "text-yellow-400" :
                          "text-gray-400"
                        )}>
                          {template.avg_conversion_rate.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePreview(template)}
                            className="hover:bg-gray-800"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDuplicate(template)}
                            className="hover:bg-gray-800"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          {!template.is_default && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(template)}
                                className="hover:bg-gray-800"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setDeleteTemplateId(template.id);
                                  setShowDeleteConfirm(true);
                                }}
                                className="hover:bg-red-900/50 text-red-400"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={isEditing} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate.id ? 'Edit Template' : 'Create New Template'}
            </DialogTitle>
            <DialogDescription>
              Create AI-powered sales email templates with variable placeholders like {'{'}{'{'} contact_name {'}'}{'}'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                  placeholder="e.g., Meeting Follow-up"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={editingTemplate.category}
                  onValueChange={(value) => setEditingTemplate({ ...editingTemplate, category: value as TemplateCategory })}
                >
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editingTemplate.description}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                placeholder="Brief description of when to use this template"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tone">Tone *</Label>
                <Select
                  value={editingTemplate.tone}
                  onValueChange={(value) => setEditingTemplate({ ...editingTemplate, tone: value as TemplateTone })}
                >
                  <SelectTrigger id="tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TONE_OPTIONS.map(tone => (
                      <SelectItem key={tone.value} value={tone.value}>
                        {tone.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="is_shared" className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_shared"
                    checked={editingTemplate.is_shared}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, is_shared: e.target.checked })}
                    className="rounded border-gray-700"
                  />
                  Share with organization
                </Label>
                <p className="text-xs text-gray-400">
                  Allow other team members to use this template
                </p>
              </div>
            </div>

            {/* Template Content */}
            <div className="space-y-2">
              <Label htmlFor="subject">Subject Line *</Label>
              <Input
                id="subject"
                value={editingTemplate.subject_template}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, subject_template: e.target.value })}
                placeholder="e.g., Great connecting on {{meeting_date}}"
              />
              <p className="text-xs text-gray-400">
                Use {'{'}{'{'} variable_name {'}'}{'}'}  for dynamic content
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Email Body *</Label>
              <Textarea
                id="body"
                value={editingTemplate.body_template}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, body_template: e.target.value })}
                placeholder="Hi {{contact_first_name}},&#10;&#10;Thank you for meeting with me on {{meeting_date}}..."
                rows={10}
                className="font-mono text-sm"
              />
              <p className="text-xs text-gray-400">
                Available variables: contact_name, contact_first_name, company_name, meeting_date, deal_value, sender_name
              </p>
            </div>

            {/* AI Instructions */}
            <div className="space-y-2">
              <Label htmlFor="ai_instructions">AI Personalization Instructions</Label>
              <Textarea
                id="ai_instructions"
                value={editingTemplate.ai_instructions}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, ai_instructions: e.target.value })}
                placeholder="e.g., Reference specific pain points mentioned in the meeting. Keep tone warm but professional."
                rows={3}
              />
              <p className="text-xs text-gray-400">
                Optional: Guide the AI on how to personalize this template
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={handleCancel}>
              <XCircle className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-[#37bd7e] hover:bg-[#2da76c]">
              <Save className="w-4 h-4 mr-2" />
              {editingTemplate.id ? 'Update' : 'Create'} Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Template Preview: {previewTemplate?.name}</DialogTitle>
            <DialogDescription>
              {previewTemplate?.description}
            </DialogDescription>
          </DialogHeader>

          {previewTemplate && (
            <div className="space-y-4">
              <div>
                <Label className="text-gray-400">Category</Label>
                <Badge className={getCategoryBadgeColor(previewTemplate.category)}>
                  {TEMPLATE_CATEGORIES.find(c => c.value === previewTemplate.category)?.label}
                </Badge>
              </div>

              <div>
                <Label className="text-gray-400">Subject Line</Label>
                <p className="mt-1 p-3 bg-gray-800/50 rounded border border-gray-700">
                  {previewTemplate.subject_template}
                </p>
              </div>

              <div>
                <Label className="text-gray-400">Email Body</Label>
                <pre className="mt-1 p-3 bg-gray-800/50 rounded border border-gray-700 whitespace-pre-wrap text-sm">
                  {previewTemplate.body_template}
                </pre>
              </div>

              {previewTemplate.ai_instructions && (
                <div>
                  <Label className="text-gray-400">AI Instructions</Label>
                  <p className="mt-1 p-3 bg-blue-500/10 rounded border border-blue-500/20 text-sm">
                    {previewTemplate.ai_instructions}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-800">
                <div>
                  <Label className="text-gray-400">Usage</Label>
                  <p className="text-2xl font-bold">{previewTemplate.usage_count}</p>
                </div>
                <div>
                  <Label className="text-gray-400">Response Rate</Label>
                  <p className="text-2xl font-bold text-green-400">
                    {previewTemplate.avg_response_rate.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <Label className="text-gray-400">Conversion</Label>
                  <p className="text-2xl font-bold text-green-400">
                    {previewTemplate.avg_conversion_rate.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template?</DialogTitle>
            <DialogDescription>
              This will permanently delete this template. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
