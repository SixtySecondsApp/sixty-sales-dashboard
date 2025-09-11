import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarEvent } from '@/pages/Calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  Calendar,
  Clock,
  MapPin,
  Users,
  Tag,
  Send,
  Lightbulb,
  Zap
} from 'lucide-react';

interface CalendarQuickAddProps {
  onEventCreate: (event: Partial<CalendarEvent>) => void;
}

interface ParsedEvent {
  title: string;
  start?: Date;
  end?: Date;
  category?: CalendarEvent['category'];
  description?: string;
  location?: string;
  allDay?: boolean;
  confidence: number;
  suggestions?: string[];
}

const QUICK_PHRASES = [
  "Meeting with John tomorrow at 2pm",
  "Call client next Monday 10am",
  "Team standup daily at 9am",
  "Follow up with ABC Corp Friday",
  "Lunch with Sarah at noon",
  "Sales presentation Tuesday 3pm"
];

const TIME_PATTERNS = [
  { pattern: /(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i, type: '12hour' },
  { pattern: /(\d{1,2}):(\d{2})/i, type: '24hour' },
  { pattern: /(noon|midnight)/i, type: 'special' },
  { pattern: /(\d{1,2})\s*(am|pm)/i, type: '12hour' },
];

const DATE_PATTERNS = [
  { pattern: /today/i, offset: 0 },
  { pattern: /tomorrow/i, offset: 1 },
  { pattern: /(next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i, type: 'dayname' },
  { pattern: /(\d{1,2})\/(\d{1,2})/i, type: 'date' },
  { pattern: /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/i, type: 'monthday' },
];

const CATEGORY_KEYWORDS = {
  meeting: ['meeting', 'meet', 'sync', 'standup', 'review', 'discussion', 'conference'],
  call: ['call', 'phone', 'ring', 'dial', 'talk'],
  task: ['task', 'todo', 'work', 'complete', 'finish', 'do'],
  deal: ['deal', 'sales', 'pitch', 'presentation', 'proposal', 'close'],
  personal: ['personal', 'lunch', 'dinner', 'coffee', 'break', 'appointment'],
  'follow-up': ['follow', 'followup', 'follow-up', 'check', 'touch base'],
};

export const CalendarQuickAdd: React.FC<CalendarQuickAddProps> = ({ onEventCreate }) => {
  const [input, setInput] = useState('');
  const [parsedEvent, setParsedEvent] = useState<ParsedEvent | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Parse natural language input
  const parseInput = (text: string): ParsedEvent => {
    const lowerText = text.toLowerCase();
    const words = lowerText.split(/\s+/);
    
    let title = text;
    let start: Date | undefined;
    let end: Date | undefined;
    let category: CalendarEvent['category'] = 'meeting';
    let description = '';
    let location = '';
    let allDay = false;
    let confidence = 0.5;

    // Extract time
    let timeMatch = null;
    for (const timePattern of TIME_PATTERNS) {
      const match = text.match(timePattern.pattern);
      if (match) {
        timeMatch = match;
        break;
      }
    }

    // Extract date
    let dateBase = new Date();
    for (const datePattern of DATE_PATTERNS) {
      const match = text.match(datePattern.pattern);
      if (match) {
        if (datePattern.offset !== undefined) {
          dateBase = new Date();
          dateBase.setDate(dateBase.getDate() + datePattern.offset);
        } else if (datePattern.type === 'dayname') {
          const dayName = match[2];
          const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const targetDay = daysOfWeek.indexOf(dayName);
          if (targetDay !== -1) {
            dateBase = getNextWeekday(new Date(), targetDay);
          }
        }
        break;
      }
    }

    // Set time if found
    if (timeMatch) {
      if (timeMatch[0].toLowerCase().includes('noon')) {
        start = new Date(dateBase);
        start.setHours(12, 0, 0, 0);
      } else if (timeMatch[0].toLowerCase().includes('midnight')) {
        start = new Date(dateBase);
        start.setHours(0, 0, 0, 0);
      } else {
        let hour = parseInt(timeMatch[1]);
        const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
        const period = timeMatch[3];

        if (period && period.toLowerCase() === 'pm' && hour !== 12) {
          hour += 12;
        } else if (period && period.toLowerCase() === 'am' && hour === 12) {
          hour = 0;
        }

        start = new Date(dateBase);
        start.setHours(hour, minute, 0, 0);
      }
      confidence += 0.3;
    } else {
      // Default to next hour if no time specified
      start = new Date(dateBase);
      start.setHours(start.getHours() + 1, 0, 0, 0);
    }

    // Determine category based on keywords
    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        category = cat as CalendarEvent['category'];
        confidence += 0.2;
        break;
      }
    }

    // Extract location (simple heuristic)
    const atMatch = text.match(/\sat\s+([^,\n]+?)(?:\s+(?:on|at|from|\d)|\s*$)/i);
    if (atMatch && !timeMatch?.includes(atMatch[0])) {
      location = atMatch[1].trim();
      confidence += 0.1;
    }

    // Clean up title (remove parsed elements)
    title = text
      .replace(/\s*(today|tomorrow|next\s+\w+|\d{1,2}\/\d{1,2})\s*/gi, '')
      .replace(/\s*\d{1,2}(?::\d{2})?\s*(am|pm)\s*/gi, '')
      .replace(/\s*(at|on|from)\s+[^,\n]*$/gi, '')
      .trim();

    if (!title) {
      title = 'New Event';
    }

    return {
      title,
      start,
      end,
      category,
      description,
      location,
      allDay,
      confidence,
    };
  };

  // Get next occurrence of a weekday
  const getNextWeekday = (date: Date, targetDay: number): Date => {
    const result = new Date(date);
    const currentDay = result.getDay();
    let daysUntilTarget = targetDay - currentDay;
    
    if (daysUntilTarget <= 0) {
      daysUntilTarget += 7; // Next week
    }
    
    result.setDate(result.getDate() + daysUntilTarget);
    return result;
  };

  // Handle input change
  useEffect(() => {
    if (input.trim()) {
      setIsProcessing(true);
      const timer = setTimeout(() => {
        const parsed = parseInput(input);
        setParsedEvent(parsed);
        setIsProcessing(false);
      }, 300);

      return () => clearTimeout(timer);
    } else {
      setParsedEvent(null);
      setIsProcessing(false);
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedEvent && parsedEvent.title) {
      onEventCreate(parsedEvent);
      setInput('');
      setParsedEvent(null);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-400';
    if (confidence >= 0.5) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High confidence';
    if (confidence >= 0.5) return 'Medium confidence';
    return 'Low confidence - please review';
  };

  return (
    <div className="relative z-50">
      {/* Quick Add Input */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <Sparkles className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-emerald-400" />
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="Try: 'Meeting with John tomorrow at 2pm' or 'Call client Monday 10am'"
            className="pl-10 pr-24 bg-gray-800/90 border-gray-700/50 text-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
          />
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
            {isProcessing && (
              <div className="animate-spin w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full" />
            )}
            <Button
              type="submit"
              size="sm"
              disabled={!parsedEvent || !parsedEvent.title}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1"
            >
              <Send className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* AI Suggestions */}
        <AnimatePresence>
          {showSuggestions && !input && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-700/50 rounded-lg shadow-xl z-[100] isolate"
            >
              <div className="p-3 border-b border-gray-700/50">
                <div className="flex items-center space-x-2">
                  <Lightbulb className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm font-medium text-gray-200">AI Suggestions</span>
                </div>
              </div>
              <div className="p-2">
                {QUICK_PHRASES.map((phrase, index) => (
                  <motion.button
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleSuggestionClick(phrase)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700/50 rounded-md transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      <Zap className="w-3 h-3 text-emerald-400" />
                      <span>"{phrase}"</span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      {/* Parsed Event Preview */}
      <AnimatePresence>
        {parsedEvent && parsedEvent.title && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-3 p-3 bg-gray-800/30 border border-gray-700/50 rounded-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium text-gray-200">AI Parsed Event</span>
              </div>
              <Badge
                variant="outline"
                className={`text-xs ${getConfidenceColor(parsedEvent.confidence)} border-current`}
              >
                {Math.round(parsedEvent.confidence * 100)}% confident
              </Badge>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center space-x-2">
                <Tag className="w-3 h-3 text-gray-400" />
                <span className="font-medium text-gray-200">{parsedEvent.title}</span>
                <Badge variant="secondary" className="text-xs capitalize">
                  {parsedEvent.category}
                </Badge>
              </div>

              {parsedEvent.start && (
                <div className="flex items-center space-x-2">
                  <Clock className="w-3 h-3 text-gray-400" />
                  <span className="text-gray-300">
                    {parsedEvent.start.toLocaleDateString()} at {parsedEvent.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}

              {parsedEvent.location && (
                <div className="flex items-center space-x-2">
                  <MapPin className="w-3 h-3 text-gray-400" />
                  <span className="text-gray-300">{parsedEvent.location}</span>
                </div>
              )}
            </div>

            {parsedEvent.confidence < 0.5 && (
              <div className="mt-2 p-2 bg-yellow-600/20 border border-yellow-600/30 rounded text-xs text-yellow-200">
                <span className="font-medium">Low confidence:</span> Please review the parsed details before creating
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};