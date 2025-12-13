/**
 * Proposal Workflow Settings Page
 *
 * Admin-only page for managing organization-level proposal workflows.
 * Features:
 * - List all proposal workflows
 * - Create, edit, and delete workflows
 * - Configure which output types are included
 * - Set default workflow
 * - Toggle active/inactive status
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Edit2,
  Trash2,
  MoreVertical,
  Star,
  Loader2,
  FileText,
  Mail,
  FileCode,
  Target,
  ScrollText,
  Copy,
  AlertCircle,
} from 'lucide-react';
import {
  OrgProposalWorkflowService,
  type OrgProposalWorkflow,
  type CreateProposalWorkflowInput,
  getWorkflowOutputTypes,
} from '@/lib/services/orgProposalWorkflowService';
import { useOrgId, useOrgPermissions } from '@/lib/contexts/OrgContext';
import { useAuth } from '@/lib/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Output type configuration
const OUTPUT_TYPES = [
  { key: 'include_goals', label: 'Goals & Objectives', icon: Target, description: 'Extracted goals from meetings' },
  { key: 'include_sow', label: 'Statement of Work', icon: ScrollText, description: 'Formal SOW document' },
  { key: 'include_html', label: 'HTML Proposal', icon: FileCode, description: 'Interactive HTML presentation' },
  { key: 'include_email', label: 'Email', icon: Mail, description: 'Email-ready text' },
  { key: 'include_markdown', label: 'Markdown', icon: FileText, description: 'Clean markdown document' },
] as const;

interface WorkflowFormData {
  name: string;
  description: string;
  include_goals: boolean;
  include_sow: boolean;
  include_html: boolean;
  include_email: boolean;
  include_markdown: boolean;
  is_default: boolean;
}

const emptyFormData: WorkflowFormData = {
  name: '',
  description: '',
  include_goals: false,
  include_sow: false,
  include_html: false,
  include_email: false,
  include_markdown: false,
  is_default: false,
};

export default function ProposalWorkflowSettings() {
  const orgId = useOrgId();
  const { user } = useAuth();
  const permissions = useOrgPermissions();
  const [workflows, setWorkflows] = useState<OrgProposalWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<OrgProposalWorkflow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<WorkflowFormData>(emptyFormData);

  const canEdit = permissions.isAdmin || permissions.isOwner;

  useEffect(() => {
    if (orgId) {
      loadWorkflows();
    }
  }, [orgId]);

  const loadWorkflows = async () => {
    if (!orgId) return;

    try {
      setLoading(true);
      const data = await OrgProposalWorkflowService.getWorkflows(orgId);
      setWorkflows(data);
    } catch (error) {
      console.error('Error loading proposal workflows:', error);
      toast.error('Failed to load proposal workflows');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingWorkflow(null);
    setFormData(emptyFormData);
    setShowModal(true);
  };

  const openEditModal = (workflow: OrgProposalWorkflow) => {
    setEditingWorkflow(workflow);
    setFormData({
      name: workflow.name,
      description: workflow.description || '',
      include_goals: workflow.include_goals,
      include_sow: workflow.include_sow,
      include_html: workflow.include_html,
      include_email: workflow.include_email,
      include_markdown: workflow.include_markdown,
      is_default: workflow.is_default,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingWorkflow(null);
    setFormData(emptyFormData);
  };

  const handleSave = async () => {
    if (!orgId) return;

    // Validate
    if (!formData.name.trim()) {
      toast.error('Workflow name is required');
      return;
    }

    const hasOutput = formData.include_goals || formData.include_sow ||
                      formData.include_html || formData.include_email || formData.include_markdown;
    if (!hasOutput) {
      toast.error('At least one output type must be selected');
      return;
    }

    try {
      setSaving(true);

      if (editingWorkflow) {
        await OrgProposalWorkflowService.updateWorkflow(orgId, editingWorkflow.id, {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          include_goals: formData.include_goals,
          include_sow: formData.include_sow,
          include_html: formData.include_html,
          include_email: formData.include_email,
          include_markdown: formData.include_markdown,
          is_default: formData.is_default,
        });
        toast.success('Workflow updated');
      } else {
        await OrgProposalWorkflowService.createWorkflow(
          orgId,
          {
            name: formData.name.trim(),
            description: formData.description.trim() || undefined,
            include_goals: formData.include_goals,
            include_sow: formData.include_sow,
            include_html: formData.include_html,
            include_email: formData.include_email,
            include_markdown: formData.include_markdown,
            is_default: formData.is_default,
          },
          user?.id
        );
        toast.success('Workflow created');
      }

      closeModal();
      loadWorkflows();
    } catch (error) {
      console.error('Error saving workflow:', error);
      toast.error('Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (workflowId: string) => {
    if (!orgId) return;

    try {
      setDeletingId(workflowId);
      await OrgProposalWorkflowService.deleteWorkflow(orgId, workflowId);
      toast.success('Workflow deleted');
      loadWorkflows();
    } catch (error) {
      console.error('Error deleting workflow:', error);
      toast.error('Failed to delete workflow');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDuplicate = async (workflow: OrgProposalWorkflow) => {
    if (!orgId) return;

    try {
      setSaving(true);
      await OrgProposalWorkflowService.duplicateWorkflow(
        orgId,
        workflow.id,
        `${workflow.name} (Copy)`,
        user?.id
      );
      toast.success('Workflow duplicated');
      loadWorkflows();
    } catch (error) {
      console.error('Error duplicating workflow:', error);
      toast.error('Failed to duplicate workflow');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (workflow: OrgProposalWorkflow) => {
    if (!orgId) return;

    try {
      setSaving(true);
      await OrgProposalWorkflowService.updateWorkflow(orgId, workflow.id, {
        is_default: true,
      });
      toast.success('Default workflow updated');
      loadWorkflows();
    } catch (error) {
      console.error('Error setting default workflow:', error);
      toast.error('Failed to set default workflow');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (workflow: OrgProposalWorkflow) => {
    if (!orgId) return;

    try {
      await OrgProposalWorkflowService.updateWorkflow(orgId, workflow.id, {
        is_active: !workflow.is_active,
      });
      toast.success(workflow.is_active ? 'Workflow deactivated' : 'Workflow activated');
      loadWorkflows();
    } catch (error) {
      console.error('Error toggling workflow:', error);
      toast.error('Failed to update workflow');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Proposal Workflows</h2>
          <p className="text-muted-foreground">
            Create custom workflows for your team's follow-up process
          </p>
        </div>
        {canEdit && (
          <Button onClick={openCreateModal}>
            <Plus className="mr-2 h-4 w-4" />
            Add Workflow
          </Button>
        )}
      </div>

      {workflows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No workflows yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first proposal workflow to get started
            </p>
            {canEdit && (
              <Button onClick={openCreateModal}>
                <Plus className="mr-2 h-4 w-4" />
                Create Workflow
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {workflows.map((workflow) => (
            <Card
              key={workflow.id}
              className={cn(
                'transition-opacity',
                !workflow.is_active && 'opacity-60'
              )}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {workflow.is_default && (
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    )}
                    <h3 className="font-medium">{workflow.name}</h3>
                    {!workflow.is_active && (
                      <Badge variant="secondary" className="text-xs">Inactive</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    {getWorkflowOutputTypes(workflow).map((type, index) => (
                      <React.Fragment key={type}>
                        {index > 0 && <span>+</span>}
                        <span>{type}</span>
                      </React.Fragment>
                    ))}
                  </div>
                  {workflow.description && (
                    <p className="text-sm text-muted-foreground">
                      {workflow.description}
                    </p>
                  )}
                </div>

                {canEdit && (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={workflow.is_active}
                      onCheckedChange={() => handleToggleActive(workflow)}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="z-50">
                        <DropdownMenuItem onClick={() => openEditModal(workflow)}>
                          <Edit2 className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(workflow)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicate
                        </DropdownMenuItem>
                        {!workflow.is_default && (
                          <DropdownMenuItem onClick={() => handleSetDefault(workflow)}>
                            <Star className="mr-2 h-4 w-4" />
                            Set as Default
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleDelete(workflow.id)}
                          className="text-destructive"
                          disabled={deletingId === workflow.id}
                        >
                          {deletingId === workflow.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="mr-2 h-4 w-4" />
                          )}
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingWorkflow ? 'Edit Workflow' : 'Create Proposal Workflow'}
            </DialogTitle>
            <DialogDescription>
              Configure a custom workflow by selecting which output types to include
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Workflow Name</Label>
              <Input
                id="name"
                placeholder="e.g., Quick Follow-up Email"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="e.g., Fast email for post-meeting follow-up"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-3">
              <Label>Output Types</Label>
              <p className="text-sm text-muted-foreground">
                Select which outputs this workflow should generate
              </p>
              <div className="space-y-3">
                {OUTPUT_TYPES.map((type) => {
                  const Icon = type.icon;
                  const isChecked = formData[type.key as keyof WorkflowFormData] as boolean;
                  return (
                    <div
                      key={type.key}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                        isChecked ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                      )}
                      onClick={() => setFormData({ ...formData, [type.key]: !isChecked })}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, [type.key]: checked as boolean })
                        }
                      />
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{type.label}</p>
                        <p className="text-xs text-muted-foreground">{type.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Checkbox
                id="is_default"
                checked={formData.is_default}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_default: checked as boolean })
                }
              />
              <Label htmlFor="is_default" className="cursor-pointer">
                Set as default workflow
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : editingWorkflow ? (
                'Save Changes'
              ) : (
                'Create Workflow'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
