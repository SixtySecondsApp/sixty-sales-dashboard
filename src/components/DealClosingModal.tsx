import React, { useState, useEffect } from 'react';
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
import { Card, CardContent } from '@/components/ui/card';
import { 
  Trophy, 
  Calendar, 
  DollarSign,
  Building2,
  User,
  Sparkles
} from 'lucide-react';
import { Deal } from '@/lib/database/models';
import { toast } from 'sonner';
import { format, addDays, addWeeks, addMonths } from 'date-fns';

interface DealClosingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: Deal;
  onSave: (firstBillingDate: string | null) => Promise<void>;
}

export default function DealClosingModal({ 
  open, 
  onOpenChange, 
  deal, 
  onSave 
}: DealClosingModalProps) {
  const [firstBillingDate, setFirstBillingDate] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      // Default to next month start date
      const nextMonth = new Date();
      nextMonth.setDate(1);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      setFirstBillingDate(format(nextMonth, 'yyyy-MM-dd'));
    }
  }, [open]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      // Validate date if provided
      let processedDate = null;
      if (firstBillingDate && firstBillingDate.trim() !== '') {
        try {
          const dateObj = new Date(firstBillingDate);
          if (isNaN(dateObj.getTime())) {
            throw new Error('Invalid date format');
          }
          processedDate = firstBillingDate;
        } catch (dateError) {
          toast.error('Please enter a valid first billing date');
          return;
        }
      }
      
      await onSave(processedDate);
      onOpenChange(false);
      
    } catch (error) {
      console.error('Error saving deal closure:', error);
      toast.error('Failed to close deal. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = async () => {
    try {
      setIsSaving(true);
      await onSave(null);
      onOpenChange(false);
    } catch (error) {
      console.error('Error closing deal:', error);
      toast.error('Failed to close deal. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Quick date options
  const getQuickDateOptions = () => {
    const now = new Date();
    return [
      {
        label: 'Next Month Start',
        value: (() => {
          const date = new Date(now);
          date.setDate(1);
          date.setMonth(date.getMonth() + 1);
          return format(date, 'yyyy-MM-dd');
        })(),
        description: 'First day of next month'
      },
      {
        label: 'In 2 Weeks',
        value: format(addWeeks(now, 2), 'yyyy-MM-dd'),
        description: '14 days from now'
      },
      {
        label: 'End of Month',
        value: format(addDays(addMonths(now, 1), -1), 'yyyy-MM-dd'),
        description: 'Last day of this month'
      }
    ];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-gray-950 border border-gray-800">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
                Deal Signed! 
                <Sparkles className="w-5 h-5 text-yellow-400" />
              </DialogTitle>
              <p className="text-gray-400 text-sm mt-1">
                Congratulations on getting this deal signed!
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Deal Summary */}
          <Card className="bg-gradient-to-r from-emerald-500/10 to-green-500/10 border-emerald-500/20">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-gray-300">
                    <Building2 className="w-4 h-4 text-emerald-400" />
                    <span className="font-medium">{deal.company || deal.name}</span>
                  </div>
                  {deal.contact_name && (
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                      <User className="w-3.5 h-3.5" />
                      <span>{deal.contact_name}</span>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="flex items-center justify-end gap-2 text-emerald-400">
                    <DollarSign className="w-5 h-5" />
                    <span className="text-2xl font-bold">
                      {formatCurrency(deal.value)}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm">Deal Value</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Billing Date Section */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="firstBillingDate" className="text-gray-300 font-medium">
                When should billing begin for this deal?
              </Label>
              <p className="text-gray-500 text-sm mt-1">
                Set the date when invoicing should start (optional)
              </p>
            </div>

            {/* Quick Date Options */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {getQuickDateOptions().map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setFirstBillingDate(option.value)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    firstBillingDate === option.value
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : 'bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-700/50'
                  }`}
                >
                  <div className="font-medium text-sm">{option.label}</div>
                  <div className="text-xs text-gray-400 mt-1">{option.description}</div>
                </button>
              ))}
            </div>

            {/* Custom Date Input */}
            <div className="space-y-2">
              <Label htmlFor="customDate" className="text-gray-400 text-sm">
                Or choose a custom date:
              </Label>
              <div className="flex items-center border border-gray-700 rounded-lg bg-gray-800/50 focus-within:border-emerald-500/50 transition-colors">
                <Calendar className="w-5 h-5 text-gray-500 ml-3" />
                <Input
                  id="customDate"
                  type="date"
                  value={firstBillingDate}
                  onChange={(e) => setFirstBillingDate(e.target.value)}
                  className="border-none bg-transparent text-white focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
            </div>

            {firstBillingDate && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="text-sm text-blue-400">
                  📅 Billing will begin on {format(new Date(firstBillingDate), 'EEEE, MMMM d, yyyy')}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button
            variant="outline"
            onClick={handleSkip}
            disabled={isSaving}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            Skip for Now
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isSaving ? 'Closing Deal...' : 'Complete Deal Closure'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 