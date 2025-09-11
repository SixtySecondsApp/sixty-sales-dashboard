import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  Users,
  ChevronLeft,
  ChevronRight,
  Search,
  Copy,
  Send,
  X,
  Check,
  AlertCircle,
  Coffee,
  Video,
  Phone,
  MapPin,
  Loader2,
  Settings,
  Plus,
  Minus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addDays, addWeeks, setHours, setMinutes, isSameDay, isWeekend, addMinutes } from 'date-fns';
import { toast } from 'sonner';

interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
  conflict?: string;
}

interface AvailabilityPreferences {
  workingHours: {
    start: string; // "09:00"
    end: string;   // "17:00"
  };
  workingDays: number[]; // 1-5 for Monday-Friday
  meetingDuration: number; // in minutes
  bufferTime: number; // minutes between meetings
  lunchBreak?: {
    start: string;
    end: string;
  };
  timezone: string;
}

interface CalendarAvailabilityProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSlot?: (slot: TimeSlot) => void;
  existingEvents?: any[];
  preferences?: AvailabilityPreferences;
}

const defaultPreferences: AvailabilityPreferences = {
  workingHours: {
    start: '09:00',
    end: '17:00'
  },
  workingDays: [1, 2, 3, 4, 5], // Monday to Friday
  meetingDuration: 30,
  bufferTime: 15,
  lunchBreak: {
    start: '12:00',
    end: '13:00'
  },
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
};

const meetingTypes = [
  { id: 'coffee', label: 'Coffee Chat', duration: 15, icon: Coffee },
  { id: 'call', label: 'Phone Call', duration: 30, icon: Phone },
  { id: 'video', label: 'Video Meeting', duration: 45, icon: Video },
  { id: 'in-person', label: 'In-Person', duration: 60, icon: MapPin }
];

export function CalendarAvailability({
  isOpen,
  onClose,
  onSelectSlot,
  existingEvents = [],
  preferences = defaultPreferences
}: CalendarAvailabilityProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [selectedMeetingType, setSelectedMeetingType] = useState(meetingTypes[1]);
  const [duration, setDuration] = useState(30);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [workPreferences, setWorkPreferences] = useState(preferences);
  const [proposedTimes, setProposedTimes] = useState<TimeSlot[]>([]);
  const [shareableLink, setShareableLink] = useState('');

  // Find available time slots
  useEffect(() => {
    if (selectedDate) {
      findAvailableSlots(selectedDate);
    }
  }, [selectedDate, duration, workPreferences, existingEvents]);

  const findAvailableSlots = (date: Date) => {
    const slots: TimeSlot[] = [];
    const dayOfWeek = date.getDay();
    
    // Check if it's a working day
    if (!workPreferences.workingDays.includes(dayOfWeek === 0 ? 7 : dayOfWeek)) {
      setAvailableSlots([]);
      return;
    }

    // Parse working hours
    const [startHour, startMin] = workPreferences.workingHours.start.split(':').map(Number);
    const [endHour, endMin] = workPreferences.workingHours.end.split(':').map(Number);
    
    let currentSlot = setMinutes(setHours(date, startHour), startMin);
    const endTime = setMinutes(setHours(date, endHour), endMin);

    while (currentSlot < endTime) {
      const slotEnd = addMinutes(currentSlot, duration);
      
      // Check if slot is within working hours
      if (slotEnd <= endTime) {
        // Check for lunch break
        const isLunchTime = workPreferences.lunchBreak && 
          isTimeInRange(currentSlot, slotEnd, workPreferences.lunchBreak);
        
        // Check for conflicts with existing events
        const hasConflict = existingEvents.some(event => {
          const eventStart = new Date(event.start);
          const eventEnd = new Date(event.end);
          return (currentSlot < eventEnd && slotEnd > eventStart);
        });

        if (!isLunchTime && !hasConflict) {
          slots.push({
            start: new Date(currentSlot),
            end: slotEnd,
            available: true
          });
        } else if (hasConflict) {
          const conflictingEvent = existingEvents.find(event => {
            const eventStart = new Date(event.start);
            const eventEnd = new Date(event.end);
            return (currentSlot < eventEnd && slotEnd > eventStart);
          });
          slots.push({
            start: new Date(currentSlot),
            end: slotEnd,
            available: false,
            conflict: conflictingEvent?.title || 'Busy'
          });
        }
      }
      
      // Move to next slot with buffer time
      currentSlot = addMinutes(currentSlot, duration + workPreferences.bufferTime);
    }

    setAvailableSlots(slots);
  };

  const isTimeInRange = (start: Date, end: Date, range: { start: string; end: string }) => {
    const [rangeStartHour, rangeStartMin] = range.start.split(':').map(Number);
    const [rangeEndHour, rangeEndMin] = range.end.split(':').map(Number);
    
    const rangeStart = setMinutes(setHours(start, rangeStartHour), rangeStartMin);
    const rangeEnd = setMinutes(setHours(start, rangeEndHour), rangeEndMin);
    
    return (start < rangeEnd && end > rangeStart);
  };

  const findNextAvailable = async () => {
    setIsSearching(true);
    const slots: TimeSlot[] = [];
    let currentDate = new Date();
    let daysChecked = 0;
    
    while (slots.length < 5 && daysChecked < 30) {
      currentDate = addDays(currentDate, 1);
      const daySlots = await checkDayAvailability(currentDate);
      const availableSlots = daySlots.filter(s => s.available);
      
      if (availableSlots.length > 0) {
        slots.push(availableSlots[0]);
      }
      
      daysChecked++;
    }
    
    setProposedTimes(slots);
    setIsSearching(false);
  };

  const checkDayAvailability = async (date: Date): Promise<TimeSlot[]> => {
    // Simulate API call to check availability
    return new Promise((resolve) => {
      setTimeout(() => {
        const slots: TimeSlot[] = [];
        const dayOfWeek = date.getDay();
        
        if (!workPreferences.workingDays.includes(dayOfWeek === 0 ? 7 : dayOfWeek)) {
          resolve([]);
          return;
        }

        const [startHour] = workPreferences.workingHours.start.split(':').map(Number);
        const morningSlot = setHours(date, startHour);
        const afternoonSlot = setHours(date, 14);
        
        slots.push({
          start: morningSlot,
          end: addMinutes(morningSlot, duration),
          available: Math.random() > 0.3
        });
        
        slots.push({
          start: afternoonSlot,
          end: addMinutes(afternoonSlot, duration),
          available: Math.random() > 0.3
        });
        
        resolve(slots);
      }, 100);
    });
  };

  const handleSelectSlot = (slot: TimeSlot) => {
    setSelectedSlot(slot);
    if (onSelectSlot) {
      onSelectSlot(slot);
    }
  };

  const copySlotToClipboard = (slot: TimeSlot) => {
    const text = `Available: ${format(slot.start, 'EEEE, MMMM d')} at ${format(slot.start, 'h:mm a')} - ${format(slot.end, 'h:mm a')} (${workPreferences.timezone})`;
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const generateShareableLink = () => {
    // Generate a shareable calendar link
    const baseUrl = window.location.origin;
    const params = new URLSearchParams({
      date: selectedDate.toISOString(),
      duration: duration.toString(),
      timezone: workPreferences.timezone
    });
    const link = `${baseUrl}/calendar/book?${params.toString()}`;
    setShareableLink(link);
    navigator.clipboard.writeText(link);
    toast.success('Booking link copied to clipboard');
  };

  const sendAvailability = () => {
    if (proposedTimes.length === 0) {
      toast.error('Please find available times first');
      return;
    }
    
    const message = proposedTimes.map(slot => 
      `• ${format(slot.start, 'EEEE, MMMM d')} at ${format(slot.start, 'h:mm a')}`
    ).join('\n');
    
    navigator.clipboard.writeText(`Here are my available times:\n\n${message}\n\nTimezone: ${workPreferences.timezone}`);
    toast.success('Availability copied to clipboard');
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = direction === 'next' 
      ? addWeeks(selectedWeek, 1)
      : addWeeks(selectedWeek, -1);
    setSelectedWeek(newWeek);
    setSelectedDate(newWeek);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#37bd7e]" />
                Find Available Time
              </h2>
              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowPreferences(!showPreferences)}
                  className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex">
              {/* Left Panel - Calendar & Settings */}
              <div className="w-1/2 border-r border-gray-800 p-4 overflow-y-auto">
                {/* Meeting Type Selection */}
                <div className="mb-4">
                  <label className="text-sm text-gray-400 mb-2 block">Meeting Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {meetingTypes.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => {
                          setSelectedMeetingType(type);
                          setDuration(type.duration);
                        }}
                        className={cn(
                          "p-3 rounded-lg border transition-colors flex items-center gap-2",
                          selectedMeetingType.id === type.id
                            ? "bg-[#37bd7e]/20 border-[#37bd7e] text-[#37bd7e]"
                            : "bg-gray-800 border-gray-700 hover:border-gray-600"
                        )}
                      >
                        <type.icon className="w-4 h-4" />
                        <div className="text-left">
                          <div className="text-sm font-medium">{type.label}</div>
                          <div className="text-xs text-gray-400">{type.duration} min</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duration Adjustment */}
                <div className="mb-4">
                  <label className="text-sm text-gray-400 mb-2 block">Duration</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDuration(Math.max(15, duration - 15))}
                      className="p-2 bg-gray-800 hover:bg-gray-700 rounded transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <div className="flex-1 text-center py-2 bg-gray-800 rounded">
                      {duration} minutes
                    </div>
                    <button
                      onClick={() => setDuration(Math.min(120, duration + 15))}
                      className="p-2 bg-gray-800 hover:bg-gray-700 rounded transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Week Navigation */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <button
                      onClick={() => navigateWeek('prev')}
                      className="p-1 hover:bg-gray-800 rounded transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-medium">
                      {format(selectedWeek, 'MMMM yyyy')}
                    </span>
                    <button
                      onClick={() => navigateWeek('next')}
                      className="p-1 hover:bg-gray-800 rounded transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Mini Calendar */}
                  <div className="grid grid-cols-7 gap-1">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                      <div key={idx} className="text-center text-xs text-gray-400 py-1">
                        {day}
                      </div>
                    ))}
                    {Array.from({ length: 35 }, (_, i) => {
                      const date = addDays(selectedWeek, i - selectedWeek.getDay());
                      const isToday = isSameDay(date, new Date());
                      const isSelected = isSameDay(date, selectedDate);
                      const isWorkingDay = workPreferences.workingDays.includes(
                        date.getDay() === 0 ? 7 : date.getDay()
                      );
                      
                      return (
                        <button
                          key={i}
                          onClick={() => setSelectedDate(date)}
                          disabled={!isWorkingDay}
                          className={cn(
                            "aspect-square rounded-lg text-sm transition-colors",
                            isSelected && "bg-[#37bd7e] text-white",
                            !isSelected && isToday && "bg-gray-800 text-[#37bd7e]",
                            !isSelected && !isToday && isWorkingDay && "hover:bg-gray-800",
                            !isWorkingDay && "text-gray-600 cursor-not-allowed"
                          )}
                        >
                          {format(date, 'd')}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="space-y-2">
                  <button
                    onClick={findNextAvailable}
                    disabled={isSearching}
                    className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Finding times...
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        Find Next Available
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={generateShareableLink}
                    className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Booking Link
                  </button>
                </div>

                {/* Preferences (when expanded) */}
                {showPreferences && (
                  <div className="mt-4 p-3 bg-gray-800/50 rounded-lg space-y-3">
                    <h3 className="text-sm font-medium mb-2">Availability Preferences</h3>
                    
                    <div>
                      <label className="text-xs text-gray-400">Working Hours</label>
                      <div className="flex gap-2 mt-1">
                        <input
                          type="time"
                          value={workPreferences.workingHours.start}
                          onChange={(e) => setWorkPreferences({
                            ...workPreferences,
                            workingHours: {
                              ...workPreferences.workingHours,
                              start: e.target.value
                            }
                          })}
                          className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                        />
                        <span className="text-gray-400">to</span>
                        <input
                          type="time"
                          value={workPreferences.workingHours.end}
                          onChange={(e) => setWorkPreferences({
                            ...workPreferences,
                            workingHours: {
                              ...workPreferences.workingHours,
                              end: e.target.value
                            }
                          })}
                          className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-gray-400">Buffer Between Meetings</label>
                      <select
                        value={workPreferences.bufferTime}
                        onChange={(e) => setWorkPreferences({
                          ...workPreferences,
                          bufferTime: parseInt(e.target.value)
                        })}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm mt-1"
                      >
                        <option value="0">No buffer</option>
                        <option value="5">5 minutes</option>
                        <option value="10">10 minutes</option>
                        <option value="15">15 minutes</option>
                        <option value="30">30 minutes</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Panel - Available Times */}
              <div className="flex-1 p-4 overflow-y-auto">
                <h3 className="text-sm font-medium text-gray-400 mb-3">
                  Available times for {format(selectedDate, 'EEEE, MMMM d')}
                </h3>

                {/* Available Slots */}
                <div className="space-y-2 mb-4">
                  {availableSlots.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No available slots on this day</p>
                      <p className="text-sm mt-1">Try selecting a different date</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {availableSlots.filter(s => s.available).map((slot, idx) => (
                        <motion.button
                          key={idx}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleSelectSlot(slot)}
                          className={cn(
                            "p-3 rounded-lg border transition-all",
                            selectedSlot === slot
                              ? "bg-[#37bd7e]/20 border-[#37bd7e] text-[#37bd7e]"
                              : "bg-gray-800 border-gray-700 hover:border-gray-600"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">
                                {format(slot.start, 'h:mm a')}
                              </div>
                              <div className="text-xs text-gray-400">
                                {duration} minutes
                              </div>
                            </div>
                            {selectedSlot === slot && (
                              <Check className="w-4 h-4" />
                            )}
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Proposed Times (from search) */}
                {proposedTimes.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-medium text-gray-400 mb-3">
                      Suggested Times
                    </h3>
                    <div className="space-y-2">
                      {proposedTimes.map((slot, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-gray-800 rounded-lg flex items-center justify-between"
                        >
                          <div>
                            <div className="font-medium">
                              {format(slot.start, 'EEEE, MMMM d')}
                            </div>
                            <div className="text-sm text-gray-400">
                              {format(slot.start, 'h:mm a')} - {format(slot.end, 'h:mm a')}
                            </div>
                          </div>
                          <button
                            onClick={() => copySlotToClipboard(slot)}
                            className="p-2 hover:bg-gray-700 rounded transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Shareable Link */}
                {shareableLink && (
                  <div className="mt-6 p-3 bg-gray-800/50 rounded-lg">
                    <div className="text-sm text-gray-400 mb-2">Booking Link:</div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={shareableLink}
                        readOnly
                        className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(shareableLink);
                          toast.success('Link copied');
                        }}
                        className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t border-gray-800">
              <div className="text-sm text-gray-400">
                Timezone: {workPreferences.timezone}
              </div>
              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onClose}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </motion.button>
                {selectedSlot && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      if (onSelectSlot) {
                        onSelectSlot(selectedSlot);
                      }
                      toast.success('Time slot selected');
                      onClose();
                    }}
                    className="px-6 py-2 bg-[#37bd7e] hover:bg-[#2da76c] text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Confirm Time
                  </motion.button>
                )}
                {proposedTimes.length > 0 && !selectedSlot && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={sendAvailability}
                    className="px-6 py-2 bg-[#37bd7e] hover:bg-[#2da76c] text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Send Availability
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}