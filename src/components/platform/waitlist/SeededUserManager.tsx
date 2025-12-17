/**
 * SeededUserManager Component
 * Admin utility for bulk managing seeded/fake users
 */

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';
import { Users, Check } from 'lucide-react';

export function SeededUserManager() {
  const [isProcessing, setIsProcessing] = useState(false);

  const markAllAsSeeded = async () => {
    if (!confirm('Mark ALL current waitlist users as seeded? This cannot be undone easily.')) {
      return;
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase
        .from('meetings_waitlist')
        .update({ is_seeded: true })
        .eq('is_seeded', false)
        .select('id');

      if (error) throw error;

      toast.success(`Marked ${data?.length || 0} users as seeded`);
    } catch (error) {
      console.error('Error marking users as seeded:', error);
      toast.error('Failed to mark users as seeded');
    } finally {
      setIsProcessing(false);
    }
  };

  const markByPattern = async (pattern: string) => {
    if (!pattern || pattern.trim() === '') {
      toast.error('Please provide an email pattern');
      return;
    }

    if (!confirm(`Mark all users with email matching "${pattern}" as seeded?`)) {
      return;
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase
        .from('meetings_waitlist')
        .update({ is_seeded: true })
        .ilike('email', `%${pattern}%`)
        .eq('is_seeded', false)
        .select('id');

      if (error) throw error;

      toast.success(`Marked ${data?.length || 0} users as seeded`);
    } catch (error) {
      console.error('Error marking users as seeded:', error);
      toast.error('Failed to mark users as seeded');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6 transition-colors duration-200">
      <div className="flex items-center gap-3 mb-4">
        <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Seeded User Manager
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Bulk manage seeded/fake users for social proof
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Mark all as seeded */}
        <div className="p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-lg transition-colors duration-200">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            Mark All Current Users as Seeded
          </h4>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
            This will mark all current waitlist users as seeded. Use this if all current users are fake/demo data.
          </p>
          <button
            onClick={markAllAsSeeded}
            disabled={isProcessing}
            className="
              flex items-center gap-2
              px-4 py-2
              bg-purple-600 hover:bg-purple-700 dark:hover:bg-purple-600
              text-white
              rounded-lg
              text-sm font-medium
              transition-colors duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            <Check className="w-4 h-4" />
            {isProcessing ? 'Processing...' : 'Mark All as Seeded'}
          </button>
        </div>

        {/* Mark by email pattern */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors duration-200">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            Mark by Email Pattern
          </h4>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
            Mark users whose email contains a specific pattern (e.g., "test", "demo", "@example.com")
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              id="email-pattern"
              placeholder="e.g., test, demo, @example.com"
              className="
                flex-1
                px-3 py-2
                bg-white dark:bg-gray-900
                border border-gray-300 dark:border-gray-600
                rounded-lg
                text-sm
                text-gray-900 dark:text-white
                placeholder-gray-400 dark:placeholder-gray-500
                focus:ring-2 focus:ring-purple-500 focus:border-transparent
                transition-colors duration-200
              "
            />
            <button
              onClick={() => {
                const input = document.getElementById('email-pattern') as HTMLInputElement;
                markByPattern(input.value);
              }}
              disabled={isProcessing}
              className="
                px-4 py-2
                bg-gray-600 hover:bg-gray-700 dark:hover:bg-gray-500
                text-white
                rounded-lg
                text-sm font-medium
                transition-colors duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              {isProcessing ? 'Processing...' : 'Mark'}
            </button>
          </div>
        </div>

        {/* Warning */}
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-800 dark:text-yellow-400 transition-colors duration-200">
          ⚠️ <strong>Warning:</strong> These actions cannot be easily undone. Seeded users will be hidden by default in the admin view but remain visible on the public waitlist.
        </div>
      </div>
    </div>
  );
}
