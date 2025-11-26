import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useOnboardingProgress, OnboardingStep } from '@/lib/hooks/useOnboardingProgress';
import { WelcomeStep } from './WelcomeStep';
import { FathomConnectionStep } from './FathomConnectionStep';
import { SyncProgressStep } from './SyncProgressStep';
import { CompletionStep } from './CompletionStep';
import { useAuth } from '@/lib/contexts/AuthContext';

export default function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { needsOnboarding, currentStep, loading, skipOnboarding, resetOnboarding } = useOnboardingProgress();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isResetting, setIsResetting] = useState(false);

  const steps: OnboardingStep[] = ['welcome', 'fathom_connect', 'sync', 'complete'];

  useEffect(() => {
    if (!loading && user) {
      // Set initial step based on progress
      const stepIndex = steps.indexOf(currentStep);
      if (stepIndex >= 0) {
        setCurrentStepIndex(stepIndex);
      }
    }
  }, [loading, user, currentStep]);

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleSkip = async () => {
    try {
      await skipOnboarding();
      navigate('/');
    } catch (error) {
      console.error('Error skipping onboarding:', error);
    }
  };

  const handleComplete = () => {
    navigate('/meetings');
  };

  const handleReset = async () => {
    try {
      setIsResetting(true);
      await resetOnboarding();
      setCurrentStepIndex(0);
      // Small delay to show the reset happened
      setTimeout(() => {
        setIsResetting(false);
      }, 500);
    } catch (error) {
      console.error('Error resetting onboarding:', error);
      setIsResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#37bd7e]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(74,74,117,0.25),transparent)] pointer-events-none" />
      
      <div className="relative w-full max-w-4xl">
        {/* Show completion message if onboarding is already done */}
        {!needsOnboarding && !loading && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-blue-300 font-medium mb-1">
                  Onboarding Complete
                </p>
                <p className="text-sm text-blue-400/80">
                  You've already completed onboarding. You can review the steps below, restart the flow, or return to the dashboard.
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={handleReset}
                  disabled={isResetting}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResetting ? 'Resetting...' : 'Restart Onboarding'}
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="px-4 py-2 text-sm text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-500/50 rounded-lg transition-colors"
                >
                  Dashboard
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">
              Step {currentStepIndex + 1} of {steps.length}
            </span>
            <span className="text-sm text-gray-400">
              {Math.round(((currentStepIndex + 1) / steps.length) * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
              transition={{ duration: 0.3 }}
              className="bg-[#37bd7e] h-2 rounded-full"
            />
          </div>
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          {currentStepIndex === 0 && (
            <WelcomeStep key="welcome" onNext={handleNext} onSkip={handleSkip} />
          )}
          {currentStepIndex === 1 && (
            <FathomConnectionStep key="fathom" onNext={handleNext} onBack={handleBack} />
          )}
          {currentStepIndex === 2 && (
            <SyncProgressStep key="sync" onNext={handleNext} onBack={handleBack} />
          )}
          {currentStepIndex === 3 && (
            <CompletionStep key="complete" onComplete={handleComplete} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

