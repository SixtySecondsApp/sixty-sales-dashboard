/**
 * HistoricalUpgradeGate - Upgrade prompt for historical meeting access
 * 
 * Shown when free tier users try to:
 * 1. Sync meetings older than 30 days
 * 2. Access historical meeting imports beyond their limit
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  Sparkles,
  Zap,
  Calendar,
  TrendingUp,
  ArrowRight,
  X,
} from 'lucide-react';

interface HistoricalUpgradeGateProps {
  isOpen: boolean;
  onClose: () => void;
  requestedDate?: Date;
  meetingsUsed?: number;
  meetingsLimit?: number;
  type?: 'historical_date' | 'meeting_limit';
}

export function HistoricalUpgradeGate({
  isOpen,
  onClose,
  requestedDate,
  meetingsUsed = 0,
  meetingsLimit = 15,
  type = 'historical_date',
}: HistoricalUpgradeGateProps) {
  const navigate = useNavigate();
  const [isNavigating, setIsNavigating] = useState(false);

  const handleViewPlans = () => {
    setIsNavigating(true);
    onClose();
    navigate('/pricing');
  };

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-gray-900 border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-400" />
            Unlock Your Full Meeting History
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {type === 'historical_date'
              ? 'Free accounts can sync meetings from the last 30 days.'
              : `You've used ${meetingsUsed} of ${meetingsLimit} meetings on your free plan.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Current Limit Info */}
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            {type === 'historical_date' && requestedDate && (
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Calendar className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    You're trying to access meetings from
                  </p>
                  <p className="text-lg font-bold text-amber-400">
                    {format(requestedDate, 'MMMM d, yyyy')}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Free tier limit: {format(thirtyDaysAgo, 'MMMM d, yyyy')} and newer
                  </p>
                </div>
              </div>
            )}

            {type === 'meeting_limit' && (
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <TrendingUp className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    Meeting Limit Reached
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-red-500 to-red-400 transition-all"
                        style={{ width: '100%' }}
                      />
                    </div>
                    <span className="text-sm font-medium text-red-400">
                      {meetingsUsed}/{meetingsLimit}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Upgrade to sync unlimited meetings
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Upgrade Benefits */}
          <div className="bg-gradient-to-r from-emerald-500/10 to-purple-500/10 rounded-lg p-4 border border-emerald-500/20">
            <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-400" />
              Upgrade to Pro
            </h4>
            <ul className="space-y-2">
              {[
                'Unlimited historical meeting sync',
                'Unlimited new meetings per month',
                'Priority AI processing',
                'Advanced analytics & insights',
                'Team collaboration features',
              ].map((feature, idx) => (
                <li
                  key={idx}
                  className="flex items-center gap-2 text-sm text-gray-300"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Pricing Preview */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-800/30 rounded-lg">
            <div>
              <p className="text-sm text-gray-400">Starting at</p>
              <p className="text-xl font-bold text-white">
                £49<span className="text-sm font-normal text-gray-400">/month</span>
              </p>
            </div>
            <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
              14-day free trial
            </Badge>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Maybe Later
            </Button>
            <Button
              onClick={handleViewPlans}
              disabled={isNavigating}
              className="flex-1 bg-gradient-to-r from-emerald-500 to-purple-500 hover:from-emerald-600 hover:to-purple-600 text-white border-0"
            >
              View Plans
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default HistoricalUpgradeGate;
