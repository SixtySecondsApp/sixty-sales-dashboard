import React from 'react';
import { Building2, CheckCircle, PoundSterling, Calendar, FileText } from 'lucide-react';
import { DealFormStepProps, DealType, DealTypeConfig } from './types';
import { canSplitDeals } from '@/lib/utils/adminUtils';
import logger from '@/lib/utils/logger';

// Deal type configurations (same as in DealTypeStep)
const dealTypeConfigs: DealTypeConfig[] = [
  {
    id: 'subscription',
    title: 'Subscription',
    description: 'Recurring monthly or yearly payments',
    icon: 'Repeat',
    fields: {
      monthlyMrr: true,
      oneOffRevenue: true,
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

export function DealFormStep({ 
  wizard, 
  actionType, 
  stages, 
  userData, 
  isLoading, 
  onWizardChange, 
  onCreateDeal 
}: DealFormStepProps) {
  // Get the current deal type configuration
  const dealTypeConfig = wizard.dealType ? dealTypeConfigs.find(config => config.id === wizard.dealType) : null;

  const handleInputChange = (field: string, value: any) => {
    onWizardChange({
      ...wizard,
      dealData: {
        ...wizard.dealData,
        [field]: value
      }
    });
  };

  const handleRevenueChange = (field: 'oneOffRevenue' | 'monthlyMrr', value: number) => {
    const updatedData = {
      ...wizard.dealData,
      [field]: value
    };

    // Update total value based on business logic
    if (field === 'oneOffRevenue') {
      updatedData.value = value + (wizard.dealData.monthlyMrr * 3);
    } else {
      updatedData.value = wizard.dealData.oneOffRevenue + (value * 3);
    }

    onWizardChange({
      ...wizard,
      dealData: updatedData
    });
  };

  if (!wizard.selectedContact) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
        <Building2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
        Deal Information
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="Deal Name *"
          value={wizard.dealData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          className="w-full px-4 py-3 theme-bg-elevated theme-border rounded-xl theme-text-primary placeholder:theme-text-tertiary focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500"
          required
        />
        <input
          type="text"
          placeholder="Company Name *"
          value={wizard.dealData.company}
          onChange={(e) => handleInputChange('company', e.target.value)}
          className="w-full px-4 py-3 theme-bg-elevated theme-border rounded-xl theme-text-primary placeholder:theme-text-tertiary focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500"
          required
        />
      </div>

      {/* Revenue Split Section - Admin Only for Sales and Proposals */}
      {(actionType === 'sale' || actionType === 'proposal') && canSplitDeals(userData) && (
        <div className="space-y-4 p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl">
          <div className="flex items-center gap-2">
            <PoundSterling className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Revenue Breakdown</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium theme-text-secondary">One-off Revenue (£)</label>
              <input
                type="number"
                placeholder="0"
                value={wizard.dealData.oneOffRevenue || ''}
                onChange={(e) => handleRevenueChange('oneOffRevenue', parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-3 theme-bg-elevated theme-border rounded-xl theme-text-primary placeholder:theme-text-tertiary focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium theme-text-secondary">Monthly MRR (£)</label>
              <input
                type="number"
                placeholder="0"
                value={wizard.dealData.monthlyMrr || ''}
                onChange={(e) => handleRevenueChange('monthlyMrr', parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-3 theme-bg-elevated theme-border rounded-xl theme-text-primary placeholder:theme-text-tertiary focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium theme-text-secondary">Sale Type</label>
            <select
              value={wizard.dealData.saleType}
              onChange={(e) => handleInputChange('saleType', e.target.value)}
              className="w-full px-4 py-3 theme-bg-elevated theme-border rounded-xl theme-text-primary focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="one-off">One-off</option>
              <option value="subscription">Subscription</option>
              <option value="lifetime">Lifetime</option>
            </select>
          </div>

          {(wizard.dealData.oneOffRevenue > 0 || wizard.dealData.monthlyMrr > 0) && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <div className="text-sm text-emerald-700 dark:text-emerald-400">
                <span className="font-medium">Total Deal Value: </span>
                £{((wizard.dealData.oneOffRevenue || 0) + ((wizard.dealData.monthlyMrr || 0) * 3)).toLocaleString('en-GB')}
              </div>
              {wizard.dealData.monthlyMrr > 0 && (
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Annual Value: £{((wizard.dealData.oneOffRevenue || 0) + ((wizard.dealData.monthlyMrr || 0) * 12)).toLocaleString('en-GB')}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Non-Admin Warning for Sales and Proposals */}
      {(actionType === 'sale' || actionType === 'proposal') && !canSplitDeals(userData) && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <div className="text-sm text-amber-400">
            <span className="font-medium">⚠️ Revenue Split Unavailable</span>
            <div className="text-xs text-gray-400 mt-1">
              Only administrators can create deals with revenue split. This deal will use the simple value field below.
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Show simple deal value field for: 1) Non sales/proposal actions, OR 2) Non-admin users doing sales/proposals */}
        {(!(actionType === 'sale' || actionType === 'proposal') || !canSplitDeals(userData)) && (
          <input
            type="number"
            placeholder="Deal Value (£)"
            value={wizard.dealData.value || ''}
            onChange={(e) => handleInputChange('value', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 theme-bg-elevated theme-border rounded-xl theme-text-primary placeholder:theme-text-tertiary focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
          />
        )}
        <select
          value={wizard.dealData.stage_id}
          onChange={(e) => handleInputChange('stage_id', e.target.value)}
          className="w-full px-4 py-3 theme-bg-elevated theme-border rounded-xl theme-text-primary focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
        >
          {!stages || stages.length === 0 ? (
            <option value="">Loading stages...</option>
          ) : (
            <>
              {!wizard.dealData.stage_id && (
                <option value="">Select a stage</option>
              )}
              {stages
                .filter(stage => stage.name !== 'Signed & Paid') // Filter out legacy stage
                .map(stage => {
                  logger.log('🔍 Rendering stage:', { id: stage.id, name: stage.name, hasName: !!stage.name });
                  return (
                    <option key={stage.id} value={stage.id}>
                      {stage.name || `Stage ${stage.id}`}
                    </option>
                  );
                })}
            </>
          )}
        </select>
      </div>

      <textarea
        placeholder="Description (optional)"
        value={wizard.dealData.description}
        onChange={(e) => handleInputChange('description', e.target.value)}
        className="w-full px-4 py-3 theme-bg-elevated theme-border rounded-xl theme-text-primary placeholder:theme-text-tertiary focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 resize-none"
        rows={3}
      />

      <div className="pt-4">
        <button
          onClick={onCreateDeal}
          disabled={!wizard.dealData.name || !wizard.dealData.company || isLoading}
          className="w-full px-6 py-3 bg-violet-600 dark:bg-violet-500/10 text-white dark:text-violet-400 dark:border dark:border-violet-500/20 rounded-xl hover:bg-violet-700 dark:hover:bg-violet-500/20 disabled:bg-gray-600 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              {actionType === 'proposal' ? 'Create Deal & Proposal' : 
               actionType === 'sale' ? 'Create Sale' : 
               actionType === 'meeting' ? 'Add Meeting' : 'Create Deal'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}