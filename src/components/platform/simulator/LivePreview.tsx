/**
 * LivePreview Component
 * Opens the actual application in customer view mode with simulated trial status
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Eye, Clock } from 'lucide-react';
import type { TrialStatus } from './types';

interface LivePreviewProps {
  trialStatus: TrialStatus;
  day: number;
}

export function LivePreview({ trialStatus, day }: LivePreviewProps) {
  const handleOpenPreview = () => {
    // Store simulated trial data in sessionStorage so the app can read it
    const simulatedData = {
      isSimulation: true,
      day,
      trialStatus,
      timestamp: Date.now(),
    };

    sessionStorage.setItem('trial_simulation', JSON.stringify(simulatedData));

    // Open the dashboard in a new tab
    window.open('/dashboard?preview=trial', '_blank');
  };

  const isUrgent = trialStatus.daysRemaining <= 3;
  const isExpiringSoon = trialStatus.daysRemaining <= 7;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="w-5 h-5" />
          Live Customer View
        </CardTitle>
        <CardDescription>
          Open the actual application to see how it looks on Day {day}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Trial Status Summary */}
        <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3 mb-2">
            <Clock className={`w-5 h-5 ${
              isUrgent
                ? 'text-red-500'
                : isExpiringSoon
                  ? 'text-amber-500'
                  : 'text-blue-500'
            }`} />
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                Day {day} of Trial
              </div>
              <div className={`text-xs ${
                isUrgent
                  ? 'text-red-600 dark:text-red-400'
                  : isExpiringSoon
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-blue-600 dark:text-blue-400'
              }`}>
                {trialStatus.isTrialing
                  ? `${trialStatus.daysRemaining} days remaining`
                  : trialStatus.hasExpired
                    ? 'Trial expired'
                    : 'Active subscription'}
              </div>
            </div>
          </div>

          {/* Status indicators */}
          <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${
                trialStatus.isTrialing ? 'bg-green-500' : 'bg-gray-400'
              }`} />
              <span className="text-gray-600 dark:text-gray-400">
                {trialStatus.isTrialing ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${
                trialStatus.hasPaymentMethod ? 'bg-green-500' : 'bg-amber-500'
              }`} />
              <span className="text-gray-600 dark:text-gray-400">
                {trialStatus.hasPaymentMethod ? 'Payment added' : 'No payment'}
              </span>
            </div>
          </div>
        </div>

        {/* Banner Preview Info */}
        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
          <p>
            <strong>What you'll see:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            {trialStatus.isTrialing && (
              <li>
                Trial banner at the top{' '}
                <span className={`font-medium ${
                  isUrgent
                    ? 'text-red-600 dark:text-red-400'
                    : isExpiringSoon
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-blue-600 dark:text-blue-400'
                }`}>
                  ({isUrgent ? 'urgent red' : isExpiringSoon ? 'warning amber' : 'info blue'})
                </span>
              </li>
            )}
            <li>Full dashboard with real data</li>
            <li>All navigation and features</li>
            <li>Trial badge in navigation (if active)</li>
          </ul>
        </div>

        {/* Action Button */}
        <Button
          onClick={handleOpenPreview}
          className="w-full"
          size="lg"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Open Live Preview in New Tab
        </Button>

        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          The preview will open in a new tab with simulated Day {day} trial status
        </p>
      </CardContent>
    </Card>
  );
}
