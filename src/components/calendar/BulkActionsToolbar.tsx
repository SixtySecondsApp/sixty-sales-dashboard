import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trash2,
  Calendar,
  Tag,
  X,
  CheckSquare,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CalendarEvent } from '@/pages/Calendar';
import { toast } from 'sonner';

interface BulkActionsToolbarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkDelete: () => Promise<void>;
  onBulkReschedule: (offsetDays: number) => Promise<void>;
  onBulkCategorize: (category: CalendarEvent['category']) => Promise<void>;
}

const categoryOptions = [
  { value: 'meeting', label: 'Meeting' },
  { value: 'call', label: 'Phone Call' },
  { value: 'task', label: 'Task' },
  { value: 'deal', label: 'Deal Activity' },
  { value: 'personal', label: 'Personal' },
  { value: 'follow-up', label: 'Follow-up' },
] as const;

export const BulkActionsToolbar: React.FC<BulkActionsToolbarProps> = ({
  selectedCount,
  onClearSelection,
  onBulkDelete,
  onBulkReschedule,
  onBulkCategorize,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [showCategorizeDialog, setShowCategorizeDialog] = useState(false);
  const [rescheduleOffset, setRescheduleOffset] = useState<string>('1');
  const [newCategory, setNewCategory] = useState<CalendarEvent['category']>('meeting');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleBulkDelete = async () => {
    setIsProcessing(true);
    try {
      await onBulkDelete();
      toast.success(`${selectedCount} event${selectedCount > 1 ? 's' : ''} deleted successfully`);
      setShowDeleteConfirm(false);
    } catch (error) {
      toast.error('Failed to delete events');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkReschedule = async () => {
    setIsProcessing(true);
    try {
      await onBulkReschedule(parseInt(rescheduleOffset));
      toast.success(`${selectedCount} event${selectedCount > 1 ? 's' : ''} rescheduled successfully`);
      setShowRescheduleDialog(false);
    } catch (error) {
      toast.error('Failed to reschedule events');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkCategorize = async () => {
    setIsProcessing(true);
    try {
      await onBulkCategorize(newCategory);
      toast.success(`${selectedCount} event${selectedCount > 1 ? 's' : ''} categorized successfully`);
      setShowCategorizeDialog(false);
    } catch (error) {
      toast.error('Failed to categorize events');
    } finally {
      setIsProcessing(false);
    }
  };

  if (selectedCount === 0) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-gray-900 border border-gray-800 rounded-lg shadow-2xl p-4"
      >
        <div className="flex items-center gap-4">
          {/* Selection Count */}
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-[#37bd7e]" />
            <Badge variant="outline" className="bg-[#37bd7e]/20 text-[#37bd7e] border-[#37bd7e]/30">
              {selectedCount} selected
            </Badge>
          </div>

          <div className="w-px h-6 bg-gray-800" />

          {/* Bulk Actions */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowRescheduleDialog(true)}
              className="border-blue-600/50 text-blue-400 hover:bg-blue-600/10"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Reschedule
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCategorizeDialog(true)}
              className="border-purple-600/50 text-purple-400 hover:bg-purple-600/10"
            >
              <Tag className="w-4 h-4 mr-2" />
              Categorize
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowDeleteConfirm(true)}
              className="border-red-600/50 text-red-400 hover:bg-red-600/10"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>

          <div className="w-px h-6 bg-gray-800" />

          {/* Clear Selection */}
          <Button
            size="sm"
            variant="ghost"
            onClick={onClearSelection}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Delete {selectedCount} Event{selectedCount > 1 ? 's' : ''}?
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. The selected events will be permanently deleted from your calendar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={isProcessing}
              className="bg-red-600 hover:bg-red-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete {selectedCount} Event{selectedCount > 1 ? 's' : ''}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog open={showRescheduleDialog} onOpenChange={setShowRescheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-400" />
              Reschedule {selectedCount} Event{selectedCount > 1 ? 's' : ''}
            </DialogTitle>
            <DialogDescription>
              Move all selected events by a specific number of days.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Move events by:</label>
              <Select value={rescheduleOffset} onValueChange={setRescheduleOffset}>
                <SelectTrigger className="bg-gray-800/50 border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 day forward</SelectItem>
                  <SelectItem value="2">2 days forward</SelectItem>
                  <SelectItem value="3">3 days forward</SelectItem>
                  <SelectItem value="7">1 week forward</SelectItem>
                  <SelectItem value="14">2 weeks forward</SelectItem>
                  <SelectItem value="-1">1 day backward</SelectItem>
                  <SelectItem value="-2">2 days backward</SelectItem>
                  <SelectItem value="-3">3 days backward</SelectItem>
                  <SelectItem value="-7">1 week backward</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRescheduleDialog(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkReschedule}
              disabled={isProcessing}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Rescheduling...
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4 mr-2" />
                  Reschedule Events
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Categorize Dialog */}
      <Dialog open={showCategorizeDialog} onOpenChange={setShowCategorizeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-purple-400" />
              Categorize {selectedCount} Event{selectedCount > 1 ? 's' : ''}
            </DialogTitle>
            <DialogDescription>
              Change the category for all selected events.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">New Category:</label>
              <Select value={newCategory} onValueChange={(val) => setNewCategory(val as CalendarEvent['category'])}>
                <SelectTrigger className="bg-gray-800/50 border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCategorizeDialog(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkCategorize}
              disabled={isProcessing}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Categorizing...
                </>
              ) : (
                <>
                  <Tag className="w-4 h-4 mr-2" />
                  Categorize Events
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
