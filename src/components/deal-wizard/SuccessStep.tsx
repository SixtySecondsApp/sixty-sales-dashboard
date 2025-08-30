import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import { SuccessStepProps } from './types';

export function SuccessStep({ actionType }: SuccessStepProps) {
  return (
    <motion.div
      key="success"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="text-center py-8"
    >
      <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle className="w-8 h-8 text-emerald-400" />
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">
        {actionType === 'sale' ? 'Sale Recorded Successfully!' : 
         actionType === 'proposal' ? 'Deal & Proposal Created!' : 
         actionType === 'meeting' ? 'Meeting & Deal Created!' :
         'Deal Created Successfully!'}
      </h3>
      <p className="text-gray-400">
        {actionType === 'sale' ? 
         'Your sale has been recorded and the deal marked as signed.' : 
         actionType === 'meeting' ?
         'Your meeting has been logged and the deal moved to SQL stage.' :
         'Your new deal has been added to the pipeline with the selected contact.'}
      </p>
    </motion.div>
  );
}