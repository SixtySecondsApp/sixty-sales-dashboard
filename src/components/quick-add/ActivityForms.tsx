import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Users, FileText, PoundSterling, Calendar, Loader2, CheckCircle2, AlertCircle, Briefcase, Phone, UserPlus, Hash } from 'lucide-react';
import { format, addDays, addWeeks } from 'date-fns';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { QuickAddFormData, ValidationErrors } from './types';

interface ActivityFormsProps {
  selectedAction: 'meeting' | 'proposal' | 'sale' | 'outbound';
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
      case 'outbound': return <Phone className="w-5 h-5 text-blue-500" />;
    }
  };

  const getActionTitle = () => {
    switch (selectedAction) {
      case 'meeting': return 'Add Meeting';
      case 'proposal': return 'Add Proposal';
      case 'sale': return 'Add Sale';
      case 'outbound': return 'Add Outbound';
    }
  };

  const getDateLabel = () => {
    switch (selectedAction) {
      case 'meeting': return 'Meeting Date';
      case 'proposal': return 'Proposal Date';
      case 'sale': return 'Sale Date';
      case 'outbound': return 'Outbound Date';
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
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
            >
              <ArrowRight className="w-4 h-4 text-gray-500 dark:text-gray-400 rotate-180" />
            </button>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                {getActionIcon()} {getActionTitle()}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-600 dark:text-gray-400">for</span>
                <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                  {selectedContact.full_name ||
                   (selectedContact.first_name || selectedContact.last_name ?
                    `${selectedContact.first_name || ''} ${selectedContact.last_name || ''}`.trim() :
                    selectedContact.email)}
                </span>
                {selectedContact.company && (
                  <span className="text-sm text-gray-500 dark:text-gray-500">• {typeof selectedContact.company === 'string' ? selectedContact.company : (selectedContact.company as any)?.name || 'Company'}</span>
                )}
                <button
                  type="button"
                  onClick={onChangeContact}
                  className="text-xs text-gray-600 hover:text-emerald-700 dark:text-gray-400 dark:hover:text-emerald-400 ml-2"
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
            <label className="text-sm font-medium text-gray-700 dark:text-gray-400">
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
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-600 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                      : 'bg-white dark:bg-gray-800/50 border-gray-300 dark:border-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
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
            className="w-full bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-xl px-3 py-2.5 text-gray-900 dark:text-white text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</span>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">Change</span>
          </button>

          {showCalendar && (
            <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-xl p-4 z-20 shadow-sm dark:shadow-none">
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (date) {
                    setSelectedDate(date);
                    setShowCalendar(false);
                  }
                }}
                className="bg-transparent [&_.rdp-day]:text-gray-900 dark:[&_.rdp-day]:text-white [&_.rdp-day_button:hover]:bg-emerald-100 dark:[&_.rdp-day_button:hover]:bg-emerald-500/10 [&_.rdp-day_button:focus]:bg-emerald-100 dark:[&_.rdp-day_button:focus]:bg-emerald-500/10 [&_.rdp-day_selected]:!bg-emerald-600 dark:[&_.rdp-day_selected]:!bg-emerald-500/10 [&_.rdp-day_selected]:hover:!bg-emerald-700 dark:[&_.rdp-day_selected]:hover:!bg-emerald-500/20 [&_.rdp-caption]:text-gray-900 dark:[&_.rdp-caption]:text-white [&_.rdp-head_cell]:text-gray-600 dark:[&_.rdp-head_cell]:text-gray-400"
              />
            </div>
          )}
        </div>

        {/* Meeting-specific fields - Compact */}
        {selectedAction === 'meeting' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-400">
                Type <span className="text-red-500">*</span>
              </label>
              <select
                required
                className="w-full bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/50 transition-colors"
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
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-400">
                Status
              </label>
              <select
                className="w-full bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/50 transition-colors"
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
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-400">
              Proposal Value (£)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Enter proposal value"
              className="w-full bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 transition-colors"
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
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-400">
                  Monthly Subscription (£)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-colors"
                  value={formData.monthlyMrr || ''}
                  onChange={(e) => setFormData({...formData, monthlyMrr: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-400">
                  One-off Amount (£)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-colors"
                  value={formData.oneOffRevenue || ''}
                  onChange={(e) => setFormData({...formData, oneOffRevenue: e.target.value})}
                />
              </div>
            </div>
            {(formData.monthlyMrr || formData.oneOffRevenue) && (
              <div className="px-2 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-lg">
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  Deal Value: £{calculateDealValue()}
                  {formData.monthlyMrr && <span className="text-emerald-600/70 dark:text-emerald-300/60 text-xs"> (3mo LTV)</span>}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Outbound-specific fields */}
        {selectedAction === 'outbound' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-400">
                  Outbound Type
                </label>
                <select
                  className="w-full bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-colors"
                  value={formData.outboundType || 'Call'}
                  onChange={(e) => setFormData({...formData, outboundType: e.target.value})}
                >
                  <option value="Call">Call</option>
                  <option value="Email">Email</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="SMS">SMS</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-400">
                  Attempt #
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  placeholder="1"
                  className="w-full bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-colors"
                  value={formData.outboundCount || '1'}
                  onChange={(e) => setFormData({...formData, outboundCount: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-400">
                Outbound Details
              </label>
              <textarea
                rows={2}
                placeholder="Cold outreach, follow-up call, etc..."
                className="w-full bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-colors resize-none"
                value={formData.details || ''}
                onChange={(e) => setFormData({...formData, details: e.target.value})}
              />
            </div>
          </div>
        )}

        {/* Company Information - Required */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-400">
              Company Name <span className="text-gray-500 dark:text-gray-500 text-xs">(or use website below)</span>
            </label>
            <input
              type="text"
              placeholder="Acme Inc."
              className={cn(
                "w-full bg-white dark:bg-gray-800/50 border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50 transition-colors",
                validationErrors.client_name
                  ? "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20"
                  : !formData.client_name && selectedAction
                    ? 'border-amber-500/50'
                    : 'border-gray-300 dark:border-gray-700/50'
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
            <label className="text-sm font-medium text-gray-700 dark:text-gray-400">
              Website
            </label>
            <input
              type="text"
              placeholder="www.acme.com"
              className="w-full bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50 transition-colors"
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
          <summary className="cursor-pointer list-none flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-800/30 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-800/50 transition-colors">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Deal Details</span>
              <span className="text-xs text-gray-500 dark:text-gray-500">(Optional)</span>
            </div>
            <div className="text-xs text-purple-600 dark:text-purple-400">
              {selectedAction === 'sale' ? 'Signed stage' : selectedAction === 'proposal' ? 'Opportunity stage' : 'SQL stage'}
            </div>
          </summary>
          <div className="mt-2 space-y-2 p-3">
            <input
              type="text"
              placeholder={`Deal name (auto-generated if empty)`}
              className="w-full bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50 transition-colors"
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
            className="w-full bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-colors resize-none"
            value={formData.description || ''}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 py-2.5 px-4 bg-gray-200 dark:bg-gray-800/30 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700/50 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              "flex-1 py-2.5 px-4 text-white rounded-lg transition-all text-sm font-medium shadow-sm flex items-center justify-center gap-2",
              submitStatus === 'success'
                ? "bg-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border dark:border-emerald-500/20 hover:bg-emerald-700 dark:hover:bg-emerald-500/20"
                : isSubmitting
                  ? "bg-gray-600 dark:bg-gray-700 cursor-not-allowed"
                  : "bg-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border dark:border-emerald-500/20 hover:bg-emerald-700 dark:hover:bg-emerald-500/20"
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

interface OutboundFormProps {
  formData: QuickAddFormData;
  setFormData: (data: QuickAddFormData) => void;
  validationErrors: ValidationErrors;
  isSubmitting: boolean;
  submitStatus: 'idle' | 'success' | 'error';
  onSubmit: (e: React.FormEvent) => Promise<void>;
  onBack: () => void;
  onAddContact: () => void;
  selectedContact: any;
  onChangeContact: () => void;
}

export function OutboundForm({
  formData,
  setFormData,
  validationErrors,
  isSubmitting,
  submitStatus,
  onSubmit,
  onBack,
  onAddContact,
  selectedContact,
  onChangeContact
}: OutboundFormProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Phone className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Log Outbound Activity</h3>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="text-gray-400 hover:text-white transition-colors p-2"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
          </button>
        </div>

        {/* Contact Selection (Optional) */}
        <div className="bg-gray-100 dark:bg-gray-800/30 rounded-lg p-4 border border-gray-300 dark:border-gray-700/50">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-400">Contact (Optional)</label>
            {selectedContact && (
              <button
                type="button"
                onClick={onChangeContact}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Change Contact
              </button>
            )}
          </div>
          
          {selectedContact ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-violet-100 dark:bg-violet-500/20 rounded-full flex items-center justify-center">
                <Users className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {selectedContact.full_name ||
                   (selectedContact.first_name || selectedContact.last_name ?
                    `${selectedContact.first_name || ''} ${selectedContact.last_name || ''}`.trim() :
                    selectedContact.email)}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{selectedContact.email}</p>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={onAddContact}
              className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors text-sm"
            >
              <UserPlus className="w-4 h-4" />
              Add Contact (Optional)
            </button>
          )}
        </div>

        {/* Outbound Activity Details */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-400">
              Activity Type <span className="text-red-500">*</span>
            </label>
            <select
              required
              className="w-full bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-colors"
              value={formData.outboundType || 'Call'}
              onChange={(e) => setFormData({...formData, outboundType: e.target.value})}
            >
              <option value="Call">Cold Calls</option>
              <option value="Email">Cold Emails</option>
              <option value="LinkedIn">LinkedIn Messages</option>
              <option value="SMS">SMS Messages</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-400">
              Quantity <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400" />
              <input
                type="number"
                required
                min="1"
                max="500"
                placeholder="50"
                className="w-full bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg pl-10 pr-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-colors"
                value={formData.outboundCount || ''}
                onChange={(e) => setFormData({...formData, outboundCount: e.target.value})}
              />
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-400">
            Session Notes
          </label>
          <textarea
            rows={3}
            placeholder="e.g., '50 cold calls to tech companies in London. 5 callbacks scheduled, 12 answered calls, good response rate'"
            className="w-full bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-colors resize-none"
            value={formData.details || ''}
            onChange={(e) => setFormData({...formData, details: e.target.value})}
          />
        </div>

        {/* Company/Client Name (if no contact selected) */}
        {!selectedContact && (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-400">
              Target Company/Client <span className="text-gray-500 dark:text-gray-500 text-xs">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g., 'Tech startups in London' or 'Acme Inc.'"
              className="w-full bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-colors"
              value={formData.client_name || ''}
              onChange={(e) => setFormData({...formData, client_name: e.target.value})}
            />
          </div>
        )}

        {/* Submit Button */}
        <motion.button
          type="submit"
          disabled={isSubmitting}
          whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-colors",
            isSubmitting
              ? "bg-blue-500/30 text-blue-300 cursor-not-allowed"
              : submitStatus === 'success'
              ? "bg-emerald-600 text-white"
              : submitStatus === 'error'
              ? "bg-red-600 text-white"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          )}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Logging Activity...
            </>
          ) : submitStatus === 'success' ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Activity Logged!
            </>
          ) : submitStatus === 'error' ? (
            <>
              <AlertCircle className="w-4 h-4" />
              Try Again
            </>
          ) : (
            <>
              <Phone className="w-4 h-4" />
              Log {formData.outboundCount || 1} {formData.outboundType || 'Activities'}
            </>
          )}
        </motion.button>
      </form>
    </motion.div>
  );
}