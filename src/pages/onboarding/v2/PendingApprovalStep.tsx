/**
 * PendingApprovalStep
 *
 * Displays a message when a user has submitted a join request for an existing organization.
 * They are waiting for the organization admin to approve their request.
 * This is an informational screen with no action buttons.
 */

import { motion } from 'framer-motion';
import { Clock, CheckCircle2 } from 'lucide-react';
import { useOnboardingV2Store } from '@/lib/stores/onboardingV2Store';
import { supabase } from '@/lib/supabase/clientV2';
import { useEffect, useState } from 'react';

export function PendingApprovalStep() {
  const { pendingJoinRequest, userEmail } = useOnboardingV2Store();
  const [profileEmail, setProfileEmail] = useState<string | null>(null);

  useEffect(() => {
    // Fetch the user's profile email if not set
    if (!userEmail) {
      const fetchUserEmail = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) {
          setProfileEmail(session.user.email);
        }
      };
      fetchUserEmail();
    }
  }, [userEmail]);

  const displayEmail = userEmail || profileEmail;
  const orgName = pendingJoinRequest?.orgName || 'the organization';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-2xl mx-auto px-4"
    >
      <div className="rounded-2xl shadow-xl border border-gray-800 bg-gray-900 overflow-hidden">
        {/* Header */}
        <div className="bg-amber-600 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-white">
                Request Pending Approval
              </h2>
              <p className="text-amber-100 text-sm">Your admin will review your request shortly</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="mb-8">
            <p className="text-gray-300 text-center leading-relaxed mb-6">
              Your request to join <span className="font-semibold text-white">{orgName}</span> has been submitted and is awaiting approval from the organization administrator.
            </p>

            <div className="space-y-4 mb-8">
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                <p className="text-xs font-medium uppercase tracking-wide mb-1 text-gray-400">
                  Email Address
                </p>
                <p className="font-medium text-white">{displayEmail}</p>
              </div>

              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                <p className="text-xs font-medium uppercase tracking-wide mb-1 text-gray-400">
                  Organization
                </p>
                <p className="font-medium text-white">{orgName}</p>
              </div>

              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                <p className="text-xs font-medium uppercase tracking-wide mb-1 text-gray-400">
                  Status
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                  <p className="font-medium text-white">Awaiting Admin Review</p>
                </div>
              </div>
            </div>

            {/* What happens next */}
            <div className="bg-amber-900/20 border border-amber-800/50 rounded-xl p-4">
              <div className="flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-100 mb-1">What Happens Next</p>
                  <p className="text-sm text-amber-200/80">
                    Once the admin approves your request, you'll receive an email with a link to activate your account and access the dashboard.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Support note */}
          <div className="text-center">
            <p className="text-sm text-gray-400">
              Questions? Please contact your organization administrator or <a href="mailto:support@use60.com" className="text-amber-400 hover:text-amber-300 transition-colors">reach out to support</a>.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
