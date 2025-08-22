import React, { useState, useEffect } from 'react';
import { format, addDays, addWeeks, addMonths, isToday, isTomorrow, startOfWeek, addMinutes, setHours, setMinutes, startOfDay } from 'date-fns';
import { Calendar, Clock, User, Target, Star, Save, X, Zap, Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';

import { Task } from '@/lib/database/models';
import { useTasks } from '@/lib/hooks/useTasks';
import { useUser } from '@/lib/hooks/useUser';
import { useUsers } from '@/lib/hooks/useUsers';
import { useContacts } from '@/lib/hooks/useContacts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import logger from '@/lib/utils/logger';

interface TaskFormProps {
  task?: Task;
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated?: (task: Task) => void;
  dealId?: string;
  companyId?: string;
  contactId?: string;
  contactEmail?: string;
  contactName?: string;
  company?: string;
}

interface SimpleTaskFormData {
  title: string;
  description: string;
  task_type: Task['task_type'];
  priority: Task['priority'];
  due_date: string;
  assigned_to: string;
  // Optional context - simplified
  deal_id: string;
  contact_name: string;
  company: string;
}

const TaskForm: React.FC<TaskFormProps> = ({
  task,
  isOpen,
  onClose,
  onTaskCreated,
  dealId = '',
  companyId = '',
  contactId = '',
  contactEmail = '',
  contactName = '',
  company = ''
}) => {
  const { userData, isLoading: isUserLoading } = useUser();
  const { users } = useUsers();
  const { contacts } = useContacts();
  const { createTask, updateTask } = useTasks();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState<SimpleTaskFormData>({
    title: '',
    description: '',
    task_type: 'call',
    priority: 'medium',
    due_date: '',
    assigned_to: userData?.id || '',
    deal_id: dealId,
    contact_name: contactName,
    company: company
  });

  // Contact search states
  const [isClientSelected, setIsClientSelected] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [searchedContacts, setSearchedContacts] = useState<any[]>([]);
  const [selectedContact, setSelectedContact] = useState<any>(null);

  // Date picker states
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Quick due date options
  const quickDueDates = [
    { label: 'Today', value: format(new Date(), "yyyy-MM-dd'T'09:00") },
    { label: 'Tomorrow', value: format(addDays(new Date(), 1), "yyyy-MM-dd'T'09:00") },
    { label: 'Next Week', value: format(addDays(new Date(), 7), "yyyy-MM-dd'T'09:00") },
  ];

  // Task type options with icons and colors
  const taskTypes = [
    { value: 'call', label: 'Phone Call', icon: '📞', color: 'bg-blue-500/20 text-blue-400' },
    { value: 'email', label: 'Email', icon: '✉️', color: 'bg-green-500/20 text-green-400' },
    { value: 'meeting', label: 'Meeting', icon: '🤝', color: 'bg-purple-500/20 text-purple-400' },
    { value: 'follow_up', label: 'Follow Up', icon: '🔄', color: 'bg-orange-500/20 text-orange-400' },
    { value: 'demo', label: 'Demo', icon: '🎯', color: 'bg-indigo-500/20 text-indigo-400' },
    { value: 'proposal', label: 'Proposal', icon: '📋', color: 'bg-yellow-500/20 text-yellow-400' },
    { value: 'general', label: 'General', icon: '⚡', color: 'bg-gray-500/20 text-gray-400' },
  ];

  // Priority options with visual indicators
  const priorities = [
    { value: 'low', label: 'Low', icon: '🟢', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
    { value: 'medium', label: 'Medium', icon: '🟡', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    { value: 'high', label: 'High', icon: '🟠', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
    { value: 'urgent', label: 'Urgent', icon: '🔴', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  ];

  // Update form data when task prop changes
  useEffect(() => {
    if (task) {
      const taskDate = task.due_date ? new Date(task.due_date) : undefined;
      setFormData({
        title: task.title,
        description: task.description || '',
        task_type: task.task_type,
        priority: task.priority,
        due_date: task.due_date ? format(taskDate!, "yyyy-MM-dd'T'HH:mm") : '',
        assigned_to: task.assigned_to,
        deal_id: task.deal_id || '',
        contact_name: task.contact_name || '',
        company: task.company || ''
      });
      
      // Update date picker states
      if (taskDate) {
        setSelectedDate(taskDate);
        setSelectedTime(format(taskDate, 'HH:mm'));
      }
      
      // If task has client assignment, set up contact selection state
      if (task.assigned_to === 'client') {
        setIsClientSelected(true);
        if (task.contact_name) {
          setSelectedContact({
            id: contactId,
            full_name: task.contact_name,
            email: contactEmail,
            company: task.company
          });
          setContactSearchQuery(task.contact_name);
        }
      }
    } else {
      // Reset for new task with provided context
      setFormData({
        title: '',
        description: '',
        task_type: 'call',
        priority: 'medium',
        due_date: '',
        assigned_to: userData?.id || 'current-user',
        deal_id: dealId,
        contact_name: contactName,
        company: company
      });
      
      // Reset date picker states
      setSelectedDate(undefined);
      setSelectedTime('09:00');
      
      // Reset contact selection states
      setIsClientSelected(false);
      setSelectedContact(null);
      setContactSearchQuery('');
      setSearchedContacts([]);
    }
  }, [task, userData?.id, dealId, contactName, company, contactId, contactEmail]);

  const handleInputChange = (field: keyof SimpleTaskFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle assignment change
  const handleAssignmentChange = (value: string) => {
    setFormData(prev => ({ ...prev, assigned_to: value }));
    
    // Check if client is selected
    const isClient = value === 'client';
    setIsClientSelected(isClient);
    
    if (isClient) {
      // If we have contact context (from contact page), automatically populate
      if (contactId && contactName) {
        setSelectedContact({
          id: contactId,
          full_name: contactName,
          email: contactEmail,
          company: company
        });
        setContactSearchQuery(contactName);
        
        // Update form data with current contact info
        setFormData(prev => ({
          ...prev,
          assigned_to: value,
          contact_name: contactName,
          company: company || ''
        }));
      } else {
        // No contact context, show search interface
        setSelectedContact(null);
        setContactSearchQuery('');
      }
      setSearchedContacts([]);
    } else {
      // Reset contact search states and clear contact data from form
      setContactSearchQuery('');
      setSearchedContacts([]);
      setSelectedContact(null);
      
      // Clear contact-related form data when switching away from client
      setFormData(prev => ({
        ...prev,
        assigned_to: value,
        contact_name: contactName || '', // Reset to original or empty
        company: company || '' // Reset to original or empty
      }));
    }
  };

  // Search contacts
  const handleContactSearch = async (query: string) => {
    setContactSearchQuery(query);
    
    if (query.length < 2) {
      setSearchedContacts([]);
      return;
    }
    
    try {
      const results = await contacts.filter(contact => 
        contact.full_name?.toLowerCase().includes(query.toLowerCase()) ||
        contact.first_name?.toLowerCase().includes(query.toLowerCase()) ||
        contact.last_name?.toLowerCase().includes(query.toLowerCase()) ||
        contact.email?.toLowerCase().includes(query.toLowerCase()) ||
        contact.company?.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 10);
      
      setSearchedContacts(results);
    } catch (error) {
      logger.error('Error searching contacts:', error);
      setSearchedContacts([]);
    }
  };

  // Select a contact from search results
  const handleContactSelect = (contact: any) => {
    setSelectedContact(contact);
    setContactSearchQuery(contact.full_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim());
    setSearchedContacts([]);
    
    // Update form data with contact info
    setFormData(prev => ({
      ...prev,
      contact_name: contact.full_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
      company: contact.company || prev.company
    }));
  };

  const handleQuickDate = (dateValue: string) => {
    setFormData(prev => ({
      ...prev,
      due_date: dateValue
    }));
    
    // Update the date picker states to match
    if (dateValue) {
      const date = new Date(dateValue);
      setSelectedDate(date);
      setSelectedTime(format(date, 'HH:mm'));
    }
  };

  // Enhanced date handling
  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setIsCalendarOpen(false);
    
    if (date && selectedTime) {
      try {
        const [hours, minutes] = selectedTime.split(':');
        const dateWithTime = setHours(setMinutes(date, parseInt(minutes) || 0), parseInt(hours) || 9);
        const formattedDate = format(dateWithTime, "yyyy-MM-dd'T'HH:mm");
        
        setFormData(prev => ({
          ...prev,
          due_date: formattedDate
        }));
      } catch (error) {
        logger.error('Error setting date:', error);
        // Fallback to simple date format
        const fallbackDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}T${selectedTime}`;
        setFormData(prev => ({
          ...prev,
          due_date: fallbackDate
        }));
      }
    }
  };

  const handleTimeChange = (time: string) => {
    setSelectedTime(time);
    
    if (selectedDate) {
      try {
        const [hours, minutes] = time.split(':');
        const dateWithTime = setHours(setMinutes(selectedDate, parseInt(minutes) || 0), parseInt(hours) || 9);
        const formattedDate = format(dateWithTime, "yyyy-MM-dd'T'HH:mm");
        
        setFormData(prev => ({
          ...prev,
          due_date: formattedDate
        }));
      } catch (error) {
        logger.error('Error setting time:', error);
        // Fallback to simple date format
        const fallbackDate = `${selectedDate.getFullYear()}-${(selectedDate.getMonth() + 1).toString().padStart(2, '0')}-${selectedDate.getDate().toString().padStart(2, '0')}T${time}`;
        setFormData(prev => ({
          ...prev,
          due_date: fallbackDate
        }));
      }
    }
  };

  const getSmartQuickDates = () => {
    try {
      const now = new Date();
      const tomorrow = addDays(now, 1);
      const nextWeek = addDays(startOfWeek(addWeeks(now, 1)), 1); // Next Monday
      
      return [
        {
          label: 'In 1 Hour',
          value: format(addMinutes(now, 60), "yyyy-MM-dd'T'HH:mm"),
          icon: '⏰'
        },
        {
          label: 'End of Day',
          value: format(setHours(setMinutes(now, 0), 17), "yyyy-MM-dd'T'HH:mm"),
          icon: '🌅'
        },
        {
          label: 'Tomorrow 9 AM',
          value: format(setHours(setMinutes(tomorrow, 0), 9), "yyyy-MM-dd'T'HH:mm"),
          icon: '📅'
        },
        {
          label: 'Next Monday',
          value: format(setHours(setMinutes(nextWeek, 0), 9), "yyyy-MM-dd'T'HH:mm"),
          icon: '📆'
        }
      ];
    } catch (error) {
      logger.error('Error generating quick dates:', error);
      // Fallback to simple dates
      const now = new Date();
      return [
        {
          label: 'In 1 Hour',
          value: new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 16),
          icon: '⏰'
        },
        {
          label: 'Tomorrow',
          value: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
          icon: '📅'
        }
      ];
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Debug user data
    logger.log('TaskForm handleSubmit - userData:', userData);
    logger.log('TaskForm handleSubmit - isUserLoading:', isUserLoading);
    
    if (!formData.title.trim()) {
      toast.error('Task title is required');
      return;
    }

    if (!formData.assigned_to) {
      toast.error('Please assign this task to someone');
      return;
    }

    if (formData.assigned_to === 'client' && !selectedContact) {
      toast.error('Please search and select a client contact');
      return;
    }

    // Check if user data is still loading
    if (isUserLoading || !userData) {
      toast.error('Please wait for user data to load');
      return;
    }

    setIsSubmitting(true);

    try {
      // Handle different assignment types
      const isClientAssignment = formData.assigned_to === 'client';
      const isSpecialUser = formData.assigned_to === 'steve' || formData.assigned_to === 'phil';
      
      // Get contact info if assigning to a client
      const assignedContact = isClientAssignment ? selectedContact : null;

      // Determine the actual assigned user ID
      let actualAssignedTo = formData.assigned_to;
      
      if (isClientAssignment) {
        // For client assignments, we'll assign to the current user but track the contact info
        actualAssignedTo = userData?.id || 'current-user';
      } else if (isSpecialUser) {
        // For special users like Steve and Phil, keep the string identifier
        actualAssignedTo = formData.assigned_to;
      } else if (formData.assigned_to === 'current-user') {
        // Handle fallback case when userData.id is not available
        actualAssignedTo = userData?.id || 'current-user';
      }

      const taskData = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        task_type: formData.task_type,
        priority: formData.priority,
        due_date: formData.due_date ? new Date(formData.due_date).toISOString() : undefined,
        assigned_to: actualAssignedTo,
        // Simplified context
        deal_id: formData.deal_id || undefined,
        contact_name: assignedContact ? 
          (assignedContact.full_name || `${assignedContact.first_name || ''} ${assignedContact.last_name || ''}`.trim()) :
          formData.contact_name.trim() || undefined,
        company: formData.company.trim() || undefined,
        // Default other fields
        contact_email: assignedContact?.email || contactEmail || undefined,
        company_id: assignedContact?.company_id || companyId || undefined,
        contact_id: assignedContact?.id || contactId || undefined,
        // Add notes for client assignments
        notes: isClientAssignment ? `Task assigned to client: ${assignedContact?.full_name || assignedContact?.email}` : undefined,
      };

      if (task) {
        await updateTask(task.id, taskData);
        toast.success('Task updated successfully');
      } else {
        const newTask = await createTask(taskData);
        logger.log('Task created successfully:', newTask);
        
        // Notify parent component of task creation
        if (onTaskCreated && newTask) {
          onTaskCreated(newTask);
        }
        
        if (isClientAssignment) {
          toast.success(`Task created and assigned to client: ${assignedContact?.full_name || 'contact'}`);
        } else if (isSpecialUser) {
          const userName = formData.assigned_to === 'steve' ? 'Steve' : 'Phil';
          toast.success(`Task created and assigned to ${userName}`);
        } else if (formData.assigned_to === userData?.id) {
          toast.success('Task created and assigned to you');
        } else {
          toast.success('Task created successfully');
        }
      }

      // Add a small delay to ensure the task list updates before closing the form
      setTimeout(() => {
        onClose();
      }, 100);
      
    } catch (error) {
      logger.error('Error saving task:', error);
      toast.error('Failed to save task. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTaskType = taskTypes.find(t => t.value === formData.task_type);
  const selectedPriority = priorities.find(p => p.value === formData.priority);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl glassmorphism border-gray-700/50">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-2xl font-bold text-white flex items-center gap-3">
            <Plus className="w-6 h-6 text-blue-400" />
            {task ? 'Edit Task' : 'Create New Task'}
          </DialogTitle>
          <DialogDescription className="text-gray-400 text-base">
            {task ? 'Update your task details' : 'Set up a new task quickly and efficiently'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Task Title */}
          <div className="space-y-3">
            <Label htmlFor="title" className="text-lg font-semibold text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-400" />
              What needs to be done? *
            </Label>
                           <Input
                 id="title"
                 value={formData.title}
                 onChange={(e) => handleInputChange('title', e.target.value)}
                 placeholder="e.g., Call John about the proposal"
                 className="bg-gray-800/70 border-gray-600/50 text-white text-lg p-4 rounded-xl focus:border-blue-500/50 focus:ring-blue-500/20 placeholder:text-gray-400"
                 required
               />
          </div>

          {/* Task Type & Priority Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label className="text-base font-medium text-white flex items-center gap-2">
                ⚡ Task Type
              </Label>
              <Select value={formData.task_type} onValueChange={(value) => handleInputChange('task_type', value)}>
                <SelectTrigger className="bg-gray-800/70 border-gray-600/50 h-12 text-base rounded-xl text-white">
                  <SelectValue>
                    <div className="flex items-center gap-3 text-white">
                      <span className="text-lg">{selectedTaskType?.icon}</span>
                      <span className="text-white">{selectedTaskType?.label}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600 text-white">
                  {taskTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value} className="text-white hover:bg-gray-700 focus:bg-gray-700">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{type.icon}</span>
                        <span className="text-white">{type.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-medium text-white flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-400" />
                Priority
              </Label>
              <Select value={formData.priority} onValueChange={(value) => handleInputChange('priority', value)}>
                <SelectTrigger className="bg-gray-800/70 border-gray-600/50 h-12 text-base rounded-xl text-white">
                  <SelectValue>
                    <div className="flex items-center gap-3 text-white">
                      <span className="text-lg">{selectedPriority?.icon}</span>
                      <span className="text-white">{selectedPriority?.label}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600 text-white">
                  {priorities.map((priority) => (
                    <SelectItem key={priority.value} value={priority.value} className="text-white hover:bg-gray-700 focus:bg-gray-700">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{priority.icon}</span>
                        <span className="text-white">{priority.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Enhanced Due Date Picker */}
          <div className="space-y-4">
            <Label className="text-base font-medium text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-green-400" />
              When is this due?
            </Label>
            
            {/* Smart Quick Date Buttons */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {getSmartQuickDates().map((quick) => (
                <Button
                  key={quick.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickDate(quick.value)}
                  className="bg-gray-800/50 border-gray-600/50 text-gray-300 hover:bg-gray-700/70 hover:text-white flex items-center gap-2 h-12"
                >
                  <span className="text-base">{quick.icon}</span>
                  <span className="text-xs font-medium">{quick.label}</span>
                </Button>
              ))}
            </div>
            
            {/* Date and Time Picker Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Calendar Date Picker */}
              <div className="space-y-2">
                <Label className="text-sm text-gray-300">Pick Date</Label>
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full bg-gray-800/70 border-gray-600/50 text-white h-12 rounded-xl hover:bg-gray-700/70 justify-start"
                    >
                      <Calendar className="mr-3 h-5 w-5 text-gray-400" />
                      {selectedDate ? (
                        <span className="text-white">
                          {format(selectedDate, 'MMM dd, yyyy')}
                          {isToday(selectedDate) && ' (Today)'}
                          {isTomorrow(selectedDate) && ' (Tomorrow)'}
                        </span>
                      ) : (
                        <span className="text-gray-400">Select date...</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-gray-800 border-gray-600" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleDateSelect}
                      disabled={(date) => date < startOfDay(new Date())}
                      className="rounded-md"
                      classNames={{
                        months: "text-white",
                        month: "space-y-4",
                        caption: "flex justify-center pt-1 relative items-center text-white",
                        caption_label: "text-sm font-medium text-white",
                        nav: "space-x-1 flex items-center",
                        nav_button: "h-7 w-7 bg-transparent p-0 text-gray-400 hover:text-white",
                        nav_button_previous: "absolute left-1",
                        nav_button_next: "absolute right-1",
                        table: "w-full border-collapse space-y-1",
                        head_row: "flex",
                        head_cell: "text-gray-400 rounded-md w-9 font-normal text-[0.8rem]",
                        row: "flex w-full mt-2",
                        cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-gray-700 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                        day: "h-9 w-9 p-0 font-normal text-white hover:bg-gray-700 rounded-md",
                        day_selected: "bg-blue-500 text-white hover:bg-blue-600 focus:bg-blue-500 focus:text-white",
                        day_today: "bg-gray-700 text-white",
                        day_outside: "text-gray-500 opacity-50",
                        day_disabled: "text-gray-500 opacity-50",
                        day_hidden: "invisible",
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Time Picker */}
              <div className="space-y-2">
                <Label className="text-sm text-gray-300">Pick Time</Label>
                <Select value={selectedTime} onValueChange={handleTimeChange}>
                  <SelectTrigger className="bg-gray-800/70 border-gray-600/50 h-12 text-white rounded-xl">
                    <SelectValue>
                      <div className="flex items-center gap-3 text-white">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-white">{selectedTime}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                                     <SelectContent className="bg-gray-800 border-gray-600 text-white max-h-64 overflow-y-auto">
                     {Array.from({ length: 24 }, (_, hour) => 
                       Array.from({ length: 4 }, (_, quarter) => {
                         const minutes = quarter * 15;
                         const time = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                         const displayTime = format(setMinutes(setHours(new Date(), hour), minutes), 'h:mm a');
                         
                         // Safety check to ensure time is not empty
                         if (!time || time.trim() === '') {
                           return null;
                         }
                         
                         return (
                           <SelectItem key={time} value={time} className="text-white hover:bg-gray-700 focus:bg-gray-700">
                             <div className="flex items-center gap-3">
                               <span className="text-white">{displayTime}</span>
                             </div>
                           </SelectItem>
                         );
                       })
                     ).flat().filter(Boolean)}
                   </SelectContent>
                </Select>
              </div>
            </div>

            {/* Selected Date/Time Display */}
            {selectedDate && (
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                    <Clock className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-green-400 font-medium">
                      Due: {format(selectedDate, 'EEEE, MMMM do, yyyy')} at {selectedTime}
                    </div>
                    <div className="text-gray-400 text-sm">
                      {isToday(selectedDate) && 'Today'}
                      {isTomorrow(selectedDate) && 'Tomorrow'}
                      {!isToday(selectedDate) && !isTomorrow(selectedDate) && `In ${Math.ceil((selectedDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days`}
                    </div>
                  </div>
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    Set
                  </Badge>
                </div>
              </div>
            )}
          </div>

                               {/* Assignee */}
          <div className="space-y-3">
            <Label className="text-base font-medium text-white flex items-center gap-2">
              <User className="w-4 h-4 text-purple-400" />
              Who's responsible? *
            </Label>
                                     <Select value={formData.assigned_to} onValueChange={handleAssignmentChange}>
              <SelectTrigger className="bg-gray-800/70 border-gray-600/50 h-12 text-base rounded-xl text-white">
                <SelectValue placeholder="Choose someone..." className="text-gray-400 placeholder:text-gray-400" />
              </SelectTrigger>
               <SelectContent className="bg-gray-800 border-gray-600 text-white">
                 {/* Me Option */}
                 <SelectItem value={userData?.id || 'current-user'} className="text-white hover:bg-gray-700 focus:bg-gray-700">
                   <div className="flex items-center gap-3">
                     <div className="w-6 h-6 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                       ME
                     </div>
                     <span className="text-white">Me</span>
                     <Badge variant="outline" className="ml-2 text-xs bg-green-500/20 text-green-400 border-green-500/30">
                       You
                     </Badge>
                   </div>
                 </SelectItem>

                 {/* Client Option */}
                 <SelectItem value="client" className="text-white hover:bg-gray-700 focus:bg-gray-700">
                   <div className="flex items-center gap-3">
                     <div className="w-6 h-6 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                       CL
                     </div>
                     <span className="text-white">Client</span>
                     <Badge variant="outline" className="ml-2 text-xs bg-orange-500/20 text-orange-400 border-orange-500/30">
                       {contactId ? 'Auto-map' : 'Search'}
                     </Badge>
                   </div>
                 </SelectItem>

                                 {/* Sales Team Section */}
                 <div className="px-2 py-1 text-xs font-semibold text-blue-400 uppercase tracking-wide mt-2">
                   Sales Team
                 </div>
                 {users.filter(user => user.id !== userData?.id).map((user) => (
                   <SelectItem key={`user-${user.id}`} value={user.id} className="text-white hover:bg-gray-700 focus:bg-gray-700">
                     <div className="flex items-center gap-3">
                       <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                         {user.first_name?.[0]}{user.last_name?.[0]}
                       </div>
                       <span className="text-white">{user.first_name} {user.last_name}</span>
                       <Badge variant="outline" className="ml-2 text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">
                         Team
                       </Badge>
                     </div>
                   </SelectItem>
                 ))}
                 <SelectItem value="steve" className="text-white hover:bg-gray-700 focus:bg-gray-700">
                   <div className="flex items-center gap-3">
                     <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                       ST
                     </div>
                     <span className="text-white">Steve</span>
                     <Badge variant="outline" className="ml-2 text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">
                       Team
                     </Badge>
                   </div>
                 </SelectItem>
                 <SelectItem value="phil" className="text-white hover:bg-gray-700 focus:bg-gray-700">
                   <div className="flex items-center gap-3">
                     <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                       PH
                     </div>
                     <span className="text-white">Phil</span>
                     <Badge variant="outline" className="ml-2 text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">
                       Team
                     </Badge>
                   </div>
                 </SelectItem>
              </SelectContent>
            </Select>
                     </div>

          {/* Contact Search Field - Only shown when Client is selected */}
          {isClientSelected && (
            <div className="space-y-3">
              <Label className="text-base font-medium text-orange-400 flex items-center gap-2">
                👥 Client Contact
              </Label>
              
              {/* Auto-populated contact from contact page */}
              {selectedContact && contactId ? (
                <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                      {selectedContact.full_name?.[0] || '?'}
                    </div>
                    <div className="flex-1">
                      <div className="text-orange-400 font-medium">
                        {selectedContact.full_name}
                      </div>
                      {selectedContact.email && (
                        <div className="text-gray-400 text-sm">{selectedContact.email}</div>
                      )}
                      {selectedContact.company && (
                        <div className="text-gray-500 text-xs">{selectedContact.company}</div>
                      )}
                    </div>
                    <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                      Current Contact
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-400 flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span>Automatically mapped from contact page</span>
                  </div>
                </div>
              ) : (
                /* Contact search interface when no auto-populated contact */
                <div className="relative">
                  <Input
                    value={contactSearchQuery}
                    onChange={(e) => handleContactSearch(e.target.value)}
                    placeholder="Type to search contacts by name, email, or company..."
                    className="bg-gray-800/70 border-gray-600/50 text-white h-12 rounded-xl placeholder:text-gray-400"
                  />
                  
                  {/* Search Results Dropdown */}
                  {searchedContacts.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800/95 border border-gray-600/50 rounded-xl shadow-lg z-50 max-h-64 overflow-y-auto">
                      {searchedContacts.map((contact) => (
                        <div
                          key={contact.id}
                          onClick={() => handleContactSelect(contact)}
                          className="flex items-center gap-3 p-3 hover:bg-gray-700/50 cursor-pointer border-b border-gray-700/30 last:border-b-0"
                        >
                          <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                            {contact.first_name?.[0] || contact.full_name?.[0] || '?'}
                          </div>
                          <div className="flex-1">
                            <div className="text-white font-medium">
                              {contact.full_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim()}
                            </div>
                            {contact.email && (
                              <div className="text-gray-400 text-sm">{contact.email}</div>
                            )}
                            {contact.company && (
                              <div className="text-gray-500 text-xs">{contact.company}</div>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs bg-orange-500/20 text-orange-400 border-orange-500/30">
                            Select
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Selected Contact Display for manual selection */}
                  {selectedContact && !contactId && (
                    <div className="mt-2 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          {selectedContact.full_name?.[0] || '?'}
                        </div>
                        <div className="flex-1">
                          <div className="text-orange-400 font-medium">
                            {selectedContact.full_name}
                          </div>
                          {selectedContact.email && (
                            <div className="text-gray-400 text-sm">{selectedContact.email}</div>
                          )}
                        </div>
                        <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                          Selected
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Optional Description */}
          <div className="space-y-3">
            <Label htmlFor="description" className="text-base font-medium text-gray-300">
              Additional Details (Optional)
            </Label>
                         <Textarea
               id="description"
               value={formData.description}
               onChange={(e) => handleInputChange('description', e.target.value)}
               placeholder="Any extra context or notes..."
               rows={3}
               className="bg-gray-800/70 border-gray-600/50 text-white resize-none rounded-xl placeholder:text-gray-400"
             />
          </div>

          {/* Context Info (Auto-filled) */}
          {(formData.contact_name || formData.company) && (
            <div className="glassmorphism-light p-4 rounded-xl border border-blue-500/20">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span className="text-sm font-medium text-blue-400">Task Context</span>
              </div>
              <div className="space-y-2 text-sm">
                {formData.contact_name && (
                  <div className="flex items-center gap-2 text-gray-300">
                    <User className="w-3 h-3" />
                    <span>Contact: {formData.contact_name}</span>
                  </div>
                )}
                {formData.company && (
                  <div className="flex items-center gap-2 text-gray-300">
                    <span className="w-3 h-3 text-center">🏢</span>
                    <span>Company: {formData.company}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-3 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="bg-gray-800/50 border-gray-600/50 text-gray-300 hover:bg-gray-700/70 hover:text-white h-12 px-6"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isUserLoading}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white h-12 px-8 rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                  {task ? 'Updating...' : 'Creating...'}
                </>
              ) : isUserLoading ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                  Loading user...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {task ? 'Update Task' : 'Create Task'}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TaskForm;