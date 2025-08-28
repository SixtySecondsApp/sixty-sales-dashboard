import React, { useState } from 'react';
import { 
  Users, 
  CheckCircle, 
  PauseCircle, 
  XCircle, 
  AlertCircle, 
  UserCheck, 
  DollarSign,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ClientStatus } from '@/lib/hooks/useClients';

interface ClientStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  currentStatus: ClientStatus;
  onSave: (status: ClientStatus, additionalData?: {
    noticeDate?: string;
    finalBillingDate?: string;
    churnReason?: string;
  }) => void;
}

export function ClientStatusModal({
  isOpen,
  onClose,
  clientName,
  currentStatus,
  onSave
}: ClientStatusModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<ClientStatus>(currentStatus);
  const [noticeDate, setNoticeDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [finalBillingDate, setFinalBillingDate] = useState<string>('');
  const [churnReason, setChurnReason] = useState<string>('');

  const statuses: { value: ClientStatus; label: string; icon: any; color: string; description: string }[] = [
    {
      value: 'signed',
      label: 'Signed',
      icon: UserCheck,
      color: 'border-blue-500/50 bg-blue-500/10 text-blue-400',
      description: 'Contract signed, awaiting setup'
    },
    {
      value: 'deposit_paid',
      label: 'Deposit Paid',
      icon: DollarSign,
      color: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400',
      description: 'Initial payment received'
    },
    {
      value: 'active',
      label: 'Active',
      icon: CheckCircle,
      color: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400',
      description: 'One-off payment received, service active'
    },
    {
      value: 'subscribed',
      label: 'Subscribed',
      icon: CheckCircle,
      color: 'border-green-500/50 bg-green-500/10 text-green-400',
      description: 'Monthly subscription active and billing'
    },
    {
      value: 'paused',
      label: 'Paused',
      icon: PauseCircle,
      color: 'border-orange-500/50 bg-orange-500/10 text-orange-400',
      description: 'Temporarily paused, not billing'
    },
    {
      value: 'notice_given',
      label: 'Notice Given',
      icon: AlertCircle,
      color: 'border-red-500/50 bg-red-500/10 text-red-400',
      description: 'Client gave notice, awaiting final billing'
    },
    {
      value: 'churned',
      label: 'Churned',
      icon: XCircle,
      color: 'border-gray-500/50 bg-gray-500/10 text-gray-400',
      description: 'Subscription ended, no longer billing'
    }
  ];

  const needsChurnDates = selectedStatus === 'notice_given' || selectedStatus === 'churned';

  const handleSave = () => {
    const additionalData = needsChurnDates ? {
      noticeDate: noticeDate,
      finalBillingDate: finalBillingDate,
      churnReason: churnReason || undefined
    } : undefined;
    
    onSave(selectedStatus, additionalData);
  };

  const calculateFinalBillingDate = (noticeDateStr: string) => {
    if (!noticeDateStr) return '';
    
    const notice = new Date(noticeDateStr);
    // Add 30 days for notice period (adjust based on your contract terms)
    notice.setDate(notice.getDate() + 30);
    return notice.toISOString().split('T')[0];
  };

  const handleNoticeDateChange = (dateStr: string) => {
    setNoticeDate(dateStr);
    if (dateStr && !finalBillingDate) {
      setFinalBillingDate(calculateFinalBillingDate(dateStr));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-gray-900/95 backdrop-blur-xl border-gray-800/50 text-white p-6 rounded-xl max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            Manage Client Status
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-400">
            Update status for: <span className="text-white font-medium">{clientName}</span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Status Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-300">Client Status</label>
            <div className="grid grid-cols-2 gap-3">
              {statuses.map((status) => {
                const isSelected = selectedStatus === status.value;
                const Icon = status.icon;
                
                return (
                  <button
                    key={status.value}
                    onClick={() => setSelectedStatus(status.value)}
                    className={cn(
                      "p-4 rounded-lg border-2 transition-colors text-left",
                      isSelected 
                        ? status.color 
                        : 'border-gray-700/50 bg-gray-800/50 text-gray-400 hover:border-gray-600/50'
                    )}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{status.label}</span>
                    </div>
                    <p className="text-xs opacity-80">{status.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Churn Tracking Fields */}
          {needsChurnDates && (
            <div className="space-y-4 p-4 bg-gray-800/30 rounded-lg border border-gray-700/30">
              <div className="flex items-center gap-2 text-sm font-medium text-yellow-400">
                <Calendar className="w-4 h-4" />
                Churn Tracking Information
              </div>
              
              {/* Notice Date */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">
                  Notice Given Date *
                </label>
                <input
                  type="date"
                  value={noticeDate}
                  onChange={(e) => handleNoticeDateChange(e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Final Billing Date */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">
                  Final Billing Date *
                </label>
                <input
                  type="date"
                  value={finalBillingDate}
                  onChange={(e) => setFinalBillingDate(e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  required
                />
                <p className="text-xs text-gray-400">
                  When the subscription will stop billing
                </p>
              </div>

              {/* Churn Reason */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">
                  Churn Reason (Optional)
                </label>
                <textarea
                  value={churnReason}
                  onChange={(e) => setChurnReason(e.target.value)}
                  placeholder="e.g., Budget constraints, switching providers, business closure..."
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  rows={3}
                />
              </div>
            </div>
          )}
          
          {/* Current Status Display */}
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="text-sm text-gray-300">Current Status</div>
            <div className="text-lg font-medium capitalize text-white">
              {currentStatus.replace('_', ' ')}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSave}
              disabled={needsChurnDates && (!noticeDate || !finalBillingDate)}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Update Status
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              className="bg-gray-800/50 border-gray-700/50 text-white hover:bg-gray-700/50"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}