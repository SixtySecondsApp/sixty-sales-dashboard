import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { CalendarEvent } from '@/pages/Calendar';
import { format } from 'date-fns';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  AlertTriangle,
  Trash2,
  Save,
  X,
  Plus,
  Tag,
  Repeat,
  Link,
  Mail
} from 'lucide-react';
import { EmailComposerEnhanced } from '@/components/email/EmailComposerEnhanced';

interface CalendarEventModalProps {
  event: CalendarEvent;
  isOpen: boolean;
  isCreating: boolean;
  onClose: () => void;
  onSave: (event: CalendarEvent) => void;
  onDelete?: (eventId: string) => void;
}

const categoryOptions = [
  { value: 'meeting', label: 'Meeting', color: 'bg-emerald-600' },
  { value: 'call', label: 'Phone Call', color: 'bg-blue-500' },
  { value: 'task', label: 'Task', color: 'bg-amber-500' },
  { value: 'deal', label: 'Deal Activity', color: 'bg-violet-500' },
  { value: 'personal', label: 'Personal', color: 'bg-pink-500' },
  { value: 'follow-up', label: 'Follow-up', color: 'bg-cyan-500' },
];

const priorityOptions = [
  { value: 'low', label: 'Low', color: 'text-green-400' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-400' },
  { value: 'high', label: 'High', color: 'text-red-400' },
];

export const CalendarEventModal: React.FC<CalendarEventModalProps> = ({
  event,
  isOpen,
  isCreating,
  onClose,
  onSave,
  onDelete,
}) => {
  const [formData, setFormData] = useState<CalendarEvent>(event);
  const [attendeeInput, setAttendeeInput] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showEmailComposer, setShowEmailComposer] = useState(false);

  useEffect(() => {
    setFormData(event);
    setErrors({});
  }, [event, isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.start) {
      newErrors.start = 'Start date/time is required';
    }

    if (formData.end && formData.start && formData.end <= formData.start) {
      newErrors.end = 'End time must be after start time';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;

    onSave({
      ...formData,
      updatedAt: new Date(),
    });
  };

  const handleDelete = () => {
    if (onDelete && formData.id) {
      onDelete(formData.id);
    }
  };

  const addAttendee = () => {
    if (attendeeInput.trim() && !formData.attendees?.includes(attendeeInput.trim())) {
      setFormData(prev => ({
        ...prev,
        attendees: [...(prev.attendees || []), attendeeInput.trim()]
      }));
      setAttendeeInput('');
    }
  };

  const removeAttendee = (email: string) => {
    setFormData(prev => ({
      ...prev,
      attendees: prev.attendees?.filter(a => a !== email) || []
    }));
  };

  const formatDateTimeLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-900/95 border-gray-800/50 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-xl text-gray-100">
            <Calendar className="w-5 h-5 text-emerald-400" />
            <span>{isCreating ? 'Create Event' : 'Edit Event'}</span>
          </DialogTitle>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="title" className="text-gray-200">Event Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter event title..."
                className={`bg-gray-800/50 border-gray-700/50 text-gray-200 placeholder-gray-400 ${
                  errors.title ? 'border-red-500' : ''
                }`}
              />
              {errors.title && (
                <p className="text-red-400 text-sm mt-1">{errors.title}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category" className="text-gray-200">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value: any) => setFormData(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger className="bg-gray-800/50 border-gray-700/50 text-gray-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {categoryOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${option.color}`} />
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="priority" className="text-gray-200">Priority</Label>
                <Select
                  value={formData.priority || 'medium'}
                  onValueChange={(value: any) => setFormData(prev => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger className="bg-gray-800/50 border-gray-700/50 text-gray-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {priorityOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center space-x-2">
                          <AlertTriangle className={`w-4 h-4 ${option.color}`} />
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Date & Time */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <Label className="text-gray-200">Date & Time</Label>
            </div>

            <div className="flex items-center space-x-4">
              <Switch
                checked={formData.allDay || false}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, allDay: checked }))}
              />
              <Label className="text-gray-200">All day</Label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate" className="text-gray-200">Start *</Label>
                <Input
                  id="startDate"
                  type={formData.allDay ? 'date' : 'datetime-local'}
                  value={formData.allDay 
                    ? format(formData.start, 'yyyy-MM-dd')
                    : formatDateTimeLocal(formData.start)
                  }
                  onChange={(e) => {
                    const newDate = new Date(e.target.value);
                    setFormData(prev => ({ ...prev, start: newDate }));
                  }}
                  className={`bg-gray-800/50 border-gray-700/50 text-gray-200 ${
                    errors.start ? 'border-red-500' : ''
                  }`}
                />
                {errors.start && (
                  <p className="text-red-400 text-sm mt-1">{errors.start}</p>
                )}
              </div>

              {!formData.allDay && (
                <div>
                  <Label htmlFor="endDate" className="text-gray-200">End</Label>
                  <Input
                    id="endDate"
                    type="datetime-local"
                    value={formData.end ? formatDateTimeLocal(formData.end) : ''}
                    onChange={(e) => {
                      const newDate = e.target.value ? new Date(e.target.value) : undefined;
                      setFormData(prev => ({ ...prev, end: newDate }));
                    }}
                    className={`bg-gray-800/50 border-gray-700/50 text-gray-200 ${
                      errors.end ? 'border-red-500' : ''
                    }`}
                  />
                  {errors.end && (
                    <p className="text-red-400 text-sm mt-1">{errors.end}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description" className="text-gray-200">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Add event description..."
              rows={3}
              className="bg-gray-800/50 border-gray-700/50 text-gray-200 placeholder-gray-400"
            />
          </div>

          {/* Location */}
          <div>
            <Label htmlFor="location" className="flex items-center space-x-2 text-gray-200">
              <MapPin className="w-4 h-4" />
              <span>Location</span>
            </Label>
            <Input
              id="location"
              value={formData.location || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              placeholder="Add location..."
              className="bg-gray-800/50 border-gray-700/50 text-gray-200 placeholder-gray-400"
            />
          </div>

          {/* Advanced Options Toggle */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-emerald-400 hover:text-emerald-300"
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced Options
          </Button>

          {/* Advanced Options */}
          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-4 border-t border-gray-800/50 pt-4"
              >
                {/* Attendees */}
                <div>
                  <Label className="flex items-center space-x-2 text-gray-200">
                    <Users className="w-4 h-4" />
                    <span>Attendees</span>
                  </Label>
                  
                  <div className="flex space-x-2 mt-2">
                    <Input
                      value={attendeeInput}
                      onChange={(e) => setAttendeeInput(e.target.value)}
                      placeholder="Enter email address..."
                      onKeyPress={(e) => e.key === 'Enter' && addAttendee()}
                      className="bg-gray-800/50 border-gray-700/50 text-gray-200 placeholder-gray-400"
                    />
                    <Button type="button" onClick={addAttendee} size="sm">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {formData.attendees && formData.attendees.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.attendees.map((attendee, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="bg-gray-800/50 text-gray-200 hover:bg-gray-700/50"
                        >
                          {attendee}
                          <button
                            type="button"
                            onClick={() => removeAttendee(attendee)}
                            className="ml-2 hover:text-red-400"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recurring */}
                <div className="flex items-center space-x-4">
                  <Switch
                    checked={formData.recurring || false}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, recurring: checked }))}
                  />
                  <Label className="flex items-center space-x-2 text-gray-200">
                    <Repeat className="w-4 h-4" />
                    <span>Recurring event</span>
                  </Label>
                </div>

                {formData.recurring && (
                  <Input
                    value={formData.recurringPattern || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, recurringPattern: e.target.value }))}
                    placeholder="e.g., weekly, monthly, daily..."
                    className="bg-gray-800/50 border-gray-700/50 text-gray-200 placeholder-gray-400"
                  />
                )}

                {/* CRM Links */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="dealId" className="text-gray-200">Deal ID</Label>
                    <Input
                      id="dealId"
                      value={formData.dealId || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, dealId: e.target.value }))}
                      placeholder="Link to deal..."
                      className="bg-gray-800/50 border-gray-700/50 text-gray-200 placeholder-gray-400"
                    />
                  </div>

                  <div>
                    <Label htmlFor="contactId" className="text-gray-200">Contact ID</Label>
                    <Input
                      id="contactId"
                      value={formData.contactId || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, contactId: e.target.value }))}
                      placeholder="Link to contact..."
                      className="bg-gray-800/50 border-gray-700/50 text-gray-200 placeholder-gray-400"
                    />
                  </div>

                  <div>
                    <Label htmlFor="companyId" className="text-gray-200">Company ID</Label>
                    <Input
                      id="companyId"
                      value={formData.companyId || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, companyId: e.target.value }))}
                      placeholder="Link to company..."
                      className="bg-gray-800/50 border-gray-700/50 text-gray-200 placeholder-gray-400"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <DialogFooter className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {!isCreating && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                className="bg-red-600/20 hover:bg-red-600/30 text-red-400 border-red-600/50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            )}
            {!isCreating && formData.category === 'meeting' && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEmailComposer(true)}
                className="border-emerald-600/50 text-emerald-400 hover:bg-emerald-600/10"
              >
                <Mail className="w-4 h-4 mr-2" />
                Send Follow-up Email
              </Button>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-gray-700 text-gray-300 hover:bg-gray-800/50"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              {isCreating ? 'Create Event' : 'Save Changes'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Email Composer for Follow-up Emails */}
      <EmailComposerEnhanced
        isOpen={showEmailComposer}
        onClose={() => setShowEmailComposer(false)}
        calendarEventId={!isCreating ? formData.id : undefined}
        contactId={formData.contactId}
        dealId={formData.dealId}
        initialSubject={`Follow-up: ${formData.title}`}
      />
    </Dialog>
  );
};