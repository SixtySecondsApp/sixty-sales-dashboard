import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

// Get the type definition from the hook
import type { OriginalActivity } from '@/lib/hooks/useOriginalActivities';
import logger from '@/lib/utils/logger';

interface EditActivityEmailModalProps {
  activity: OriginalActivity | null; // The activity to edit
  isOpen: boolean;
  onClose: () => void;
  onSave: (activityId: string, email: string) => Promise<boolean>; // Function to call on save
}

export function EditActivityEmailModal({
  activity,
  isOpen,
  onClose,
  onSave
}: EditActivityEmailModalProps) {
  const [email, setEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill email when activity changes
  useEffect(() => {
    if (activity) {
      setEmail(activity.contact_identifier || '');
      setError(null); // Clear errors when activity changes
    } else {
      setEmail(''); // Reset if no activity
    }
  }, [activity]);

  const handleSave = async () => {
    if (!activity || !email) {
      setError("Please enter a valid email address.");
      return;
    }
    // Basic email validation (can be enhanced)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
       setError("Invalid email format.");
       return;
    }

    setIsSaving(true);
    try {
      const success = await onSave(activity.id, email);
      if (success) {
        toast.success(`Email updated for ${activity.client_name || 'activity'}.`);
        onClose(); // Close modal on successful save
      } else {
        // Error handled by onSave (toast shown there)
        setError("Failed to save email. See console for details."); // Optional fallback error
      }
    } catch (err) {
      logger.error("Error in handleSave:", err);
      setError("An unexpected error occurred while saving.");
      toast.error("An unexpected error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle modal state change (e.g., closing via overlay click)
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
    // We don't control opening from here, only closing
  };

  if (!activity) return null; // Don't render if no activity is selected

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-gray-900/95 backdrop-blur-xl border-gray-800/50 text-white p-6 rounded-xl sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-white">Edit Contact Email</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <p className="text-sm text-gray-400">
            Update the email address for activity related to client: <span className="font-medium text-gray-300">{activity.client_name}</span> (Type: {activity.type}).
          </p>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="email" className="text-right text-gray-400">
              Email
            </Label>
            <Input
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="col-span-3 bg-gray-800/50 border-gray-700/50 focus:ring-offset-0 focus:ring-1 focus:ring-cyan-500 text-white rounded-md"
            />
          </div>
          {error && <p className="text-red-500 text-sm text-center col-span-4">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={onClose}
            className="bg-gray-800/50 text-gray-300 hover:bg-gray-800"
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-cyan-600 hover:bg-cyan-700 text-white"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              'Save changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 