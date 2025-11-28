/**
 * OrgBranding - Organization Branding Settings (Tier 2)
 *
 * Moved from /settings (Branding tab) to /org/branding
 * Provides organization logo and visual identity management.
 */

import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import LogoSettings from '@/pages/settings/LogoSettings';

export default function OrgBranding() {
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

        {/* Branding Settings Header */}
        <div className="py-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Organization Branding
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Customize your organization's visual identity with logos and icons.
          </p>
        </div>

        {/* Reuse existing LogoSettings component */}
        <LogoSettings />
      </div>
    </div>
  );
}
