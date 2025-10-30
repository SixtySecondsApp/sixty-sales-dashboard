import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, Save, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Slider } from '@/components/ui/slider';
import { supabaseAdmin } from '@/lib/supabase/clientV2';
import logger from '@/lib/utils/logger';

type DealStage = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  order_position: number;
  default_probability: number;
  created_at: string;
  updated_at: string;
};

type EditingStage = {
  id: string | null;
  name: string;
  description: string;
  color: string;
  order_position: number;
  default_probability: number;
};

export default function PipelineSettings() {
  const [stages, setStages] = useState<DealStage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingStage, setEditingStage] = useState<EditingStage>({
    id: null,
    name: '',
    description: '',
    color: '#3B82F6',
    order_position: 10,
    default_probability: 50,
  });

  useEffect(() => {
    fetchStages();
  }, []);

  const fetchStages = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await (supabaseAdmin as any)
        .from('deal_stages')
        .select('*')
        .order('order_position');

      if (error) throw error;
      setStages(data || []);
    } catch (error) {
      logger.error('Error fetching pipeline stages:', error);
      toast.error('Failed to load pipeline stages');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (stage: DealStage) => {
    setEditingStage({
      id: stage.id,
      name: stage.name,
      description: stage.description || '',
      color: stage.color,
      order_position: stage.order_position,
      default_probability: stage.default_probability,
    });
    setIsEditing(true);
  };

  const handleAddNew = () => {
    // Find highest order position and add 10
    const maxPosition = stages.length > 0 
      ? Math.max(...stages.map(s => s.order_position)) 
      : 0;
    
    setEditingStage({
      id: null,
      name: '',
      description: '',
      color: '#3B82F6',
      order_position: maxPosition + 10,
      default_probability: 50,
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingStage({
      id: null,
      name: '',
      description: '',
      color: '#3B82F6',
      order_position: 10,
      default_probability: 50,
    });
  };

  const handleSave = async () => {
    if (!editingStage.name) {
      toast.error('Stage name is required');
      return;
    }

    try {
      if (editingStage.id) {
        // Update existing stage
        const { error } = await (supabaseAdmin as any)
          .from('deal_stages')
          .update({
            name: editingStage.name,
            description: editingStage.description || null,
            color: editingStage.color,
            order_position: editingStage.order_position,
            default_probability: editingStage.default_probability,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingStage.id);

        if (error) throw error;
        toast.success('Pipeline stage updated successfully');
      } else {
        // Create new stage
        const { error } = await (supabaseAdmin as any)
          .from('deal_stages')
          .insert({
            name: editingStage.name,
            description: editingStage.description || null,
            color: editingStage.color,
            order_position: editingStage.order_position,
            default_probability: editingStage.default_probability,
          });

        if (error) throw error;
        toast.success('Pipeline stage created successfully');
      }

      fetchStages();
      setIsEditing(false);
      setEditingStage({
        id: null,
        name: '',
        description: '',
        color: '#3B82F6',
        order_position: 10,
        default_probability: 50,
      });
    } catch (error) {
      logger.error('Error saving pipeline stage:', error);
      toast.error('Failed to save pipeline stage');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this pipeline stage? This cannot be undone.')) {
      return;
    }

    try {
      const { error } = await (supabaseAdmin as any)
        .from('deal_stages')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Pipeline stage deleted successfully');
      fetchStages();
    } catch (error) {
      logger.error('Error deleting pipeline stage:', error);
      toast.error('Failed to delete pipeline stage. It may be in use by existing deals.');
    }
  };

  const handleProbabilityChange = async (id: string, value: number) => {
    try {
      const { error } = await (supabaseAdmin as any)
        .from('deal_stages')
        .update({
          default_probability: value,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      
      setStages(stages.map(stage => 
        stage.id === id ? { ...stage, default_probability: value } : stage
      ));
      
      toast.success('Probability updated');
    } catch (error) {
      logger.error('Error updating probability:', error);
      toast.error('Failed to update probability');
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 p-6">
      <div className="container mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Pipeline Settings</h1>
        {!isEditing && (
          <Button onClick={handleAddNew}>
            <Plus className="mr-2 h-4 w-4" />
            Add Stage
          </Button>
        )}
      </div>

      {isEditing ? (
        <Card>
          <CardHeader>
            <CardTitle>{editingStage.id ? 'Edit' : 'Add'} Pipeline Stage</CardTitle>
            <CardDescription>
              Configure stage details and win probability
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                  <Input
                    value={editingStage.name}
                    onChange={(e) => setEditingStage({ ...editingStage, name: e.target.value })}
                    placeholder="e.g., Qualified Lead"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Color</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      value={editingStage.color}
                      onChange={(e) => setEditingStage({ ...editingStage, color: e.target.value })}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={editingStage.color}
                      onChange={(e) => setEditingStage({ ...editingStage, color: e.target.value })}
                      placeholder="#HEX"
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>


              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <Input
                  value={editingStage.description}
                  onChange={(e) => setEditingStage({ ...editingStage, description: e.target.value })}
                  placeholder="Describe this pipeline stage"
                />
              </div>


              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Position (Order)</label>
                  <Input
                    type="number"
                    value={editingStage.order_position}
                    onChange={(e) => setEditingStage({ ...editingStage, order_position: parseInt(e.target.value) || 0 })}
                    min={0}
                    step={10}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Default Win Probability: {editingStage.default_probability}%</label>
                  <Slider
                    value={[editingStage.default_probability]}
                    min={0}
                    max={100}
                    step={5}
                    onValueChange={(value) => setEditingStage({ ...editingStage, default_probability: value[0] })}
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={handleCancel}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Pipeline Stages</CardTitle>
            <CardDescription>
              Manage your sales pipeline stages and configure win probability for each stage
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4 text-gray-700 dark:text-gray-400">Loading stages...</div>
            ) : stages.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-700 dark:text-gray-400 mb-4">No pipeline stages defined yet</p>
                <Button onClick={handleAddNew}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Stage
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Win Probability</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stages.map((stage) => (
                    <TableRow key={stage.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: stage.color }}
                          ></div>
                          {stage.name}
                        </div>
                      </TableCell>
                      <TableCell>{stage.color}</TableCell>
                      <TableCell>{stage.order_position}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Slider
                            value={[stage.default_probability]}
                            min={0}
                            max={100}
                            step={5}
                            onValueChange={(value) => handleProbabilityChange(stage.id, value[0])}
                            className="w-32"
                          />
                          <span className="text-sm">{stage.default_probability}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(stage)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(stage.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        )}
      </div>
    </div>
  );
} 