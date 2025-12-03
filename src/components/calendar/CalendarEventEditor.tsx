import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  Users,
  FileText,
  Bell,
  Repeat,
  Video,
  Phone,
  ChevronDown,
  Plus,
  Trash2,
  Copy,
  Edit3,
  Save,
  Link,
  Palette,
  Tag,
  AlertCircle,
  CheckCircle2,
  User,
  Building2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addDays, addWeeks, addMonths, setHours, setMinutes } from 'date-fns';
import { useCreateCalendarEvent, useUpdateCalendarEvent, useDeleteCalendarEvent } from '@/lib/hooks/useGoogleIntegration';
import { useCalendarEventsFromDB } from '@/lib/hooks/useCalendarEvents';
import { ContactSearchModal } from '@/components/ContactSearchModal';
import { toast } from 'sonner';
import { checkConflicts, EventConflict } from '@/lib/utils/conflictDetection';
import { generateRRule, createSimpleRecurrence, rruleToGoogleRecurrence, describeRecurrence } from '@/lib/utils/rruleUtils';
import { ConflictWarning } from './ConflictWarning';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useFocusTrap } from '@/lib/hooks/useKeyboardNavigation';
import { getEventLabel, getConflictAnnouncement, announceToScreenReader } from '@/lib/utils/accessibilityUtils';

interface CalendarEventEditorProps {
  isOpen: boolean;
  onClose: () => void;
  event?: CalendarEvent | null;
  selectedDate?: Date;
  onEventSaved?: (event: any) => void;
}

interface CalendarEvent {
  id?: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  description?: string;
  location?: string;
  attendees?: string[];
  category: 'meeting' | 'call' | 'task' | 'personal' | 'other';
  color?: string;
  reminders?: Reminder[];
  recurring?: RecurringPattern;
  videoConference?: VideoConference;
  attachments?: string[];
  status?: 'confirmed' | 'tentative' | 'cancelled';
  visibility?: 'public' | 'private';
  busy?: boolean;
}

interface Reminder {
  method: 'email' | 'popup';
  minutes: number;
}

interface RecurringPattern {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  interval: number;
  endDate?: Date;
  endAfterOccurrences?: number;
  daysOfWeek?: number[]; // 0-6 for Sunday-Saturday
  dayOfMonth?: number;
  monthOfYear?: number;
}

interface VideoConference {
  provider: 'google-meet' | 'zoom' | 'teams' | 'custom';
  url?: string;
  meetingId?: string;
  password?: string;
}

const eventColors = [
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#10B981' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Yellow', value: '#F59E0B' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Indigo', value: '#6366F1' },
  { name: 'Teal', value: '#14B8A6' }
];

const reminderOptions = [
  { label: 'At time of event', minutes: 0 },
  { label: '5 minutes before', minutes: 5 },
  { label: '10 minutes before', minutes: 10 },
  { label: '15 minutes before', minutes: 15 },
  { label: '30 minutes before', minutes: 30 },
  { label: '1 hour before', minutes: 60 },
  { label: '2 hours before', minutes: 120 },
  { label: '1 day before', minutes: 1440 },
  { label: '2 days before', minutes: 2880 },
  { label: '1 week before', minutes: 10080 }
];

export function CalendarEventEditor({
  isOpen,
  onClose,
  event,
  selectedDate,
  onEventSaved
}: CalendarEventEditorProps) {
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [attendees, setAttendees] = useState<string[]>([]);
  const [newAttendee, setNewAttendee] = useState('');
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [showContactSearch, setShowContactSearch] = useState(false);
  const [category, setCategory] = useState<CalendarEvent['category']>('meeting');
  const [color, setColor] = useState(eventColors[0].value);
  const [reminders, setReminders] = useState<Reminder[]>([
    { method: 'popup', minutes: 10 }
  ]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringPattern, setRecurringPattern] = useState<RecurringPattern>({
    frequency: 'weekly',
    interval: 1
  });
  const [videoConference, setVideoConference] = useState<VideoConference | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [busy, setBusy] = useState(true);
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');

  // Conflict detection and deletion confirmation
  const [conflicts, setConflicts] = useState<EventConflict[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const createEvent = useCreateCalendarEvent();
  const updateEvent = useUpdateCalendarEvent();
  const deleteEvent = useDeleteCalendarEvent();

  // Accessibility: Focus trap for modal
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(isOpen, modalRef, onClose);

  // Fetch existing events for conflict detection - memoize dates to prevent infinite loops
  const [conflictCheckStart] = useState(() => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)); // 30 days ago
  const [conflictCheckEnd] = useState(() => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)); // 90 days ahead

  const { data: existingEvents = [] } = useCalendarEventsFromDB(
    conflictCheckStart,
    conflictCheckEnd,
    true
  );

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setAllDay(event.allDay);
      setDescription(event.description || '');
      setLocation(event.location || '');
      setAttendees(event.attendees || []);
      setCategory(event.category);
      setColor(event.color || eventColors[0].value);
      setReminders(event.reminders || [{ method: 'popup', minutes: 10 }]);
      setIsRecurring(!!event.recurring);
      setRecurringPattern(event.recurring || { frequency: 'weekly', interval: 1 });
      setVideoConference(event.videoConference || null);
      setBusy(event.busy !== false);
      setVisibility(event.visibility || 'public');

      // Set dates and times
      const start = new Date(event.start);
      const end = new Date(event.end || event.start);
      setStartDate(format(start, 'yyyy-MM-dd'));
      setStartTime(format(start, 'HH:mm'));
      setEndDate(format(end, 'yyyy-MM-dd'));
      setEndTime(format(end, 'HH:mm'));
    } else if (selectedDate) {
      const date = format(selectedDate, 'yyyy-MM-dd');
      setStartDate(date);
      setEndDate(date);
      setStartTime('09:00');
      setEndTime('10:00');
    }
  }, [event, selectedDate]);

  // Check for conflicts when date/time changes
  useEffect(() => {
    if (!startDate || !existingEvents.length) {
      setConflicts([]);
      return;
    }

    try {
      let startDateTime: Date;
      let endDateTime: Date;

      if (allDay) {
        startDateTime = new Date(`${startDate}T00:00:00.000Z`);
        endDateTime = new Date(`${endDate || startDate}T23:59:59.999Z`);
      } else {
        const startDateStr = `${startDate}T${startTime || '09:00'}:00`;
        const endDateStr = `${endDate || startDate}T${endTime || '10:00'}:00`;
        startDateTime = new Date(startDateStr);
        endDateTime = new Date(endDateStr);
      }

      // Skip if dates are invalid
      if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
        return;
      }

      const conflictResult = checkConflicts(
        {
          id: event?.id,
          start: startDateTime,
          end: endDateTime,
        },
        existingEvents,
        event?.id
      );

      setConflicts(conflictResult.conflicts);

      // Announce conflicts to screen readers
      if (conflictResult.conflicts.length > 0) {
        const severity = conflictResult.conflicts[0].severity;
        const announcement = getConflictAnnouncement(conflictResult.conflicts.length, severity);
        announceToScreenReader(announcement, severity === 'high' ? 'assertive' : 'polite');
      }
    } catch (error) {
      // Silently handle any date parsing errors
      setConflicts([]);
    }
  }, [startDate, startTime, endDate, endTime, allDay, existingEvents, event?.id]);

  const handleSave = async () => {
    if (!title || !startDate) {
      toast.error('Please enter a title and date');
      return;
    }

    try {
      // Format data for Google Calendar API with proper date handling
      let startDateTime: Date;
      let endDateTime: Date;

      if (allDay) {
        // For all-day events, use proper date without time
        startDateTime = new Date(`${startDate}T00:00:00.000Z`);
        endDateTime = new Date(`${endDate || startDate}T23:59:59.999Z`);
      } else {
        // For timed events, ensure proper timezone handling
        const startDateStr = `${startDate}T${startTime || '09:00'}:00`;
        const endDateStr = `${endDate || startDate}T${endTime || '10:00'}:00`;

        startDateTime = new Date(startDateStr);
        endDateTime = new Date(endDateStr);

        // Validate dates
        if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
          toast.error('Invalid date or time format');
          return;
        }

        // Ensure end time is after start time
        if (endDateTime <= startDateTime) {
          endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // Add 1 hour
        }
      }

      // Prepare recurrence rule if recurring
      let recurrence: string[] | undefined;
      if (isRecurring && recurringPattern) {
        try {
          // Convert UI recurring pattern to RRULE
          // Filter out 'custom' frequency which isn't supported by createSimpleRecurrence
          const frequency = recurringPattern.frequency === 'custom' ? 'daily' : recurringPattern.frequency;
          const rrulePattern = createSimpleRecurrence(
            frequency as 'daily' | 'weekly' | 'monthly' | 'yearly',
            {
              interval: recurringPattern.interval || 1,
              weekDays: recurringPattern.daysOfWeek?.map(day => {
                const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                return days[day];
              }),
              monthDay: recurringPattern.dayOfMonth,
              endDate: recurringPattern.endDate,
              occurrences: recurringPattern.endAfterOccurrences,
            }
          );

          const rruleString = generateRRule(rrulePattern);
          recurrence = rruleToGoogleRecurrence(rruleString);

          // Show description of recurrence to user
          toast.info(`Recurring: ${describeRecurrence(rrulePattern)}`);
        } catch (error) {
          toast.error('Failed to create recurrence pattern. Saving as single event.');
          console.error('Recurrence error:', error);
        }
      }

      // Prepare reminders for Google Calendar API
      const googleReminders = reminders
        .filter(r => r.minutes >= 0)
        .map(r => ({
          method: r.method,
          minutes: r.minutes,
        }));

      const googleEventData: any = {
        summary: title,
        description: description || '',
        location: location || '',
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        attendees: attendees.filter(email => email.trim() !== ''),
        calendarId: 'primary',
        allDay,
      };

      // Add reminders if any
      if (googleReminders.length > 0) {
        googleEventData.reminders = {
          useDefault: false,
          overrides: googleReminders,
        };
      }

      // Add recurrence if set
      if (recurrence) {
        googleEventData.recurrence = recurrence;
      }

      if (event?.id) {
        await updateEvent.mutateAsync({
          eventId: event.id,
          ...googleEventData,
        });
        toast.success('Event updated successfully');
      } else {
        await createEvent.mutateAsync(googleEventData);
        toast.success('Event created successfully');
      }

      if (onEventSaved) {
        onEventSaved({
          title,
          start: startDateTime,
          end: endDateTime,
          allDay,
          description,
          location,
          attendees,
          category,
          color,
          reminders,
          recurring: isRecurring ? recurringPattern : undefined,
          videoConference,
          busy,
          visibility,
        });
      }

      // Clear conflicts and close
      setConflicts([]);
      handleClose();
    } catch (error) {
      toast.error(`Failed to save event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!event?.id) return;

    try {
      await deleteEvent.mutateAsync(event.id);
      toast.success('Event deleted successfully');
      setShowDeleteConfirm(false);
      handleClose();
    } catch (error) {
      toast.error('Failed to delete event');
      setShowDeleteConfirm(false);
    }
  };

  const handleClose = () => {
    // Reset form
    setTitle('');
    setStartDate('');
    setStartTime('');
    setEndDate('');
    setEndTime('');
    setAllDay(false);
    setDescription('');
    setLocation('');
    setAttendees([]);
    setCategory('meeting');
    setColor(eventColors[0].value);
    setReminders([{ method: 'popup', minutes: 10 }]);
    setIsRecurring(false);
    setVideoConference(null);
    onClose();
  };

  const addAttendee = () => {
    if (newAttendee && !attendees.includes(newAttendee)) {
      setAttendees([...attendees, newAttendee]);
      setNewAttendee('');
    }
  };

  const removeAttendee = (email: string) => {
    setAttendees(attendees.filter(a => a !== email));
  };

  const addReminder = () => {
    setReminders([...reminders, { method: 'popup', minutes: 10 }]);
  };

  const updateReminder = (index: number, reminder: Reminder) => {
    const updated = [...reminders];
    updated[index] = reminder;
    setReminders(updated);
  };

  const removeReminder = (index: number) => {
    setReminders(reminders.filter((_, i) => i !== index));
  };

  const enableVideoConference = (provider: VideoConference['provider']) => {
    if (provider === 'google-meet') {
      setVideoConference({
        provider: 'google-meet',
        url: 'Auto-generated on save'
      });
    } else {
      setVideoConference({ provider });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={handleClose}
          role="presentation"
        >
          <motion.div
            ref={modalRef}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-editor-title"
            aria-describedby={conflicts.length > 0 ? "event-conflicts" : undefined}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h2 id="event-editor-title" className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#37bd7e]" aria-hidden="true" />
                {event ? 'Edit Event' : 'New Event'}
              </h2>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                aria-label="Close event editor"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </motion.button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Conflict Warning */}
              {conflicts.length > 0 && (
                <div id="event-conflicts" role="alert" aria-live="assertive">
                  <ConflictWarning conflicts={conflicts} showDetails={true} />
                </div>
              )}

              {/* Title */}
              <div>
                <label htmlFor="event-title" className="sr-only">
                  Event title
                </label>
                <input
                  id="event-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Add title"
                  className="w-full text-xl font-semibold bg-transparent border-b border-gray-700 pb-2 focus:outline-none focus:border-[#37bd7e] transition-colors"
                  aria-required="true"
                  aria-invalid={!title}
                  autoFocus
                />
              </div>

              {/* Date & Time */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={allDay}
                      onChange={(e) => setAllDay(e.target.checked)}
                      className="rounded border-gray-600 text-[#37bd7e] focus:ring-[#37bd7e]"
                    />
                    <span className="text-sm">All day</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3 ml-7">
                  <div>
                    <label className="text-xs text-gray-400">Start</label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#37bd7e]/50"
                      />
                      {!allDay && (
                        <input
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#37bd7e]/50"
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">End</label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#37bd7e]/50"
                      />
                      {!allDay && (
                        <input
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#37bd7e]/50"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Recurring */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Repeat className="w-4 h-4 text-gray-400" />
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="rounded border-gray-600 text-[#37bd7e] focus:ring-[#37bd7e]"
                    />
                    <span className="text-sm">Repeat</span>
                  </label>
                </div>

                {isRecurring && (
                  <div className="ml-7 space-y-2">
                    <div className="flex gap-2">
                      <select
                        value={recurringPattern.frequency}
                        onChange={(e) => setRecurringPattern({
                          ...recurringPattern,
                          frequency: e.target.value as RecurringPattern['frequency']
                        })}
                        className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#37bd7e]/50"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                        <option value="custom">Custom</option>
                      </select>
                      <input
                        type="number"
                        min="1"
                        value={recurringPattern.interval}
                        onChange={(e) => setRecurringPattern({
                          ...recurringPattern,
                          interval: parseInt(e.target.value) || 1
                        })}
                        className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#37bd7e]/50"
                      />
                      <span className="text-sm text-gray-400 self-center">
                        {recurringPattern.frequency === 'daily' && 'day(s)'}
                        {recurringPattern.frequency === 'weekly' && 'week(s)'}
                        {recurringPattern.frequency === 'monthly' && 'month(s)'}
                        {recurringPattern.frequency === 'yearly' && 'year(s)'}
                      </span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="text-sm text-gray-400">Ends:</span>
                      <input
                        type="date"
                        value={recurringPattern.endDate ? format(recurringPattern.endDate, 'yyyy-MM-dd') : ''}
                        onChange={(e) => setRecurringPattern({
                          ...recurringPattern,
                          endDate: e.target.value ? new Date(e.target.value) : undefined
                        })}
                        className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#37bd7e]/50"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Location */}
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Add location"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#37bd7e]/50"
                />
              </div>

              {/* Video Conference */}
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Video className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-400">Video Conference</span>
                </div>
                <div className="ml-7 flex gap-2">
                  <button
                    onClick={() => enableVideoConference('google-meet')}
                    className={cn(
                      "px-3 py-1 text-sm rounded transition-colors",
                      videoConference?.provider === 'google-meet'
                        ? "bg-[#37bd7e]/20 text-[#37bd7e] border border-[#37bd7e]/30"
                        : "bg-gray-800 hover:bg-gray-700"
                    )}
                  >
                    Google Meet
                  </button>
                  <button
                    onClick={() => enableVideoConference('zoom')}
                    className={cn(
                      "px-3 py-1 text-sm rounded transition-colors",
                      videoConference?.provider === 'zoom'
                        ? "bg-[#37bd7e]/20 text-[#37bd7e] border border-[#37bd7e]/30"
                        : "bg-gray-800 hover:bg-gray-700"
                    )}
                  >
                    Zoom
                  </button>
                  <button
                    onClick={() => enableVideoConference('teams')}
                    className={cn(
                      "px-3 py-1 text-sm rounded transition-colors",
                      videoConference?.provider === 'teams'
                        ? "bg-[#37bd7e]/20 text-[#37bd7e] border border-[#37bd7e]/30"
                        : "bg-gray-800 hover:bg-gray-700"
                    )}
                  >
                    Teams
                  </button>
                </div>
                {videoConference && videoConference.provider !== 'google-meet' && (
                  <input
                    type="url"
                    value={videoConference.url || ''}
                    onChange={(e) => setVideoConference({
                      ...videoConference,
                      url: e.target.value
                    })}
                    placeholder="Meeting URL"
                    className="ml-7 flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#37bd7e]/50"
                  />
                )}
              </div>

              {/* Attendees */}
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-400">Guests</span>
                </div>
                <div className="ml-7 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={newAttendee}
                      onChange={(e) => setNewAttendee(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addAttendee()}
                      placeholder="Add guests"
                      className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#37bd7e]/50"
                    />
                    <button
                      onClick={addAttendee}
                      className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {attendees.map((email, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-800 rounded">
                      <span className="text-sm">{email}</span>
                      <button
                        onClick={() => removeAttendee(email)}
                        className="text-gray-400 hover:text-red-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-400">Description</span>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add description"
                  rows={3}
                  className="ml-7 w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#37bd7e]/50 resize-none"
                />
              </div>

              {/* Category & Color */}
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Palette className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-400">Category & Color</span>
                </div>
                <div className="ml-7 space-y-2">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as CalendarEvent['category'])}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#37bd7e]/50"
                  >
                    <option value="meeting">Meeting</option>
                    <option value="call">Call</option>
                    <option value="task">Task</option>
                    <option value="personal">Personal</option>
                    <option value="other">Other</option>
                  </select>
                  <div className="flex gap-2">
                    {eventColors.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => setColor(c.value)}
                        className={cn(
                          "w-8 h-8 rounded-full transition-transform",
                          color === c.value && "ring-2 ring-offset-2 ring-offset-gray-900 scale-110"
                        )}
                        style={{ backgroundColor: c.value }}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Reminders */}
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Bell className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-400">Reminders</span>
                </div>
                <div className="ml-7 space-y-2">
                  {reminders.map((reminder, idx) => (
                    <div key={idx} className="flex gap-2">
                      <select
                        value={reminder.method}
                        onChange={(e) => updateReminder(idx, {
                          ...reminder,
                          method: e.target.value as Reminder['method']
                        })}
                        className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#37bd7e]/50"
                      >
                        <option value="popup">Notification</option>
                        <option value="email">Email</option>
                      </select>
                      <select
                        value={reminder.minutes}
                        onChange={(e) => updateReminder(idx, {
                          ...reminder,
                          minutes: parseInt(e.target.value)
                        })}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#37bd7e]/50"
                      >
                        {reminderOptions.map(opt => (
                          <option key={opt.minutes} value={opt.minutes}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => removeReminder(idx)}
                        className="p-1 text-gray-400 hover:text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addReminder}
                    className="text-sm text-[#37bd7e] hover:text-[#2da76c] flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add reminder
                  </button>
                </div>
              </div>

              {/* Advanced Options */}
              <div>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"
                >
                  <ChevronDown className={cn(
                    "w-4 h-4 transition-transform",
                    showAdvanced && "rotate-180"
                  )} />
                  Advanced options
                </button>
                {showAdvanced && (
                  <div className="mt-3 space-y-3 p-3 bg-gray-800/50 rounded-lg">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={busy}
                        onChange={(e) => setBusy(e.target.checked)}
                        className="rounded border-gray-600 text-[#37bd7e] focus:ring-[#37bd7e]"
                      />
                      <span className="text-sm">Mark as busy</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">Visibility:</span>
                      <select
                        value={visibility}
                        onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}
                        className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#37bd7e]/50"
                      >
                        <option value="public">Public</option>
                        <option value="private">Private</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t border-gray-800">
              <div>
                {event && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleDeleteClick}
                    className="px-4 py-2 text-red-400 hover:text-red-300 transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </motion.button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleClose}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSave}
                  disabled={!title || createEvent.isPending || updateEvent.isPending}
                  className="px-6 py-2 bg-[#37bd7e] hover:bg-[#2da76c] text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {event ? 'Update' : 'Save'}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={handleDeleteConfirm}
        title="Delete Event?"
        description={`Are you sure you want to delete "${event?.title || 'this event'}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        isLoading={deleteEvent.isPending}
      />
    </AnimatePresence>
  );
}