/**
 * Pending Approval Page
 *
 * Shown when a user tries to access protected routes but their request
 * is pending approval. They can't access any features until approved.
 * Accessible via /auth/pending-approval
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, LogOut, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/contexts/AuthContext';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';

export default function PendingApprovalPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [joinRequest, setJoinRequest] = useState<{
    orgName: string;
    email: string;
  } | null>(null);

  useEffect(() => {
    // Fetch join request details
    const fetchJoinRequest = async () => {
      if (!user?.id) return;

      try {
        const { data } = await supabase
          .from('organization_join_requests')
          .select('organization_id, email, organization_id(name)')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .maybeSingle();

        if (data) {
          setJoinRequest({
            orgName: typeof data.organization_id === 'object' && data.organization_id?.name 
              ? data.organization_id.name 
              : 'the organization',
            email: data.email,
          });
        }
      } catch (err) {
        console.error('Error fetching join request:', err);
      }
    };

    fetchJoinRequest();
  }, [user?.id]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/auth/login', { replace: true });
    } catch (err) {
      toast.error('Failed to log out');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(74,74,117,0.25),transparent)] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="relative bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-800/50 p-8">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 via-gray-900/70 to-gray-900/30 rounded-2xl -z-10" />
          <div className="absolute -right-20 -top-20 w-40 h-40 bg-amber-500/10 blur-3xl rounded-full" />

          <div className="text-center">
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ repeat: Infinity, duration: 3 }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/20 mx-auto mb-6"
            >
              <Clock className="w-8 h-8 text-amber-500" />
            </motion.div>

            <h1 className="text-2xl font-bold text-white mb-2">
              Request Pending Approval
            </h1>
            <p className="text-gray-400 mb-6">
              Your request to join{' '}
              <span className="text-white font-medium">
                {joinRequest?.orgName || 'the organization'}
              </span>{' '}
              is awaiting admin review.
            </p>
          </div>

          <div className="space-y-4 mb-6">
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
              <p className="text-xs font-medium uppercase tracking-wide mb-1 text-gray-400">
                Email Address
              </p>
              <p className="font-medium text-white">{joinRequest?.email || user?.email}</p>
            </div>

            <div className="bg-amber-900/20 border border-amber-800/50 rounded-xl p-4">
              <div className="flex gap-3">
                <Clock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-100 mb-1">What to Expect</p>
                  <p className="text-sm text-amber-200/80">
                    Once approved, you'll receive an email with a link to access your organization dashboard. This usually happens within 24 hours.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 flex items-center gap-3">
              <Mail className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-300">Check your email regularly</p>
                <p className="text-xs text-gray-500 truncate">
                  Look for approval notification from {joinRequest?.email}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => navigate('/dashboard')}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white"
            >
              Return to Dashboard
            </Button>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="w-full border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Log Out
            </Button>
          </div>

          <p className="text-xs text-gray-500 text-center mt-6">
            Questions? Contact your organization administrator or email support@use60.com
          </p>
        </div>
      </motion.div>
    </div>
  );
}
