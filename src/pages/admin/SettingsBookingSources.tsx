import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, Save, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase/clientV2';
import { useUser } from '@/lib/hooks/useUser';
import logger from '@/lib/utils/logger';

type BookingSource = {
  id: string;
  name: string;
  api_name: string;
  description: string | null;
  category: string | null;
  icon: string | null;
  color: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type EditingSource = {
  id: string | null;
  name: string;
  api_name: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  is_active: boolean;
  sort_order: number;
};

const CATEGORIES = [
  { value: 'paid', label: 'Paid Advertising' },
  { value: 'organic', label: 'Organic' },
  { value: 'referral', label: 'Referral' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'outbound', label: 'Outbound' },
  { value: 'other', label: 'Other' },
];

export default function SettingsBookingSources() {
  const { userData: user } = useUser();
  const [sources, setSources] = useState<BookingSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingSource, setEditingSource] = useState<EditingSource>({
    id: null,
    name: '',
    api_name: '',
    description: '',
    category: 'other',
    icon: '',
    color: '#9E9E9E',
    is_active: true,
    sort_order: 0,
  });

  // Generate API name from display name
  const generateApiName = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('booking_sources')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setSources(data || []);
    } catch (error) {
      logger.error('Error fetching booking sources:', error);
      toast.error('Failed to load booking sources');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (source: BookingSource) => {
    setEditingSource({
      id: source.id,
      name: source.name,
      api_name: source.api_name,
      description: source.description || '',
      category: source.category || 'other',
      icon: source.icon || '',
      color: source.color || '#9E9E9E',
      is_active: source.is_active,
      sort_order: source.sort_order,
    });
    setIsEditing(true);
  };

  const handleAddNew = () => {
    setEditingSource({
      id: null,
      name: '',
      api_name: '',
      description: '',
      category: 'other',
      icon: '',
      color: '#9E9E9E',
      is_active: true,
      sort_order: 0,
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingSource({
      id: null,
      name: '',
      api_name: '',
      description: '',
      category: 'other',
      icon: '',
      color: '#9E9E9E',
      is_active: true,
      sort_order: 0,
    });
  };

  const handleSave = async () => {
    if (!editingSource.name.trim()) {
      toast.error('Name is required');
      return;
    }

    if (!editingSource.api_name.trim()) {
      toast.error('API name is required');
      return;
    }

    // Validate API name format (lowercase, underscores only)
    const apiNamePattern = /^[a-z0-9_]+$/;
    if (!apiNamePattern.test(editingSource.api_name)) {
      toast.error('API name must be lowercase with underscores only (e.g., "facebook_ads")');
      return;
    }

    try {
      if (editingSource.id) {
        // Update existing
        const { error } = await supabase
          .from('booking_sources')
          .update({
            name: editingSource.name.trim(),
            api_name: editingSource.api_name.trim(),
            description: editingSource.description.trim() || null,
            category: editingSource.category || null,
            icon: editingSource.icon.trim() || null,
            color: editingSource.color.trim() || null,
            is_active: editingSource.is_active,
            sort_order: editingSource.sort_order,
          })
          .eq('id', editingSource.id);

        if (error) throw error;
        toast.success('Booking source updated');
      } else {
        // Create new
        const { error } = await supabase
          .from('booking_sources')
          .insert({
            name: editingSource.name.trim(),
            api_name: editingSource.api_name.trim(),
            description: editingSource.description.trim() || null,
            category: editingSource.category || null,
            icon: editingSource.icon.trim() || null,
            color: editingSource.color.trim() || null,
            is_active: editingSource.is_active,
            sort_order: editingSource.sort_order,
          });

        if (error) {
          if (error.code === '23505') {
            if (error.message.includes('api_name')) {
              toast.error('A source with this API name already exists');
            } else {
              toast.error('A source with this name already exists');
            }
          } else {
            throw error;
          }
          return;
        }
        toast.success('Booking source created');
      }

      setIsEditing(false);
      setEditingSource({
        id: null,
        name: '',
        api_name: '',
        description: '',
        category: 'other',
        icon: '',
        color: '#9E9E9E',
        is_active: true,
        sort_order: 0,
      });
      fetchSources();
    } catch (error: any) {
      logger.error('Error saving booking source:', error);
      toast.error(error.message || 'Failed to save booking source');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this booking source? This will set source_id to null for any mappings using it.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('booking_sources')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Booking source deleted');
      fetchSources();
    } catch (error) {
      logger.error('Error deleting booking source:', error);
      toast.error('Failed to delete booking source');
    }
  };

  const handleToggleActive = async (source: BookingSource) => {
    try {
      const { error } = await supabase
        .from('booking_sources')
        .update({ is_active: !source.is_active })
        .eq('id', source.id);

      if (error) throw error;
      toast.success(`Source ${!source.is_active ? 'activated' : 'deactivated'}`);
      fetchSources();
    } catch (error) {
      logger.error('Error toggling source active status:', error);
      toast.error('Failed to update source');
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#37bd7e]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Booking Sources</CardTitle>
              <CardDescription>
                Manage predefined booking sources for SavvyCal link mappings. These sources appear in the dropdown when mapping links.
              </CardDescription>
            </div>
            <Button onClick={handleAddNew} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Source
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isEditing && (
            <div className="mb-6 p-4 border rounded-lg bg-gray-50 dark:bg-gray-900/50">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name *</label>
                  <Input
                    value={editingSource.name}
                    onChange={(e) => {
                      const newName = e.target.value;
                      // Auto-generate API name only for new sources (when id is null)
                      // For existing sources, keep api_name stable
                      const shouldAutoGenerate = !editingSource.id && (!editingSource.api_name || editingSource.api_name === generateApiName(editingSource.name));
                      setEditingSource({
                        ...editingSource,
                        name: newName,
                        api_name: shouldAutoGenerate ? generateApiName(newName) : editingSource.api_name,
                      });
                    }}
                    placeholder="e.g., Facebook Ads, LinkedIn Ads"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    API Name * 
                    <span className="text-xs text-gray-500 ml-2">(for programmatic access)</span>
                  </label>
                  <Input
                    value={editingSource.api_name}
                    onChange={(e) =>
                      setEditingSource({ ...editingSource, api_name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })
                    }
                    placeholder="e.g., facebook_ads, linkedin_ads"
                    className="font-mono"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Lowercase with underscores only. Used in API calls instead of display name.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <Textarea
                    value={editingSource.description}
                    onChange={(e) =>
                      setEditingSource({ ...editingSource, description: e.target.value })
                    }
                    placeholder="Brief description of this source"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Category</label>
                    <Select
                      value={editingSource.category}
                      onValueChange={(value) =>
                        setEditingSource({ ...editingSource, category: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Sort Order</label>
                    <Input
                      type="number"
                      value={editingSource.sort_order}
                      onChange={(e) =>
                        setEditingSource({ ...editingSource, sort_order: parseInt(e.target.value) || 0 })
                      }
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Icon (Emoji)</label>
                    <Input
                      value={editingSource.icon}
                      onChange={(e) =>
                        setEditingSource({ ...editingSource, icon: e.target.value })
                      }
                      placeholder="📘, 💼, 🔍"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Color (Hex)</label>
                    <Input
                      value={editingSource.color}
                      onChange={(e) =>
                        setEditingSource({ ...editingSource, color: e.target.value })
                      }
                      placeholder="#1877F2"
                      className="font-mono"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={editingSource.is_active}
                    onChange={(e) =>
                      setEditingSource({ ...editingSource, is_active: e.target.checked })
                    }
                    className="rounded"
                  />
                  <label htmlFor="is_active" className="text-sm font-medium">
                    Active (visible in dropdown)
                  </label>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSave} size="sm">
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                  <Button onClick={handleCancel} variant="outline" size="sm">
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          {sources.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No booking sources found. Click "Add Source" to create one.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>API Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Icon</TableHead>
                    <TableHead>Sort Order</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sources.map((source) => (
                    <TableRow key={source.id}>
                      <TableCell className="font-medium">
                        <div>
                          <div className="flex items-center gap-2">
                            {source.icon && <span>{source.icon}</span>}
                            <span>{source.name}</span>
                          </div>
                          {source.description && (
                            <div className="text-xs text-gray-500 mt-1">
                              {source.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 font-mono">
                          {source.api_name}
                        </code>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">
                          {source.category || 'other'}
                        </span>
                      </TableCell>
                      <TableCell>{source.icon || '-'}</TableCell>
                      <TableCell>{source.sort_order}</TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleToggleActive(source)}
                          className={`text-xs px-2 py-1 rounded ${
                            source.is_active
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                          }`}
                        >
                          {source.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(source)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(source.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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
    </div>
  );
}

