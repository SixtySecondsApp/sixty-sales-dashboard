/**
 * WebsiteInputStep
 *
 * Shown when user signs up with a personal email (gmail, etc.)
 * Asks them to provide their company website for enrichment.
 * Offers "I don't have a website" option to proceed to Q&A flow.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Globe, ArrowRight, HelpCircle, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOnboardingV2Store, extractDomain } from '@/lib/stores/onboardingV2Store';

interface WebsiteInputStepProps {
  organizationId: string;
}

export function WebsiteInputStep({ organizationId: propOrgId }: WebsiteInputStepProps) {
  const [websiteInput, setWebsiteInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const {
    organizationId: storeOrgId,
    setWebsiteUrl,
    setHasNoWebsite,
    submitWebsite,
    setStep,
  } = useOnboardingV2Store();

  // Use organizationId from store (which gets updated when new org is created)
  // Fall back to prop if store is empty
  const organizationId = storeOrgId || propOrgId;

  const handleSubmitWebsite = async () => {
    const trimmed = websiteInput.trim();
    if (!trimmed) {
      setError('Please enter your company website');
      return;
    }

    // Basic validation
    const domain = extractDomain(trimmed);
    if (!domain || domain.length < 3 || !domain.includes('.')) {
      setError('Please enter a valid website (e.g., acme.com)');
      return;
    }

    setError(null);
    setWebsiteUrl(trimmed);
    await submitWebsite(organizationId);
  };

  const handleNoWebsite = () => {
    setHasNoWebsite(true);
    setStep('manual_enrichment');
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="w-full max-w-lg mx-auto px-4"
    >
      <div className="rounded-2xl shadow-xl border border-gray-800 bg-gray-900 p-8 sm:p-10">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500/20 to-violet-600/20 flex items-center justify-center">
            <Globe className="w-10 h-10 text-violet-400" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-3">
            What's your company website?
          </h2>
          <p className="text-gray-400">
            We'll use this to learn about your business and customize your AI assistant.
          </p>
        </div>

        {/* Website Input */}
        <div className="space-y-4 mb-8">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Company website
            </label>
            <div className="relative">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={websiteInput}
                onChange={(e) => {
                  setWebsiteInput(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSubmitWebsite();
                  }
                }}
                placeholder="acme.com"
                className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder:text-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
                autoFocus
              />
            </div>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-400 text-sm mt-2"
              >
                {error}
              </motion.p>
            )}
          </div>

          <Button
            onClick={handleSubmitWebsite}
            disabled={!websiteInput.trim()}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white py-4 text-base"
          >
            Continue
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-800" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-gray-900 text-gray-500">or</span>
          </div>
        </div>

        {/* No Website Option */}
        <button
          onClick={handleNoWebsite}
          className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 hover:bg-gray-800/50 transition-all"
        >
          <HelpCircle className="w-5 h-5" />
          <span>I don't have a website yet</span>
        </button>

        {/* Helper text */}
        <p className="text-center text-xs text-gray-500 mt-4">
          No worries! We'll ask a few quick questions to understand your business instead.
        </p>
      </div>
    </motion.div>
  );
}
