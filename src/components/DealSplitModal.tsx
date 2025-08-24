import React, { useState, useEffect, useMemo } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Users, 
  Plus, 
  Trash2, 
  PieChart, 
  DollarSign,
  Edit,
  Save,
  X
} from 'lucide-react';
import { useDealSplits } from '@/lib/hooks/useDealSplits';
import { useUsers } from '@/lib/hooks/useUsers';
import { useUser } from '@/lib/hooks/useUser';
import { Deal, DealSplitWithUser } from '@/lib/database/models';
import { toast } from 'sonner';

interface DealSplitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: Deal;
}

interface NewSplit {
  userId: string;
  percentage: number;
  notes: string;
}

export default function DealSplitModal({ open, onOpenChange, deal }: DealSplitModalProps) {
  const [newSplit, setNewSplit] = useState<NewSplit>({
    userId: '',
    percentage: 0,
    notes: ''
  });
  const [editingSplit, setEditingSplit] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ percentage: number; notes: string }>({
    percentage: 0,
    notes: ''
  });

  const { users } = useUsers();
  const { userData } = useUser();
  const { 
    splits, 
    isLoading, 
    createSplit, 
    updateSplit, 
    deleteSplit,
    calculateSplitTotals,
    canSplitDeal
  } = useDealSplits({ dealId: deal.id });

  // Calculate split totals for this deal
  const splitTotals = useMemo(() => {
    return calculateSplitTotals(deal.id);
  }, [calculateSplitTotals, deal.id]);

  // Available users (excluding those already in splits)
  const availableUsers = useMemo(() => {
    const usedUserIds = splits.map(split => split.user_id);
    return users.filter(user => !usedUserIds.includes(user.id) && user.id !== deal.owner_id);
  }, [users, splits, deal.owner_id]);

  const handleCreateSplit = async () => {
    if (!newSplit.userId || newSplit.percentage <= 0) {
      toast.error('Please select a user and enter a valid percentage');
      return;
    }

    try {
      await createSplit({
        deal_id: deal.id,
        user_id: newSplit.userId,
        percentage: newSplit.percentage,
        notes: newSplit.notes || undefined
      });

      // Reset form
      setNewSplit({
        userId: '',
        percentage: 0,
        notes: ''
      });
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleEditSplit = (split: DealSplitWithUser) => {
    setEditingSplit(split.id);
    setEditValues({
      percentage: split.percentage,
      notes: split.notes || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingSplit) return;

    try {
      await updateSplit(editingSplit, {
        percentage: editValues.percentage,
        notes: editValues.notes || undefined
      });

      setEditingSplit(null);
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleCancelEdit = () => {
    setEditingSplit(null);
    setEditValues({ percentage: 0, notes: '' });
  };

  const handleDeleteSplit = async (splitId: string) => {
    // Only allow admins to delete splits
    if (!userData?.is_admin) {
      toast.error('Only administrators can remove deal splits');
      return;
    }
    
    if (window.confirm('Are you sure you want to remove this split?')) {
      await deleteSplit(splitId);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getUserInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '?';
  };

  const maxNewPercentage = Math.min(100 - splitTotals.totalPercentage, 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-950 border border-gray-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-white">
            <PieChart className="w-5 h-5 text-blue-500" />
            Split Deal: {deal.name}
          </DialogTitle>
          <div className="text-sm text-gray-400">
            Deal Value: {formatCurrency(deal.value)} • Owner: You
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Split Summary */}
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-200">
                <DollarSign className="w-4 h-4" />
                Split Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-400">
                    {splitTotals.totalPercentage}%
                  </div>
                  <div className="text-xs text-gray-400">Allocated</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-400">
                    {formatCurrency(splitTotals.totalAmount)}
                  </div>
                  <div className="text-xs text-gray-400">Split Amount</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-400">
                    {splitTotals.remainingPercentage}%
                  </div>
                  <div className="text-xs text-gray-400">Remaining</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Splits */}
          {splits.length > 0 && (
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-gray-200">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Current Splits ({splits.length})
                  </div>
                  {!userData?.is_admin && (
                    <span className="text-xs text-gray-500 font-normal">
                      Only admins can remove splits
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {splits.map((split) => (
                    <div 
                      key={split.id}
                      className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="bg-blue-600 text-white text-xs">
                            {getUserInitials(split.first_name, split.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-medium text-white">
                            {split.full_name || `${split.first_name} ${split.last_name}`.trim()}
                          </div>
                          <div className="text-xs text-gray-400">{split.email}</div>
                        </div>
                      </div>

                      {editingSplit === split.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={editValues.percentage}
                            onChange={(e) => setEditValues({
                              ...editValues,
                              percentage: parseFloat(e.target.value) || 0
                            })}
                            className="w-20 h-8 text-xs"
                            min="0"
                            max="100"
                            step="0.1"
                          />
                          <span className="text-xs text-gray-400">%</span>
                          <Button
                            size="sm"
                            onClick={handleSaveEdit}
                            className="h-8 w-8 p-0 bg-green-600 hover:bg-green-700"
                          >
                            <Save className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleCancelEdit}
                            className="h-8 w-8 p-0 hover:bg-gray-700"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <Badge variant="outline" className="text-blue-400 border-blue-400">
                              {split.percentage}%
                            </Badge>
                            <div className="text-xs text-gray-400 mt-1">
                              {formatCurrency(split.amount)}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditSplit(split)}
                            className="h-8 w-8 p-0 hover:bg-gray-700"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          {userData?.is_admin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteSplit(split.id)}
                              className="h-8 w-8 p-0 hover:bg-red-900 text-red-400"
                              title="Admin only: Remove split"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Add New Split */}
          {canSplitDeal(deal.id) && availableUsers.length > 0 && (
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-200">
                  <Plus className="w-4 h-4" />
                  Add Split
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="user" className="text-gray-300">Team Member</Label>
                    <Select 
                      value={newSplit.userId} 
                      onValueChange={(value) => setNewSplit({ ...newSplit, userId: value })}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                        <SelectValue placeholder="Select team member" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        {availableUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id} className="text-white">
                            {user.first_name} {user.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="percentage" className="text-gray-300">
                      Percentage (Max: {maxNewPercentage}%)
                    </Label>
                    <Input
                      id="percentage"
                      type="number"
                      value={newSplit.percentage || ''}
                      onChange={(e) => setNewSplit({ 
                        ...newSplit, 
                        percentage: parseFloat(e.target.value) || 0 
                      })}
                      className="bg-gray-800 border-gray-700 text-white"
                      placeholder="Enter percentage"
                      min="0"
                      max={maxNewPercentage}
                      step="0.1"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="notes" className="text-gray-300">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={newSplit.notes}
                    onChange={(e) => setNewSplit({ ...newSplit, notes: e.target.value })}
                    className="bg-gray-800 border-gray-700 text-white"
                    placeholder="Add any notes about this split..."
                    rows={2}
                  />
                </div>

                {newSplit.percentage > 0 && (
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <div className="text-sm text-blue-400">
                      Split Amount: {formatCurrency(deal.value * (newSplit.percentage / 100))}
                    </div>
                  </div>
                )}

                <Button 
                  onClick={handleCreateSplit}
                  disabled={!newSplit.userId || newSplit.percentage <= 0 || newSplit.percentage > maxNewPercentage}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Split
                </Button>
              </CardContent>
            </Card>
          )}

          {/* No more splits available */}
          {!canSplitDeal(deal.id) && (
            <Card className="bg-amber-500/10 border-amber-500/20">
              <CardContent className="p-4">
                <div className="text-amber-400 text-sm">
                  This deal is fully allocated (100%). Remove existing splits to add new ones.
                </div>
              </CardContent>
            </Card>
          )}

          {/* No available users */}
          {canSplitDeal(deal.id) && availableUsers.length === 0 && (
            <Card className="bg-gray-500/10 border-gray-500/20">
              <CardContent className="p-4">
                <div className="text-gray-400 text-sm">
                  All available team members already have splits on this deal.
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 