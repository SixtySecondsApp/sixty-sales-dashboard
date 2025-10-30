import React from 'react';
import { motion } from 'framer-motion';
import { 
  CreditCard, 
  Repeat, 
  Briefcase, 
  Calendar, 
  Settings,
  ChevronRight
} from 'lucide-react';
import { DealTypeStepProps, DealType, DealTypeConfig } from './types';

const dealTypeConfigs: DealTypeConfig[] = [
  {
    id: 'subscription',
    title: 'Subscription',
    description: 'Recurring monthly or yearly payments',
    icon: 'Repeat',
    fields: {
      monthlyMrr: true,
      oneOffRevenue: true, // Setup fees
    },
    defaultSaleType: 'subscription'
  },
  {
    id: 'one-off',
    title: 'One-off Sale',
    description: 'Single payment for product or service',
    icon: 'CreditCard',
    fields: {
      value: true,
    },
    defaultSaleType: 'one-off'
  },
  {
    id: 'project',
    title: 'Project-based',
    description: 'Fixed scope project with milestones',
    icon: 'Briefcase',
    fields: {
      value: true,
      projectScope: true,
      duration: true,
      milestones: true,
    },
    defaultSaleType: 'one-off'
  },
  {
    id: 'retainer',
    title: 'Retainer',
    description: 'Ongoing monthly service agreement',
    icon: 'Calendar',
    fields: {
      monthlyMrr: true,
      retainerDetails: true,
    },
    defaultSaleType: 'subscription'
  },
  {
    id: 'custom',
    title: 'Custom Deal',
    description: 'Flexible deal structure',
    icon: 'Settings',
    fields: {
      value: true,
      oneOffRevenue: true,
      monthlyMrr: true,
    },
    defaultSaleType: 'one-off'
  }
];

const iconMap = {
  CreditCard,
  Repeat,
  Briefcase,
  Calendar,
  Settings,
};

export function DealTypeStep({ wizard, onWizardChange, onNext }: DealTypeStepProps) {
  const handleSelectDealType = (dealType: DealType) => {
    const config = dealTypeConfigs.find(c => c.id === dealType);
    
    onWizardChange({
      ...wizard,
      dealType,
      dealData: {
        ...wizard.dealData,
        saleType: config?.defaultSaleType || 'one-off'
      }
    });
  };

  const handleNext = () => {
    if (wizard.dealType) {
      onNext();
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold theme-text-primary mb-2">
          What type of deal are you creating?
        </h3>
        <p className="theme-text-tertiary text-sm">
          Choose the deal type that best matches your business model
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {dealTypeConfigs.map((config) => {
          const IconComponent = iconMap[config.icon as keyof typeof iconMap];
          const isSelected = wizard.dealType === config.id;

          return (
            <motion.button
              key={config.id}
              onClick={() => handleSelectDealType(config.id)}
              className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                isSelected
                  ? 'border-violet-500 bg-violet-500/10 shadow-lg shadow-violet-500/20'
                  : 'theme-border theme-bg-elevated/50 hover:bg-gray-100 dark:hover:bg-gray-800/50'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg flex-shrink-0 ${
                  isSelected
                    ? 'bg-violet-500/20 text-violet-400'
                    : 'bg-gray-200 dark:bg-gray-700/50 theme-text-tertiary'
                }`}>
                  <IconComponent className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className={`font-medium ${
                    isSelected ? 'theme-text-primary' : 'theme-text-secondary'
                  }`}>
                    {config.title}
                  </h4>
                  <p className={`text-sm mt-1 ${
                    isSelected ? 'theme-text-secondary' : 'theme-text-tertiary'
                  }`}>
                    {config.description}
                  </p>
                </div>
                {isSelected && (
                  <div className="flex-shrink-0 text-violet-400">
                    <div className="w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                    </div>
                  </div>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      <div className="pt-4">
        <button
          onClick={handleNext}
          disabled={!wizard.dealType}
          className="w-full px-6 py-3 bg-violet-600 dark:bg-violet-500/10 text-white dark:text-violet-400 dark:border dark:border-violet-500/20 rounded-xl hover:bg-violet-700 dark:hover:bg-violet-500/20 disabled:bg-gray-600 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2"
        >
          Continue
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}