/**
 * CompletionStep
 *
 * Final step showing success and configured skills summary.
 * Provides navigation to dashboard and suggested next steps.
 */

import { motion } from 'framer-motion';
import {
  Check,
  ChevronRight,
  Settings,
  LayoutDashboard,
  FileText,
  Calendar,
  Video,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useOnboardingV2Store, SKILLS, SkillId } from '@/lib/stores/onboardingV2Store';

interface NextStepItem {
  icon: typeof FileText;
  text: string;
  route: string;
}

const nextSteps: NextStepItem[] = [
  { icon: FileText, text: 'Connect your CRM to sync contacts', route: '/integrations' },
  { icon: Calendar, text: 'Connect your calendar', route: '/integrations' },
  { icon: Video, text: 'Connect your meetings', route: '/integrations' },
  { icon: LayoutDashboard, text: 'View dashboard', route: '/dashboard' },
];

export function CompletionStep() {
  const navigate = useNavigate();
  const { enrichment, skillConfigs, setStep } = useOnboardingV2Store();

  // Determine which skills have been configured (have non-empty data)
  const configuredSkillIds = SKILLS.filter((skill) => {
    const config = skillConfigs[skill.id];
    if (!config) return false;
    // Check if skill has any meaningful data
    return Object.values(config).some((value) => {
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'string') return value.trim().length > 0;
      return !!value;
    });
  }).map((s) => s.id);

  const handleEditSettings = () => {
    setStep('skills_config');
  };

  const handleGoToDashboard = () => {
    navigate('/dashboard');
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="w-full max-w-lg mx-auto px-4"
    >
      <div className="rounded-2xl shadow-xl border border-gray-800 bg-gray-900 p-8 sm:p-10 text-center">
        {/* Success Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/25"
        >
          <Check className="w-10 h-10 text-white" strokeWidth={3} />
        </motion.div>

        {/* Title */}
        <h2 className="text-2xl font-bold mb-3 text-white">Your Sales Assistant is Ready</h2>
        <p className="mb-8 leading-relaxed text-gray-400">
          We've trained your AI on{' '}
          <span className="font-semibold text-white">
            {enrichment?.company_name || 'your company'}
          </span>
          's way of selling. It now knows your qualification criteria, objection handling, and
          brand voice.
        </p>

        {/* Skills Summary */}
        <div className="rounded-xl p-5 mb-8 bg-gray-800">
          <p className="text-sm font-semibold mb-4 text-gray-300">Skills Configured</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {SKILLS.map((skill) => {
              const Icon = skill.icon;
              const isConfigured = configuredSkillIds.includes(skill.id);
              return (
                <div
                  key={skill.id}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold ${
                    isConfigured
                      ? 'bg-emerald-900/50 text-emerald-400'
                      : 'bg-gray-700 text-gray-500'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {skill.name}
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleEditSettings}
            className="flex-1 rounded-xl px-4 py-3.5 font-semibold transition-all flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white"
          >
            <Settings className="w-4 h-4" />
            Edit Settings
          </button>
          <button
            onClick={handleGoToDashboard}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-3.5 font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25"
          >
            <LayoutDashboard className="w-4 h-4" />
            Go to Dashboard
          </button>
        </div>
      </div>

      {/* What's Next */}
      <div className="mt-6 rounded-2xl border border-gray-800 bg-gray-900 p-6 text-left shadow-xl">
        <h3 className="font-bold mb-4 text-white">What's next?</h3>
        <div className="space-y-3">
          {nextSteps.map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={i}
                onClick={() => navigate(item.route)}
                className="w-full flex items-center gap-3 p-2 rounded-lg transition-colors cursor-pointer text-gray-400 hover:bg-gray-800 hover:text-white"
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-gray-800">
                  <Icon className="w-4 h-4 text-gray-400" />
                </div>
                <span className="text-sm font-medium">{item.text}</span>
                <ChevronRight className="w-4 h-4 ml-auto text-gray-600" />
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
