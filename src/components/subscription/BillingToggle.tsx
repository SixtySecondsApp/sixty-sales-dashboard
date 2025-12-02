// src/components/subscription/BillingToggle.tsx
// Toggle component for switching between monthly and yearly billing

import React from 'react';
import { motion } from 'framer-motion';
import type { BillingCycle } from '../../lib/types/subscription';

interface BillingToggleProps {
  value: BillingCycle;
  onChange: (value: BillingCycle) => void;
  yearlyDiscount?: number;
}

export function BillingToggle({
  value,
  onChange,
  yearlyDiscount = 20,
}: BillingToggleProps) {
  return (
    <div className="flex items-center justify-center gap-4">
      <span
        className={`text-sm font-medium transition-colors ${
          value === 'monthly' ? 'text-white' : 'text-slate-400'
        }`}
      >
        Monthly
      </span>

      <button
        onClick={() => onChange(value === 'monthly' ? 'yearly' : 'monthly')}
        className="relative w-14 h-7 rounded-full bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
        role="switch"
        aria-checked={value === 'yearly'}
      >
        <motion.span
          className="absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm"
          animate={{
            x: value === 'yearly' ? 28 : 0,
          }}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 30,
          }}
        />
      </button>

      <div className="flex items-center gap-2">
        <span
          className={`text-sm font-medium transition-colors ${
            value === 'yearly' ? 'text-white' : 'text-slate-400'
          }`}
        >
          Yearly
        </span>
        {yearlyDiscount > 0 && (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
            Save {yearlyDiscount}%
          </span>
        )}
      </div>
    </div>
  );
}

export default BillingToggle;
