/**
 * OrgSetupStep - Organization Setup Onboarding Step
 *
 * Creates or updates the user's organization during onboarding.
 * If no organization exists, creates one with the provided name.
 * If an organization exists, allows renaming it.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, Check, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOrg } from '@/lib/contexts/OrgContext';
import { useAuth } from '@/lib/contexts/AuthContext';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';

interface OrgSetupStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function OrgSetupStep({ onNext, onBack }: OrgSetupStepProps) {
  const { user } = useAuth();
  const { activeOrg, refreshOrgs, createOrg, isLoading: orgLoading } = useOrg();
  const [orgName, setOrgName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCheckedOrg, setHasCheckedOrg] = useState(false);

  // Check if user has an organization and set initial name
  useEffect(() => {
    const initializeOrgName = async () => {
      // Wait for org loading to complete
      if (orgLoading) return;

      setHasCheckedOrg(true);

      if (activeOrg?.name) {
        // User already has an org, use its name
        setOrgName(activeOrg.name);
      } else if (user) {
        // No org exists, suggest a default name based on user info
        const firstName = user.user_metadata?.first_name || '';
        const lastName = user.user_metadata?.last_name || '';
        const fullName = user.user_metadata?.full_name || `${firstName} ${lastName}`.trim();

        if (fullName) {
          setOrgName(`${fullName}'s Organization`);
        } else if (user.email) {
          // Extract company name from email domain
          const domain = user.email.split('@')[1];
          if (domain) {
            const companyName = domain.split('.')[0];
            setOrgName(companyName.charAt(0).toUpperCase() + companyName.slice(1));
          }
        }
      }
    };

    initializeOrgName();
  }, [activeOrg?.name, orgLoading, user]);

  const handleCreateOrg = async () => {
    if (!orgName.trim()) {
      setError('Organization name is required');
      return;
    }

    if (orgName.trim().length > 100) {
      setError('Organization name must be 100 characters or less');
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      // Create new organization
      const newOrg = await createOrg(orgName.trim());

      if (!newOrg) {
        throw new Error('Failed to create organization');
      }

      toast.success('Organization created!');
      onNext();
    } catch (err: any) {
      console.error('Error creating organization:', err);
      setError(err.message || 'Failed to create organization');
      toast.error('Failed to create organization');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateOrgName = async () => {
    if (!orgName.trim()) {
      setError('Organization name is required');
      return;
    }

    if (orgName.trim().length > 100) {
      setError('Organization name must be 100 characters or less');
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      // Try the RPC function first
      const response = await (supabase.rpc as any)('rename_user_organization', {
        p_new_name: orgName.trim(),
      }) as { data: Array<{ success: boolean; error_message?: string }> | null; error: any };

      if (response.error) {
        // If RPC fails (function doesn't exist), try direct update
        if (response.error.code === '42883' || response.error.message?.includes('does not exist')) {
          // Direct update as fallback
          if (activeOrg?.id) {
            const { error: updateError } = await supabase
              .from('organizations')
              .update({ name: orgName.trim(), updated_at: new Date().toISOString() })
              .eq('id', activeOrg.id);

            if (updateError) throw updateError;
          }
        } else {
          throw response.error;
        }
      } else if (response.data && response.data.length > 0 && !response.data[0].success) {
        throw new Error(response.data[0].error_message || 'Failed to update organization');
      }

      // Refresh organizations to get updated name
      await refreshOrgs();

      toast.success('Organization updated!');
      onNext();
    } catch (err: any) {
      console.error('Error updating organization:', err);
      setError(err.message || 'Failed to update organization name');
      toast.error('Failed to update organization name');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleContinue = async () => {
    if (!activeOrg) {
      // No organization exists, create one
      await handleCreateOrg();
    } else if (activeOrg.name === orgName.trim()) {
      // Name hasn't changed, just continue
      onNext();
    } else {
      // Name changed, update it
      await handleUpdateOrgName();
    }
  };

  // Show loading while checking for existing org
  if (orgLoading || !hasCheckedOrg) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full max-w-xl mx-auto flex items-center justify-center py-20"
      >
        <Loader2 className="w-8 h-8 text-[#37bd7e] animate-spin" />
      </motion.div>
    );
  }

  const isCreatingNew = !activeOrg;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-xl mx-auto"
    >
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#37bd7e] to-[#2da76c] mb-6"
        >
          <Building2 className="w-10 h-10 text-white" />
        </motion.div>
        <h1 className="text-3xl font-bold mb-4 text-white">
          {isCreatingNew ? 'Create Your Organization' : 'Set Up Your Organization'}
        </h1>
        <p className="text-lg text-gray-400">
          {isCreatingNew
            ? 'Name your workspace where your team will collaborate'
            : 'Your workspace where your team collaborates and shares data'
          }
        </p>
      </div>

      <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800/50 p-6 mb-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Organization Name
            </label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => {
                setOrgName(e.target.value);
                setError(null);
              }}
              placeholder="Acme Inc."
              maxLength={100}
              disabled={isUpdating}
              autoFocus
              className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent transition-all disabled:opacity-50"
            />
            <p className="mt-2 text-xs text-gray-500">
              This will be visible to all team members you invite
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-red-400 text-sm"
            >
              <AlertCircle className="w-4 h-4" />
              {error}
            </motion.div>
          )}
        </div>
      </div>

      <div className="bg-gray-900/30 backdrop-blur-sm rounded-xl border border-gray-800/30 p-6 mb-8">
        <h3 className="text-sm font-medium text-gray-300 mb-4">
          What you'll get with your organization:
        </h3>
        <ul className="space-y-3">
          {[
            'Shared pipeline and deals with your team',
            'Team-wide meeting analytics and insights',
            'Collaborative task management',
            'Unified contact and company database',
          ].map((feature, index) => (
            <motion.li
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className="flex items-center gap-3 text-gray-400"
            >
              <div className="w-5 h-5 rounded-full bg-[#37bd7e]/20 flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 text-[#37bd7e]" />
              </div>
              {feature}
            </motion.li>
          ))}
        </ul>
      </div>

      <div className="flex gap-4 justify-center">
        <Button
          onClick={onBack}
          variant="ghost"
          className="text-gray-400 hover:text-white"
          disabled={isUpdating}
        >
          Back
        </Button>
        <Button
          onClick={handleContinue}
          disabled={isUpdating || !orgName.trim()}
          className="bg-[#37bd7e] hover:bg-[#2da76c] text-white px-8"
        >
          {isUpdating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {isCreatingNew ? 'Creating...' : 'Saving...'}
            </>
          ) : (
            isCreatingNew ? 'Create Organization' : 'Continue'
          )}
        </Button>
      </div>
    </motion.div>
  );
}
