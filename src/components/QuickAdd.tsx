import { useState } from 'react';
import { Plus, X, Phone, FileText, Users, PoundSterling, CheckSquare, Calendar, Clock, Target, Flag, Zap, Timer, Coffee, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useActivities } from '@/lib/hooks/useActivities';
import { useTasks } from '@/lib/hooks/useTasks';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, addDays, addHours, setHours, setMinutes, startOfWeek, addWeeks } from 'date-fns';
import { useUser } from '@/lib/hooks/useUser';
import { toast } from 'sonner';
import { useNavigate, useLocation } from 'react-router-dom';
import { IdentifierField, IdentifierType } from './IdentifierField';
import { DealSelector } from './DealSelector';
import { DealWizard } from './DealWizard';

interface QuickAddProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickAdd({ isOpen, onClose }: QuickAddProps) {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [showDealWizard, setShowDealWizard] = useState(false);
  const [formData, setFormData] = useState({
    type: 'outbound',
    client_name: '',
    details: '',
    amount: '',
    oneOffRevenue: '',
    monthlyMrr: '',
    saleType: 'one-off',
    outboundCount: '1',
    outboundType: 'Call',
    contactIdentifier: '',
    contactIdentifierType: 'unknown' as IdentifierType,
    status: 'completed',
    // Task specific fields
    title: '',
    description: '',
    task_type: 'call' as const,
    priority: 'medium' as const,
    due_date: '',
    contact_name: '',
    company: '',
    // Deal linking
    deal_id: null as string | null,
    selectedDeal: null as any
  });

  // Reset selectedAction when modal is closed
  const handleClose = () => {
    setSelectedAction(null);
    setFormData({
      type: 'outbound',
      client_name: '',
      details: '',
      amount: '',
      oneOffRevenue: '',
      monthlyMrr: '',
      saleType: 'one-off',
      outboundCount: '1',
      outboundType: 'Call',
      contactIdentifier: '',
      contactIdentifierType: 'unknown',
      status: 'completed',
      title: '',
      description: '',
      task_type: 'call',
      priority: 'medium',
      due_date: '',
      contact_name: '',
      company: '',
      deal_id: null,
      selectedDeal: null
    });
    onClose();
  };

  const location = useLocation();
  const navigate = useNavigate();

  const reloadPage = () => {
    navigate(location.pathname, { replace: true });
  };

  const { addActivity, addSale } = useActivities();
  const { createTask } = useTasks();
  const { userData } = useUser();

  // Task type options with icons and colors
  const taskTypes = [
    { value: 'call', label: 'Phone Call', icon: '📞', color: 'bg-blue-500/20 text-blue-400', iconColor: 'text-blue-500' },
    { value: 'email', label: 'Email', icon: '✉️', color: 'bg-green-500/20 text-green-400', iconColor: 'text-green-500' },
    { value: 'meeting', label: 'Meeting', icon: '🤝', color: 'bg-purple-500/20 text-purple-400', iconColor: 'text-purple-500' },
    { value: 'follow_up', label: 'Follow Up', icon: '🔄', color: 'bg-orange-500/20 text-orange-400', iconColor: 'text-orange-500' },
    { value: 'demo', label: 'Demo', icon: '🎯', color: 'bg-indigo-500/20 text-indigo-400', iconColor: 'text-indigo-500' },
    { value: 'proposal', label: 'Proposal', icon: '📋', color: 'bg-yellow-500/20 text-yellow-400', iconColor: 'text-yellow-500' },
    { value: 'general', label: 'General', icon: '⚡', color: 'bg-gray-500/20 text-gray-400', iconColor: 'text-gray-400' },
  ];

  // Priority options with visual indicators
  const priorities = [
    { value: 'low', label: 'Low', icon: '🟢', color: 'bg-green-500/20 text-green-400 border-green-500/30', ringColor: 'ring-green-500/30' },
    { value: 'medium', label: 'Medium', icon: '🟡', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', ringColor: 'ring-yellow-500/30' },
    { value: 'high', label: 'High', icon: '🟠', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', ringColor: 'ring-orange-500/30' },
    { value: 'urgent', label: 'Urgent', icon: '🔴', color: 'bg-red-500/20 text-red-400 border-red-500/30', ringColor: 'ring-red-500/30' },
  ];

  // Smart quick date options
  const getSmartQuickDates = () => {
    const now = new Date();
    return [
      {
        label: 'In 1 Hour',
        value: format(addHours(now, 1), "yyyy-MM-dd'T'HH:mm"),
        icon: '⏰',
        description: 'Quick follow up'
      },
      {
        label: 'End of Day',
        value: format(setHours(setMinutes(now, 0), 17), "yyyy-MM-dd'T'HH:mm"),
        icon: '🌅',
        description: 'Before close'
      },
      {
        label: 'Tomorrow 9AM',
        value: format(setHours(setMinutes(addDays(now, 1), 0), 9), "yyyy-MM-dd'T'HH:mm"),
        icon: '📅',
        description: 'Start fresh'
      },
      {
        label: 'Next Monday',
        value: format(setHours(setMinutes(addDays(startOfWeek(addWeeks(now, 1)), 1), 0), 9), "yyyy-MM-dd'T'HH:mm"),
        icon: '📆',
        description: 'Next week'
      }
    ];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedAction === 'task') {
      // Validate task fields
      if (!formData.title.trim()) {
        toast.error('Please enter a task title');
        return;
      }

      try {
        const taskData = {
          title: formData.title,
          description: formData.description,
          task_type: formData.task_type,
          priority: formData.priority,
          due_date: formData.due_date || undefined,
          assigned_to: userData?.id || '',
          contact_name: formData.contact_name || undefined,
          company: formData.company || undefined,
        };

        await createTask(taskData);
        toast.success('🎉 Task created successfully!');
        handleClose();
        return;
      } catch (error) {
        console.error('Error creating task:', error);
        toast.error('Failed to create task. Please try again.');
        return;
      }
    }
    
    // Existing validation for other actions
    if (selectedAction === 'meeting' && !formData.details) {
      toast.error('Please select a meeting type');
      return;
    }
    
    // Require deal for sales and proposals
    if ((selectedAction === 'sale' || selectedAction === 'proposal') && !formData.deal_id) {
      toast.error(`Please select or create a deal for this ${selectedAction}`);
      return;
    }
    
    // For non-outbound, require identifier
    if (selectedAction !== 'outbound') {
      if (!formData.contactIdentifier) {
        toast.error('Please provide a contact identifier (email, phone number, or LinkedIn URL)');
        return;
      }
      if (formData.contactIdentifierType === 'unknown') {
        toast.error('Please enter a valid email, phone number, or LinkedIn URL');
        return;
      }
    }

    try {
      if (selectedAction === 'outbound') {
        // Always add the activity, but only pass identifier fields if present
        await addActivity({
          type: 'outbound',
          client_name: formData.client_name || 'Unknown',
          details: formData.outboundType,
          quantity: parseInt(formData.outboundCount) || 1,
          date: selectedDate.toISOString(),
          deal_id: formData.deal_id,
          // Only include identifier fields if present
          ...(formData.contactIdentifier
            ? {
                contactIdentifier: formData.contactIdentifier,
                contactIdentifierType: formData.contactIdentifierType
              }
            : {})
        });
      } else if (selectedAction === 'sale') {
        // Calculate total amount from oneOffRevenue and monthlyMrr
        const oneOff = parseFloat(formData.oneOffRevenue || '0') || 0;
        const monthly = parseFloat(formData.monthlyMrr || '0') || 0;
        // BUSINESS RULE: LTV = (monthlyMRR * 3) + oneOffRevenue
        // This gives 3x monthly subscription value PLUS 1x one-time deal value
        const totalAmount = (monthly * 3) + oneOff;
        
        const saleData = {
          client_name: formData.client_name,
          amount: totalAmount,
          details: formData.details || `${formData.saleType} Sale`,
          saleType: formData.saleType as 'one-off' | 'subscription' | 'lifetime',
          date: selectedDate.toISOString(),
          deal_id: formData.deal_id,
          contactIdentifier: formData.contactIdentifier,
          contactIdentifierType: formData.contactIdentifierType
        };
        await addSale(saleData);
      } else if (selectedAction) {
        // Calculate total amount for proposals from oneOffRevenue and monthlyMrr
        let proposalAmount;
        if (selectedAction === 'proposal') {
          const oneOff = parseFloat(formData.oneOffRevenue || '0') || 0;
          const monthly = parseFloat(formData.monthlyMrr || '0') || 0;
          // BUSINESS RULE: LTV = (monthlyMRR * 3) + oneOffRevenue
          // This gives 3x monthly subscription value PLUS 1x one-time deal value
          proposalAmount = (monthly * 3) + oneOff;
        }

        await addActivity({
          type: selectedAction as 'meeting' | 'proposal',
          client_name: formData.client_name || 'Unknown',
          details: formData.details,
          amount: selectedAction === 'proposal' ? proposalAmount : undefined,
          date: selectedDate.toISOString(),
          deal_id: formData.deal_id,
          contactIdentifier: formData.contactIdentifier,
          contactIdentifierType: formData.contactIdentifierType,
          status: selectedAction === 'meeting' ? (formData.status as 'completed' | 'pending' | 'cancelled' | 'no_show') : 'completed'
        });
      }
      
      handleClose();
    } catch (error) {
      toast.error('Failed to add activity');
    }
  };

  const quickActions = [
    { id: 'deal', icon: Target, label: 'Create Deal', color: 'purple' },
    { id: 'task', icon: CheckSquare, label: 'Add Task', color: 'indigo' },
    { id: 'sale', icon: PoundSterling, label: 'Add Sale', color: 'emerald' },
    { id: 'outbound', icon: Phone, label: 'Add Outbound', color: 'blue' },
    { id: 'meeting', icon: Users, label: 'Add Meeting', color: 'violet' },
    { id: 'proposal', icon: FileText, label: 'Add Proposal', color: 'orange' },
  ];

  const handleQuickDate = (dateValue: string) => {
    setFormData(prev => ({
      ...prev,
      due_date: dateValue
    }));
  };

  const selectedTaskType = taskTypes.find(t => t.value === formData.task_type);
  const selectedPriority = priorities.find(p => p.value === formData.priority);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
          onClick={handleClose}
        >
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{
              type: 'spring',
              damping: 30,
              stiffness: 300,
              mass: 0.8
            }}
            className="relative bg-gray-900/95 border border-gray-800/50 rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 w-full sm:max-w-2xl backdrop-blur-xl sm:m-4 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 via-gray-900/70 to-gray-900/30 rounded-3xl -z-10" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(74,74,117,0.15),transparent)] rounded-3xl -z-10" />
            
            <motion.div 
              className="w-12 h-1 rounded-full bg-gray-800 absolute -top-8 left-1/2 -translate-x-1/2 sm:hidden"
              initial={{ width: '2rem' }}
              animate={{ width: '3rem' }}
              transition={{
                type: 'spring',
                stiffness: 400,
                damping: 30,
                repeat: Infinity,
                repeatType: 'reverse'
              }}
            />
            
            <div className="flex justify-between items-center mb-6 sm:mb-8">
              <div className="w-12 h-1 rounded-full bg-gray-800 absolute -top-8 left-1/2 -translate-x-1/2 sm:hidden" />
              <h2 className="text-xl font-semibold text-white/90 tracking-wide">Quick Add</h2>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-gray-800/50 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {!selectedAction ? (
              <motion.div 
                className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4"
                variants={{
                  show: {
                    transition: {
                      staggerChildren: 0.1
                    }
                  }
                }}
                initial="hidden"
                animate="show"
              >
                {quickActions.map((action) => (
                  <motion.button
                    key={action.id}
                    variants={{
                      hidden: { y: 20, opacity: 0 },
                      show: { y: 0, opacity: 1 }
                    }}
                    transition={{
                      type: 'spring',
                      stiffness: 400,
                      damping: 30
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      if (action.id === 'deal' || action.id === 'proposal' || action.id === 'sale') {
                        setShowDealWizard(true);
                        setSelectedAction(action.id);
                      } else {
                        setSelectedAction(action.id);
                      }
                    }}
                    className={`flex flex-col items-center justify-center p-4 sm:p-6 rounded-xl ${
                      action.color === 'blue'
                        ? 'bg-blue-400/5'
                        : action.color === 'orange'
                          ? 'bg-orange-500/10'
                          : action.color === 'indigo'
                            ? 'bg-indigo-500/10'
                            : action.color === 'purple'
                              ? 'bg-purple-500/10'
                              : `bg-${action.color}-500/10`
                    } border ${
                      action.color === 'blue'
                        ? 'border-blue-500/10'
                        : action.color === 'orange'
                          ? 'border-orange-500/20'
                          : action.color === 'indigo'
                            ? 'border-indigo-500/20'
                            : action.color === 'purple'
                              ? 'border-purple-500/20'
                              : `border-${action.color}-500/20`
                    } hover:bg-${action.color}-500/20 transition-all duration-300 group backdrop-blur-sm`}
                  >
                    <div className={`p-3 rounded-xl ${
                      action.color === 'blue'
                        ? 'bg-blue-400/5'
                        : action.color === 'orange'
                          ? 'bg-orange-500/10'
                          : action.color === 'indigo'
                            ? 'bg-indigo-500/10'
                            : action.color === 'purple'
                              ? 'bg-purple-500/10'
                              : `bg-${action.color}-500/10`
                    } transition-all duration-300 group-hover:scale-110 group-hover:bg-${action.color}-500/20 ring-1 ${
                      action.color === 'blue'
                        ? 'ring-blue-500/50 group-hover:ring-blue-500/60'
                        : action.color === 'orange'
                          ? 'ring-orange-500/30 group-hover:ring-orange-500/50'
                          : action.color === 'indigo'
                            ? 'ring-indigo-500/30 group-hover:ring-indigo-500/50'
                            : action.color === 'purple'
                              ? 'ring-purple-500/30 group-hover:ring-purple-500/50'
                              : `ring-${action.color}-500/30 group-hover:ring-${action.color}-500/50`
                    } backdrop-blur-sm mb-3`}>
                      <action.icon className={`w-6 h-6 ${
                        action.color === 'blue'
                          ? 'text-blue-500'
                          : action.color === 'orange'
                            ? 'text-orange-500'
                            : action.color === 'indigo'
                              ? 'text-indigo-500'
                              : action.color === 'purple'
                                ? 'text-purple-500'
                                : `text-${action.color}-500`
                      }`} />
                    </div>
                    <span className="text-sm font-medium text-white/90">{action.label}</span>
                  </motion.button>
                ))}
              </motion.div>
            ) : showDealWizard ? (
              // Don't show any form when DealWizard is active
              null
            ) : selectedAction === 'task' ? (
              // Amazing Task Creation Form
              <motion.form
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                onSubmit={handleSubmit}
                className="space-y-6"
              >
                {/* Header with back button */}
                <div className="flex items-center gap-3 mb-6">
                  <button
                    type="button"
                    onClick={() => setSelectedAction(null)}
                    className="p-2 hover:bg-gray-800/50 rounded-xl transition-colors"
                  >
                    <ArrowRight className="w-5 h-5 text-gray-400 rotate-180" />
                  </button>
                  <div>
                    <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                      <CheckSquare className="w-6 h-6 text-indigo-500" />
                      Create New Task
                    </h3>
                    <p className="text-gray-400 text-sm">Set up your task quickly and efficiently</p>
                  </div>
                </div>

                {/* Task Title */}
                <div className="space-y-3">
                  <label className="text-lg font-semibold text-white flex items-center gap-2">
                    <Target className="w-5 h-5 text-indigo-400" />
                    What needs to be done? *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Call John about the proposal"
                    className="w-full bg-gray-800/50 border border-gray-600/50 text-white text-lg p-4 rounded-xl focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-gray-400 transition-all"
                    required
                  />
                </div>

                {/* Task Type & Priority Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Task Type */}
                  <div className="space-y-3">
                    <label className="text-base font-medium text-white flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-400" />
                      Task Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {taskTypes.slice(0, 4).map((type) => (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, task_type: type.value as any }))}
                          className={`p-3 rounded-xl border transition-all ${
                            formData.task_type === type.value
                              ? `${type.color} border-current`
                              : 'bg-gray-800/30 border-gray-600/30 text-gray-400 hover:bg-gray-700/50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">{type.icon}</span>
                            <span className="text-xs font-medium">{type.label}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {taskTypes.slice(4).map((type) => (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, task_type: type.value as any }))}
                          className={`p-3 rounded-xl border transition-all ${
                            formData.task_type === type.value
                              ? `${type.color} border-current`
                              : 'bg-gray-800/30 border-gray-600/30 text-gray-400 hover:bg-gray-700/50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">{type.icon}</span>
                            <span className="text-xs font-medium">{type.label}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Priority */}
                  <div className="space-y-3">
                    <label className="text-base font-medium text-white flex items-center gap-2">
                      <Flag className="w-4 h-4 text-red-400" />
                      Priority Level
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {priorities.map((priority) => (
                        <button
                          key={priority.value}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, priority: priority.value as any }))}
                          className={`p-3 rounded-xl border transition-all ${
                            formData.priority === priority.value
                              ? `${priority.color} ${priority.ringColor} ring-2`
                              : 'bg-gray-800/30 border-gray-600/30 text-gray-400 hover:bg-gray-700/50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">{priority.icon}</span>
                            <span className="text-xs font-medium">{priority.label}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Due Date Section */}
                <div className="space-y-4">
                  <label className="text-base font-medium text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-green-400" />
                    When is this due?
                  </label>
                  
                  {/* Smart Quick Date Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    {getSmartQuickDates().map((quick) => (
                      <button
                        key={quick.label}
                        type="button"
                        onClick={() => handleQuickDate(quick.value)}
                        className={`p-3 rounded-xl border transition-all group ${
                          formData.due_date === quick.value
                            ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                            : 'bg-gray-800/30 border-gray-600/30 text-gray-300 hover:bg-gray-700/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{quick.icon}</span>
                          <div className="text-left">
                            <div className="text-sm font-medium">{quick.label}</div>
                            <div className="text-xs opacity-70">{quick.description}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  
                  {/* Custom Date Input */}
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400">Or set a custom date & time</label>
                    <input
                      type="datetime-local"
                      value={formData.due_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                      className="w-full bg-gray-800/50 border border-gray-600/50 text-white p-3 rounded-xl focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-3">
                  <label className="text-base font-medium text-white">
                    Additional Details (Optional)
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Any additional context or notes..."
                    rows={3}
                    className="w-full bg-gray-800/50 border border-gray-600/50 text-white p-3 rounded-xl focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-gray-400 transition-all resize-none"
                  />
                </div>

                {/* Contact & Company Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-400">Contact Name</label>
                    <input
                      type="text"
                      value={formData.contact_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, contact_name: e.target.value }))}
                      placeholder="John Smith"
                      className="w-full bg-gray-800/30 border border-gray-600/30 text-white p-3 rounded-xl focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-gray-400 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-400">Company</label>
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                      placeholder="Acme Corp"
                      className="w-full bg-gray-800/30 border border-gray-600/30 text-white p-3 rounded-xl focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-gray-400 transition-all"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setSelectedAction(null)}
                    className="flex-1 py-3 px-4 bg-gray-800/50 border border-gray-600/50 text-gray-300 rounded-xl hover:bg-gray-700/50 transition-all font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all font-medium shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
                  >
                    <CheckSquare className="w-5 h-5" />
                    Create Task
                  </button>
                </div>
              </motion.form>
            ) : (
              <motion.form
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                onSubmit={handleSubmit}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-400/90">
                    Date
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCalendar(!showCalendar)}
                    className="w-full bg-gray-800/30 border border-gray-700/30 rounded-xl px-4 py-2.5 text-white text-left hover:bg-gray-800/50 transition-colors"
                  >
                    {format(selectedDate, 'MMMM d, yyyy')}
                  </button>
                  {showCalendar && (
                  <div className="absolute left-0 right-0 mt-2 bg-gray-900/95 backdrop-blur-xl border border-gray-800/50 rounded-xl p-3 z-10 shadow-xl">
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
                  </div>)}
                </div>

                {(selectedAction === 'sale' || selectedAction === 'meeting' || selectedAction === 'proposal') && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-400/90">
                      {selectedAction === 'sale' ? 'Client Name' : 'Prospect Name'}
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full bg-gray-800/30 border border-gray-700/30 rounded-xl px-4 py-2 text-white/90 focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent transition-colors hover:bg-gray-800/50"
                      value={formData.client_name}
                      onChange={(e) => setFormData({...formData, client_name: e.target.value})}
                    />
                  </div>
                )}

                {/* Deal Selector - Required for sales and proposals, optional for meetings */}
                {(selectedAction === 'sale' || selectedAction === 'meeting' || selectedAction === 'proposal') && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-400/90 flex items-center">
                      Pipeline Deal
                      {(selectedAction === 'sale' || selectedAction === 'proposal') && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <DealSelector
                      selectedDealId={formData.deal_id}
                      onDealSelect={(dealId, dealInfo) => {
                        setFormData({
                          ...formData, 
                          deal_id: dealId,
                          selectedDeal: dealInfo,
                          // Auto-populate client name from deal if available
                          client_name: dealInfo?.company || formData.client_name
                        });
                      }}
                      clientName={formData.client_name}
                      required={selectedAction === 'sale' || selectedAction === 'proposal'}
                      placeholder={
                        selectedAction === 'sale' 
                          ? 'Required: Select or create a deal...'
                          : selectedAction === 'proposal'
                          ? 'Required: Select or create a deal...'
                          : 'Optional: Link to a deal...'
                      }
                    />
                    {(selectedAction === 'sale' || selectedAction === 'proposal') && !formData.deal_id && (
                      <p className="text-xs text-gray-500 mt-1">
                        {selectedAction === 'sale' 
                          ? 'Link this sale to a pipeline deal for accurate tracking'
                          : 'Link this proposal to a pipeline deal for accurate tracking'
                        }
                      </p>
                    )}
                  </div>
                )}

                {/* Contact Identifier Field - added to all activity types */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-400/90 flex items-center">
                    Email Address
                    {selectedAction !== 'outbound' && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <IdentifierField
                    value={formData.contactIdentifier}
                    onChange={(value, type) => 
                      setFormData({
                        ...formData, 
                        contactIdentifier: value || '', 
                        contactIdentifierType: type
                      })
                    }
                    required={selectedAction !== 'outbound'}
                    placeholder={selectedAction !== 'outbound' ? 'Required: Enter email address' : 'Optional: Enter email address'}
                    label=""
                  />
                </div>
                
                {selectedAction === 'sale' && <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-400/90">
                    Sale Type
                  </label>
                  <select
                    required
                    className="w-full bg-gray-800/30 border border-gray-700/30 rounded-xl px-4 py-2 text-white/90 focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent transition-colors"
                    value={formData.saleType}
                    onChange={(e) => setFormData({...formData, saleType: e.target.value})}
                  >
                    <option value="one-off">One-off</option>
                    <option value="subscription">Subscription</option>
                    <option value="lifetime">Lifetime</option>
                  </select>
                </div>}

                {selectedAction === 'outbound' && (
                  <>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-400/90">
                        Outreach Type
                      </label>
                      <select
                        className="w-full bg-gray-800/30 border border-gray-700/30 rounded-xl px-4 py-2 text-white/90 focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent transition-colors"
                        value={formData.outboundType}
                        onChange={(e) => setFormData({...formData, outboundType: e.target.value})}
                      >
                        <option value="Call">Call</option>
                        <option value="Client Call">Client Call</option>
                        <option value="Email">Email</option>
                        <option value="LinkedIn">LinkedIn</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-400/90">
                        Contact Name (Optional)
                      </label>
                      <input
                        type="text"
                        className="w-full bg-gray-800/30 border border-gray-700/30 rounded-xl px-4 py-2 text-white/90 focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent transition-colors hover:bg-gray-800/50"
                        value={formData.client_name}
                        onChange={(e) => setFormData({...formData, client_name: e.target.value})}
                        placeholder="Leave blank if unknown"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-400/90">
                        Quantity
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        required
                        className="w-full bg-gray-800/30 border border-gray-700/30 rounded-xl px-4 py-2 text-white/90 focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent transition-colors hover:bg-gray-800/50"
                        value={formData.outboundCount}
                        onChange={(e) => setFormData({...formData, outboundCount: e.target.value})}
                      />
                    </div>
                  </>
                )}

                {selectedAction === 'meeting' && (
                  <>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-400/90">
                        Meeting Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        className="w-full bg-gray-800/30 border border-gray-700/30 rounded-xl px-4 py-2 text-white/90 focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent transition-colors"
                        value={formData.details}
                        onChange={(e) => setFormData({...formData, details: e.target.value})}
                      >
                        <option value="">Select meeting type</option>
                        <option value="Discovery">Discovery</option>
                        <option value="Demo">Demo</option>
                        <option value="Follow-up">Follow-up</option>
                        <option value="Proposal">Proposal</option>
                        <option value="Client Call">Client Call</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-400/90">
                        Status
                      </label>
                      <select
                        required
                        className="w-full bg-gray-800/30 border border-gray-700/30 rounded-xl px-4 py-2 text-white/90 focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent transition-colors"
                        value={formData.status}
                        onChange={(e) => setFormData({...formData, status: e.target.value})}
                      >
                        <option value="completed">Completed</option>
                        <option value="pending">Scheduled</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="no_show">No Show</option>
                      </select>
                    </div> 
                  </>
                )}

                {(selectedAction === 'sale' || selectedAction === 'proposal') && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-400/90">
                        One-off Revenue (£)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0"
                        className="w-full bg-gray-800/30 border border-gray-700/30 rounded-xl px-4 py-2 text-white/90 focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent transition-colors hover:bg-gray-800/50"
                        value={formData.oneOffRevenue || ''}
                        onChange={(e) => setFormData({...formData, oneOffRevenue: e.target.value})}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-400/90">
                        Monthly Recurring Revenue (£)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0"
                        className="w-full bg-gray-800/30 border border-gray-700/30 rounded-xl px-4 py-2 text-white/90 focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent transition-colors hover:bg-gray-800/50"
                        value={formData.monthlyMrr || ''}
                        onChange={(e) => setFormData({...formData, monthlyMrr: e.target.value})}
                      />
                    </div>
                    
                    {(formData.oneOffRevenue || formData.monthlyMrr) && (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                        <div className="text-sm text-emerald-400">
                          <span className="font-medium">Total Deal Value: </span>
                          £{(
                            (parseFloat(formData.oneOffRevenue || '0') || 0) + 
                            ((parseFloat(formData.monthlyMrr || '0') || 0) * 3)
                          ).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                        {formData.monthlyMrr && parseFloat(formData.monthlyMrr) > 0 && (
                          <div className="text-xs text-gray-400 mt-1">
                            Annual Value: £{(
                              (parseFloat(formData.oneOffRevenue || '0') || 0) + 
                              ((parseFloat(formData.monthlyMrr || '0') || 0) * 12)
                            ).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setSelectedAction(null)}
                    className="flex-1 py-3 px-4 bg-gray-800/30 text-gray-300 rounded-xl hover:bg-gray-700/50 transition-colors font-medium"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-[#37bd7e] to-[#2da76c] text-white rounded-xl hover:from-[#2da76c] hover:to-[#228b57] transition-all font-medium shadow-lg"
                  >
                    Add {selectedAction === 'sale' ? 'Sale' : selectedAction === 'outbound' ? 'Outbound' : selectedAction === 'meeting' ? 'Meeting' : 'Proposal'}
                  </button>
                </div>
              </motion.form>
            )}
          </motion.div>
          
          {/* Deal Wizard Modal */}
          <DealWizard
            isOpen={showDealWizard}
            onClose={() => {
              setShowDealWizard(false);
              // Reset to the initial selection screen
              setSelectedAction(null);
            }}
            onDealCreated={(deal) => {
              setShowDealWizard(false);
              
              // For 'deal' or 'proposal' action, reset and close properly
              if (selectedAction === 'deal' || selectedAction === 'proposal') {
                // Reset everything back to initial state
                handleClose();
                toast.success(selectedAction === 'deal' ? 'Deal created successfully!' : 'Proposal created successfully!');
              } else {
                // Update the deal selector with the new deal if we're in a deal-related action
                if (selectedAction === 'sale' || selectedAction === 'meeting') {
                  setFormData(prev => ({
                    ...prev,
                    deal_id: deal.id,
                    selectedDeal: deal,
                    client_name: deal.company || prev.client_name
                  }));
                }
              }
            }}
            initialData={{
              clientName: formData.client_name,
              contactEmail: formData.contactIdentifier,
              dealValue: parseFloat(formData.amount) || 0
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}