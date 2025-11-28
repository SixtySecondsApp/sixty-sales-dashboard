/**
 * TeamManagement - Organization Team Management (Tier 2)
 *
 * Moved from /settings/team to /org/team
 * Provides team member management, invitations, and organization details.
 */

import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import TeamSettings from '@/pages/settings/TeamSettings';

export default function TeamManagement() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Navigation */}
        <div className="pt-6 pb-2">
          <Link
            to="/org"
            className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Organization
          </Link>
        </div>

        {/* Reuse existing TeamSettings component */}
        <TeamSettings />
      </div>
    </div>
  );
}
