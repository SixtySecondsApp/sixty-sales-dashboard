/**
 * OrgSetupStep - Organization Setup Onboarding Step
 *
 * Allows users to confirm/update their organization name and
 * handles the org_id setup for multi-tenant support.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, Check, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOrg } from '@/lib/contexts/OrgContext';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';

interface OrgSetupStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function OrgSetupStep({ onNext, onBack }: OrgSetupStepProps) {
  const { activeOrg, refreshOrgs, isLoading: orgLoading } = useOrg();
  const [orgName, setOrgName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize org name from active org or sessionStorage
  useEffect(() => {
    const pendingOrgName = sessionStorage.getItem('pending_org_name');
    if (pendingOrgName) {
      setOrgName(pendingOrgName);
      sessionStorage.removeItem('pending_org_name');
    } else if (activeOrg?.name) {
      setOrgName(activeOrg.name);
    }
  }, [activeOrg?.name]);

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
      // Call the rename function
      // Note: rename_user_organization is defined in our migrations but not in generated types
      // Use type assertion on the whole result to work around missing types
      const response = await (supabase.rpc as any)('rename_user_organization', {
        p_new_name: orgName.trim(),
      }) as { data: Array<{ success: boolean; error_message?: string }> | null; error: any };

      if (response.error) {
        throw response.error;
      }

      // Check if the function returned an error
      if (response.data && response.data.length > 0 && !response.data[0].success) {
        throw new Error(response.data[0].error_message || 'Failed to update organization');
      }

      // Refresh organizations to get updated name
      await refreshOrgs();

      toast.success('Organization name updated!');
      onNext();
    } catch (err: any) {
      console.error('Error updating organization:', err);
      setError(err.message || 'Failed to update organization name');
      toast.error('Failed to update organization name');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleContinue = () => {
    // If the name hasn't changed, just continue
    if (activeOrg?.name === orgName.trim()) {
      onNext();
    } else {
      handleUpdateOrgName();
    }
  };

  if (orgLoading) {
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
        <h1 className="text-3xl font-bold mb-4 text-white">Set Up Your Organization</h1>
        <p className="text-lg text-gray-400">
          Your workspace where your team collaborates and shares data
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
              className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent transition-all disabled:opacity-50"
            />
            <p className="mt-2 text-xs text-gray-500">
              This will be visible to all team members
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
              Saving...
            </>
          ) : (
            'Continue'
          )}
        </Button>
      </div>
    </motion.div>
  );
}
