import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Users, FileText, PoundSterling, Calendar, Loader2, CheckCircle2, AlertCircle, Briefcase } from 'lucide-react';
import { format, addDays, addWeeks } from 'date-fns';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { QuickAddFormData, ValidationErrors } from './types';

interface ActivityFormsProps {
  selectedAction: 'meeting' | 'proposal' | 'sale';
  selectedContact: any;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  formData: QuickAddFormData;
  setFormData: (data: QuickAddFormData) => void;
  validationErrors: ValidationErrors;
  isSubmitting: boolean;
  submitStatus: 'idle' | 'success' | 'error';
  onSubmit: (e: React.FormEvent) => Promise<void>;
  onBack: () => void;
  onChangeContact: () => void;
}

export function ActivityForms({
  selectedAction,
  selectedContact,
  selectedDate,
  setSelectedDate,
  formData,
  setFormData,
  validationErrors,
  isSubmitting,
  submitStatus,
  onSubmit,
  onBack,
  onChangeContact
}: ActivityFormsProps) {
  const [showCalendar, setShowCalendar] = useState(false);

  const getActionIcon = () => {
    switch (selectedAction) {
      case 'meeting': return <Users className="w-5 h-5 text-violet-500" />;
      case 'proposal': return <FileText className="w-5 h-5 text-orange-500" />;
      case 'sale': return <PoundSterling className="w-5 h-5 text-emerald-500" />;
    }
  };

  const getActionTitle = () => {
    switch (selectedAction) {
      case 'meeting': return 'Add Meeting';
      case 'proposal': return 'Add Proposal';
      case 'sale': return 'Add Sale';
    }
  };

  const getDateLabel = () => {
    switch (selectedAction) {
      case 'meeting': return 'Meeting Date';
      case 'proposal': return 'Proposal Date';
      case 'sale': return 'Sale Date';
      default: return 'Date';
    }
  };

  const calculateDealValue = () => {
    const oneOff = parseFloat(formData.oneOffRevenue || '0') || 0;
    const monthly = parseFloat(formData.monthlyMrr || '0') || 0;
    return ((monthly * 3) + oneOff).toFixed(2);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {/* Compact Header with contact info */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="p-1.5 hover:bg-gray-800/50 rounded-lg transition-colors"
            >
              <ArrowRight className="w-4 h-4 text-gray-400 rotate-180" />
            </button>
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                {getActionIcon()} {getActionTitle()}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-400">for</span>
                <span className="text-sm text-[#37bd7e] font-medium">
                  {selectedContact.full_name || 
                   (selectedContact.first_name || selectedContact.last_name ? 
                    `${selectedContact.first_name || ''} ${selectedContact.last_name || ''}`.trim() : 
                    selectedContact.email)}
                </span>
                {selectedContact.company && (
                  <span className="text-sm text-gray-500">• {typeof selectedContact.company === 'string' ? selectedContact.company : (selectedContact.company as any)?.name || 'Company'}</span>
                )}
                <button
                  type="button"
                  onClick={onChangeContact}
                  className="text-xs text-gray-400 hover:text-[#37bd7e] ml-2"
                >
                  Change
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Compact Date Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-400">
              {getDateLabel()}
            </label>
            <div className="flex gap-2">
              {[
                { label: 'Today', date: new Date() },
                { label: 'Yesterday', date: addDays(new Date(), -1) },
                { label: 'Last Week', date: addWeeks(new Date(), -1) }
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => {
                    setSelectedDate(option.date);
                    setShowCalendar(false);
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${
                    format(selectedDate, 'yyyy-MM-dd') === format(option.date, 'yyyy-MM-dd')
                      ? 'bg-[#37bd7e]/20 border-[#37bd7e] text-[#37bd7e]'
                      : 'bg-gray-800/30 border-gray-700/30 text-gray-300 hover:bg-gray-700/50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowCalendar(!showCalendar)}
            className="w-full bg-gray-800/50 border border-gray-600/50 rounded-xl px-3 py-2.5 text-white text-left hover:bg-gray-700/50 transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#37bd7e]" />
              <span className="text-sm">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</span>
            </div>
            <span className="text-xs text-gray-400">Change</span>
          </button>
          
          {showCalendar && (
            <div className="absolute left-0 right-0 mt-2 bg-gray-900/95 backdrop-blur-xl border border-gray-800/50 rounded-xl p-4 z-20 shadow-xl">
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (date) {
                    setSelectedDate(date);
                    setShowCalendar(false);
                  }
                }}
                className="bg-transparent [&_.rdp-day]:text-white [&_.rdp-day_button:hover]:bg-[#37bd7e]/20 [&_.rdp-day_button:focus]:bg-[#37bd7e]/20 [&_.rdp-day_selected]:!bg-[#37bd7e] [&_.rdp-day_selected]:hover:!bg-[#2da76c] [&_.rdp-caption]:text-white [&_.rdp-head_cell]:text-gray-400"
              />
            </div>
          )}
        </div>

        {/* Meeting-specific fields - Compact */}
        {selectedAction === 'meeting' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-400">
                Type <span className="text-red-500">*</span>
              </label>
              <select
                required
                className="w-full bg-gray-800/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/50 transition-colors"
                value={formData.details}
                onChange={(e) => setFormData({...formData, details: e.target.value})}
              >
                <option value="">Select type</option>
                <option value="Discovery">Discovery</option>
                <option value="Demo">Demo</option>
                <option value="Follow-up">Follow-up</option>
                <option value="Proposal">Proposal Review</option>
                <option value="Client Call">Client Call</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-400">
                Status
              </label>
              <select
                className="w-full bg-gray-800/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/50 transition-colors"
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value})}
              >
                <option value="completed">Completed</option>
                <option value="pending">Scheduled</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No Show</option>
              </select>
            </div>
          </div>
        )}

        {/* Proposal-specific fields - Compact */}
        {selectedAction === 'proposal' && (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-400">
              Proposal Value (£)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Enter proposal value"
              className="w-full bg-gray-800/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 transition-colors"
              value={formData.amount || ''}
              onChange={(e) => setFormData({...formData, amount: e.target.value})}
            />
          </div>
        )}

        {/* Sale-specific fields - Compact with both inputs */}
        {selectedAction === 'sale' && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-400">
                  Monthly Subscription (£)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full bg-gray-800/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-colors"
                  value={formData.monthlyMrr || ''}
                  onChange={(e) => setFormData({...formData, monthlyMrr: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-400">
                  One-off Amount (£)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full bg-gray-800/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-colors"
                  value={formData.oneOffRevenue || ''}
                  onChange={(e) => setFormData({...formData, oneOffRevenue: e.target.value})}
                />
              </div>
            </div>
            {(formData.monthlyMrr || formData.oneOffRevenue) && (
              <div className="px-2 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <p className="text-xs text-emerald-400">
                  Deal Value: £{calculateDealValue()}
                  {formData.monthlyMrr && <span className="text-emerald-300/60 text-xs"> (3mo LTV)</span>}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Company Information - Required */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-400">
              Company Name <span className="text-gray-500 text-xs">(or use website below)</span>
            </label>
            <input
              type="text"
              placeholder="Acme Inc."
              className={cn(
                "w-full bg-gray-800/50 border rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50 transition-colors",
                validationErrors.client_name 
                  ? "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20" 
                  : !formData.client_name && selectedAction
                    ? 'border-amber-500/50' 
                    : 'border-gray-600/50'
              )}
              value={formData.client_name || ''}
              onChange={(e) => setFormData({...formData, client_name: e.target.value})}
              required
            />
            {validationErrors.client_name && (
              <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {validationErrors.client_name}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-400">
              Website
            </label>
            <input
              type="text"
              placeholder="www.acme.com"
              className="w-full bg-gray-800/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50 transition-colors"
              value={formData.company_website || ''}
              onChange={(e) => {
                let website = e.target.value.trim();
                
                // Auto-add www. if user enters a domain without it
                if (website && !website.startsWith('www.') && !website.startsWith('http')) {
                  // Check if it looks like a domain (has a dot and no spaces)
                  if (website.includes('.') && !website.includes(' ')) {
                    website = `www.${website}`;
                  }
                }
                
                setFormData({...formData, company_website: website});
              }}
            />
          </div>
        </div>

        {/* Deal Information - Optional */}
        <details className="group">
          <summary className="cursor-pointer list-none flex items-center justify-between p-3 bg-gray-800/30 rounded-xl hover:bg-gray-800/50 transition-colors">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-medium text-gray-300">Deal Details</span>
              <span className="text-xs text-gray-500">(Optional)</span>
            </div>
            <div className="text-xs text-purple-400">
              {selectedAction === 'sale' ? 'Signed stage' : selectedAction === 'proposal' ? 'Opportunity stage' : 'SQL stage'}
            </div>
          </summary>
          <div className="mt-2 space-y-2 p-3">
            <input
              type="text"
              placeholder={`Deal name (auto-generated if empty)`}
              className="w-full bg-gray-800/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50 transition-colors"
              value={formData.deal_name || ''}
              onChange={(e) => setFormData({...formData, deal_name: e.target.value})}
            />
          </div>
        </details>

        {/* Notes - Compact */}
        <div className="space-y-1">
          <textarea
            rows={2}
            placeholder="Additional notes (optional)..."
            className="w-full bg-gray-800/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-[#37bd7e]/20 focus:border-[#37bd7e]/50 transition-colors resize-none"
            value={formData.description || ''}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 py-2.5 px-4 bg-gray-800/30 text-gray-300 rounded-lg hover:bg-gray-700/50 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              "flex-1 py-2.5 px-4 text-white rounded-lg transition-all text-sm font-medium shadow-lg flex items-center justify-center gap-2",
              submitStatus === 'success' 
                ? "bg-green-600 hover:bg-green-700"
                : isSubmitting
                  ? "bg-gray-600 cursor-not-allowed"
                  : "bg-gradient-to-r from-[#37bd7e] to-[#2da76c] hover:from-[#2da76c] hover:to-[#228b57]"
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : submitStatus === 'success' ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Created!
              </>
            ) : (
              <>
                Create {selectedAction === 'sale' ? 'Sale' : selectedAction === 'meeting' ? 'Meeting' : 'Proposal'}
              </>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
}