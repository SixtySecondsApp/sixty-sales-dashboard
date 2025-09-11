import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Calendar,
  Clock,
  Users,
  MapPin,
  Zap,
  Brain,
  Target,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  Send,
  Sparkles,
  BarChart3,
  Settings,
  RefreshCw,
  Plus,
  Wand2,
  Coffee,
  Moon,
  Sun,
  Activity,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  X,
  Lightbulb,
  Timer,
  UserCheck,
} from 'lucide-react';

import {
  calendarAIService,
  type OptimalMeetingTime,
  type SmartSchedulingSuggestion,
  type CalendarAnalytics,
  type ParsedEvent,
  type MeetingPreferences,
} from '../../lib/services/calendarAIService';
import { parseDateFromNaturalLanguage } from '../../lib/utils/nlpUtils';

interface CalendarAIAssistantProps {
  events: Array<{
    id: string;
    title: string;
    start: Date;
    end: Date;
    attendees?: string[];
  }>;
  onEventCreate?: (event: ParsedEvent) => void;
  onEventUpdate?: (eventId: string, updates: any) => void;
  onSuggestionApply?: (suggestion: SmartSchedulingSuggestion) => void;
  preferences?: Partial<MeetingPreferences>;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  data?: any;
  actionable?: boolean;
  actions?: Array<{
    label: string;
    action: string;
    data: any;
  }>;
}

export const CalendarAIAssistant: React.FC<CalendarAIAssistantProps> = ({
  events,
  onEventCreate,
  onEventUpdate,
  onSuggestionApply,
  preferences,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'insights' | 'schedule' | 'analytics'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggestions, setSuggestions] = useState<SmartSchedulingSuggestion[]>([]);
  const [analytics, setAnalytics] = useState<CalendarAnalytics | null>(null);
  const [optimalTimes, setOptimalTimes] = useState<OptimalMeetingTime[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initializeAssistant();
  }, [events]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initializeAssistant = async () => {
    // Generate initial suggestions
    const newSuggestions = await calendarAIService.generateSchedulingSuggestions(events, preferences);
    setSuggestions(newSuggestions);

    // Analyze calendar
    const calendarAnalytics = await calendarAIService.analyzeCalendar(events);
    setAnalytics(calendarAnalytics);

    // Add welcome message if no messages exist
    if (messages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        type: 'assistant',
        content: `👋 Hi! I'm your AI calendar assistant. I can help you schedule meetings, analyze your calendar patterns, and optimize your time. ${
          newSuggestions.length > 0 
            ? `I've found ${newSuggestions.length} suggestions to improve your schedule!` 
            : "What would you like to do today?"
        }`,
        timestamp: new Date(),
        actionable: newSuggestions.length > 0,
        actions: newSuggestions.length > 0 ? [
          { label: 'View Suggestions', action: 'show_suggestions', data: newSuggestions }
        ] : undefined,
      };
      setMessages([welcomeMessage]);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isProcessing) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      type: 'user',
      content: message,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsProcessing(true);

    try {
      const response = await processUserInput(message);
      setMessages(prev => [...prev, response]);
    } catch (error) {
      console.error('Failed to process message:', error);
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        type: 'assistant',
        content: "I'm sorry, I encountered an error processing your request. Please try again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const processUserInput = async (input: string): Promise<ChatMessage> => {
    const lowerInput = input.toLowerCase();

    // Schedule meeting intent
    if (lowerInput.includes('schedule') || lowerInput.includes('meeting') || lowerInput.includes('book')) {
      const parsedEvent = await calendarAIService.parseNaturalLanguageEvent(input);
      
      return {
        id: `msg-${Date.now()}`,
        type: 'assistant',
        content: `I've parsed your meeting request:\n\n**${parsedEvent.title}**\n${
          parsedEvent.start ? `📅 ${parsedEvent.start.toLocaleString()}` : '⏰ No specific time mentioned'
        }\n${
          parsedEvent.duration ? `⏱️ ${parsedEvent.duration} minutes` : ''
        }\n${
          parsedEvent.attendees && parsedEvent.attendees.length > 0 
            ? `👥 Attendees: ${parsedEvent.attendees.join(', ')}` 
            : ''
        }\n\nWould you like me to find optimal times or create this event?`,
        timestamp: new Date(),
        data: parsedEvent,
        actionable: true,
        actions: [
          { label: 'Find Optimal Times', action: 'find_optimal_times', data: parsedEvent },
          { label: 'Create Event', action: 'create_event', data: parsedEvent },
        ],
      };
    }

    // Find optimal time intent
    if (lowerInput.includes('find time') || lowerInput.includes('optimal time') || lowerInput.includes('when should')) {
      const duration = 60; // Default 1 hour
      const dateRange = {
        start: new Date(),
        end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next 7 days
      };

      const optimalSlots = await calendarAIService.findOptimalMeetingTimes(
        duration,
        [],
        dateRange,
        preferences,
        events
      );

      setOptimalTimes(optimalSlots);

      return {
        id: `msg-${Date.now()}`,
        type: 'assistant',
        content: `I found ${optimalSlots.length} optimal time slots for your meeting. The best option is:\n\n🎯 **${optimalSlots[0]?.start.toLocaleString()}**\nScore: ${(optimalSlots[0]?.score * 100).toFixed(0)}%\nReasons: ${optimalSlots[0]?.factors.join(', ')}\n\nWould you like to see more options or schedule this time?`,
        timestamp: new Date(),
        data: optimalSlots,
        actionable: optimalSlots.length > 0,
        actions: optimalSlots.length > 0 ? [
          { label: 'See All Times', action: 'show_optimal_times', data: optimalSlots },
          { label: 'Schedule Best Time', action: 'schedule_optimal', data: optimalSlots[0] },
        ] : undefined,
      };
    }

    // Analytics intent
    if (lowerInput.includes('analyze') || lowerInput.includes('statistics') || lowerInput.includes('patterns')) {
      if (!analytics) {
        const calendarAnalytics = await calendarAIService.analyzeCalendar(events);
        setAnalytics(calendarAnalytics);
      }

      return {
        id: `msg-${Date.now()}`,
        type: 'assistant',
        content: `Here's your calendar analysis:\n\n📊 **Meeting Stats**\n• ${analytics?.meetingStats.totalMeetings} meetings this week\n• ${analytics?.meetingStats.averageDuration.toFixed(0)} min average duration\n• ${analytics?.meetingStats.meetingDensity.toFixed(1)} meetings per day\n\n⚡ **Efficiency**\n• ${analytics?.efficiency.backToBackPercentage.toFixed(1)}% back-to-back meetings\n• ${Math.floor((analytics?.timeAllocation.freeTime || 0) / 60)} hours of free time daily\n\n🕐 **Patterns**\n• Busiest hours: ${analytics?.patterns.busiestHours.map(h => `${h}:00`).join(', ')}\n• Most common meeting type: ${Object.entries(analytics?.patterns.meetingTypes || {}).sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A'}`,
        timestamp: new Date(),
        data: analytics,
        actionable: true,
        actions: [
          { label: 'View Full Analytics', action: 'show_analytics', data: analytics },
        ],
      };
    }

    // Suggestions intent
    if (lowerInput.includes('suggest') || lowerInput.includes('improve') || lowerInput.includes('optimize')) {
      return {
        id: `msg-${Date.now()}`,
        type: 'assistant',
        content: `I have ${suggestions.length} suggestions to optimize your calendar:\n\n${suggestions.slice(0, 3).map((s, i) => 
          `${i + 1}. **${s.title}**\n   ${s.description}\n   Impact: ${s.impact} • Confidence: ${(s.confidence * 100).toFixed(0)}%`
        ).join('\n\n')}\n\nWould you like me to apply any of these suggestions?`,
        timestamp: new Date(),
        data: suggestions,
        actionable: suggestions.length > 0,
        actions: suggestions.length > 0 ? [
          { label: 'View All Suggestions', action: 'show_suggestions', data: suggestions },
          { label: 'Apply Top Suggestion', action: 'apply_suggestion', data: suggestions[0] },
        ] : undefined,
      };
    }

    // Default response
    return {
      id: `msg-${Date.now()}`,
      type: 'assistant',
      content: `I can help you with:\n\n• 📅 **Schedule meetings** - "Schedule a meeting with John tomorrow at 2pm"\n• 🎯 **Find optimal times** - "When's the best time for a 1-hour meeting?"\n• 📊 **Analyze your calendar** - "Show me my meeting patterns"\n• 💡 **Optimize your schedule** - "How can I improve my calendar?"\n\nWhat would you like to do?`,
      timestamp: new Date(),
      actionable: true,
      actions: [
        { label: 'Schedule Meeting', action: 'prompt_schedule', data: null },
        { label: 'Find Optimal Time', action: 'prompt_optimal', data: null },
        { label: 'View Analytics', action: 'show_analytics', data: analytics },
      ],
    };
  };

  const handleAction = async (action: string, data: any) => {
    switch (action) {
      case 'create_event':
        onEventCreate?.(data);
        addAssistantMessage(`✅ Event "${data.title}" has been created!`);
        break;

      case 'find_optimal_times':
        const optimalSlots = await calendarAIService.findOptimalMeetingTimes(
          data.duration || 60,
          data.attendees || [],
          {
            start: new Date(),
            end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
          preferences,
          events
        );
        setOptimalTimes(optimalSlots);
        setActiveTab('schedule');
        addAssistantMessage(`Found ${optimalSlots.length} optimal time slots! Check the Schedule tab.`);
        break;

      case 'show_suggestions':
        setActiveTab('insights');
        addAssistantMessage(`Showing ${data.length} scheduling suggestions in the Insights tab.`);
        break;

      case 'show_analytics':
        setActiveTab('analytics');
        addAssistantMessage('Calendar analytics are now displayed in the Analytics tab.');
        break;

      case 'apply_suggestion':
        onSuggestionApply?.(data);
        addAssistantMessage(`Applied suggestion: ${data.title}`);
        break;

      case 'schedule_optimal':
        const event: ParsedEvent = {
          title: 'New Meeting',
          start: data.start,
          end: data.end,
          priority: 3,
          confidence: data.score,
        };
        onEventCreate?.(event);
        addAssistantMessage(`✅ Meeting scheduled for ${data.start.toLocaleString()}`);
        break;

      case 'prompt_schedule':
        setInputValue('Schedule a meeting with ');
        break;

      case 'prompt_optimal':
        setInputValue('Find the best time for a ');
        break;
    }
  };

  const addAssistantMessage = (content: string) => {
    const message: ChatMessage = {
      id: `msg-${Date.now()}`,
      type: 'assistant',
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, message]);
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      case 'medium': return 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30';
      case 'low': return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30';
    }
  };

  return (
    <>
      {/* Floating Assistant Button */}
      <AnimatePresence>
        {!isExpanded && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsExpanded(true)}
            className="fixed bottom-6 right-6 z-50 p-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 group"
          >
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Bot className="w-6 h-6" />
            </motion.div>
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-xs font-bold text-white">
                {suggestions.length}
              </span>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Expanded Assistant Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, x: 400 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 400 }}
            className="fixed top-0 right-0 h-full w-96 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-l border-gray-200/50 dark:border-gray-700/50 shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-200/50 dark:border-gray-700/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      AI Assistant
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Smart calendar optimization
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex space-x-1 bg-gray-100/50 dark:bg-gray-800/50 rounded-lg p-1">
                {[
                  { id: 'chat', label: 'Chat', icon: <MessageSquare className="w-4 h-4" /> },
                  { id: 'insights', label: 'Insights', icon: <Lightbulb className="w-4 h-4" /> },
                  { id: 'schedule', label: 'Schedule', icon: <Calendar className="w-4 h-4" /> },
                  { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                      activeTab === tab.id
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {tab.icon}
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              <AnimatePresence mode="wait">
                {activeTab === 'chat' && (
                  <motion.div
                    key="chat"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="h-full flex flex-col"
                  >
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] p-3 rounded-lg ${
                              message.type === 'user'
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                            }`}
                          >
                            <div className="whitespace-pre-wrap text-sm">
                              {message.content}
                            </div>
                            {message.actions && (
                              <div className="mt-3 space-y-2">
                                {message.actions.map((action, index) => (
                                  <button
                                    key={index}
                                    onClick={() => handleAction(action.action, action.data)}
                                    className="block w-full text-left px-3 py-2 bg-white/10 hover:bg-white/20 rounded-md text-sm font-medium transition-colors"
                                  >
                                    {action.label}
                                  </button>
                                ))}
                              </div>
                            )}
                            <div className="text-xs opacity-60 mt-2">
                              {message.timestamp.toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      ))}
                      {isProcessing && (
                        <div className="flex justify-start">
                          <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                            <div className="flex items-center space-x-2">
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              >
                                <Brain className="w-4 h-4 text-blue-500" />
                              </motion.div>
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                Processing...
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-4 border-t border-gray-200/50 dark:border-gray-700/50">
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={inputValue}
                          onChange={(e) => setInputValue(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(inputValue)}
                          placeholder="Ask me about your calendar..."
                          className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={isProcessing}
                        />
                        <button
                          onClick={() => handleSendMessage(inputValue)}
                          disabled={isProcessing || !inputValue.trim()}
                          className="px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'insights' && (
                  <motion.div
                    key="insights"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="p-4 space-y-4 overflow-y-auto h-full"
                  >
                    <div className="flex items-center space-x-2 mb-4">
                      <Sparkles className="w-5 h-5 text-purple-500" />
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        Smart Suggestions
                      </h4>
                    </div>

                    {suggestions.length === 0 ? (
                      <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                        <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No suggestions available</p>
                      </div>
                    ) : (
                      suggestions.map((suggestion) => (
                        <div
                          key={suggestion.id}
                          className="p-4 bg-gray-50/50 dark:bg-gray-800/50 rounded-lg border border-gray-200/50 dark:border-gray-700/50"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h5 className="font-medium text-gray-900 dark:text-white">
                              {suggestion.title}
                            </h5>
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getImpactColor(suggestion.impact)}`}>
                                {suggestion.impact}
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            {suggestion.description}
                          </p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1">
                              <Target className="w-4 h-4 text-blue-500" />
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {(suggestion.confidence * 100).toFixed(0)}% confidence
                              </span>
                            </div>
                            <button
                              onClick={() => handleAction('apply_suggestion', suggestion)}
                              className="flex items-center space-x-1 px-3 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-md text-sm font-medium transition-colors"
                            >
                              <Zap className="w-3 h-3" />
                              <span>Apply</span>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </motion.div>
                )}

                {activeTab === 'schedule' && (
                  <motion.div
                    key="schedule"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="p-4 space-y-4 overflow-y-auto h-full"
                  >
                    <div className="flex items-center space-x-2 mb-4">
                      <Calendar className="w-5 h-5 text-green-500" />
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        Optimal Times
                      </h4>
                    </div>

                    {optimalTimes.length === 0 ? (
                      <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                        <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Ask me to find optimal meeting times!</p>
                      </div>
                    ) : (
                      optimalTimes.slice(0, 5).map((time, index) => (
                        <div
                          key={index}
                          className="p-4 bg-green-50/50 dark:bg-green-900/10 rounded-lg border border-green-200/50 dark:border-green-800/50"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-medium text-gray-900 dark:text-white">
                                  {time.start.toLocaleString()}
                                </span>
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  time.score >= 0.8 ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
                                  time.score >= 0.6 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' :
                                  'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                                }`}>
                                  {(time.score * 100).toFixed(0)}%
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {time.factors.join(' • ')}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleAction('schedule_optimal', time)}
                            className="w-full mt-3 flex items-center justify-center space-x-2 px-3 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400 rounded-md text-sm font-medium transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Schedule This Time</span>
                          </button>
                        </div>
                      ))
                    )}
                  </motion.div>
                )}

                {activeTab === 'analytics' && (
                  <motion.div
                    key="analytics"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="p-4 space-y-4 overflow-y-auto h-full"
                  >
                    <div className="flex items-center space-x-2 mb-4">
                      <BarChart3 className="w-5 h-5 text-blue-500" />
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        Calendar Analytics
                      </h4>
                    </div>

                    {!analytics ? (
                      <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                        <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Analyzing your calendar patterns...</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Meeting Stats */}
                        <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg">
                          <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-3 flex items-center">
                            <Users className="w-4 h-4 mr-2" />
                            Meeting Statistics
                          </h5>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Total Meetings</span>
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {analytics.meetingStats.totalMeetings}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Avg Duration</span>
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {analytics.meetingStats.averageDuration.toFixed(0)} min
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Daily Density</span>
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {analytics.meetingStats.meetingDensity.toFixed(1)}/day
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Longest Streak</span>
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {analytics.meetingStats.longestStreak} days
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Time Allocation */}
                        <div className="p-4 bg-green-50/50 dark:bg-green-900/10 rounded-lg">
                          <h5 className="font-medium text-green-900 dark:text-green-100 mb-3 flex items-center">
                            <Clock className="w-4 h-4 mr-2" />
                            Time Allocation
                          </h5>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Focus Time</span>
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {Math.floor(analytics.timeAllocation.focusTime / 60)}h {analytics.timeAllocation.focusTime % 60}m
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Meeting Time</span>
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {Math.floor(analytics.timeAllocation.meetingTime / 60)}h {Math.floor(analytics.timeAllocation.meetingTime % 60)}m
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Free Time</span>
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {Math.floor(analytics.timeAllocation.freeTime / 60)}h {Math.floor(analytics.timeAllocation.freeTime % 60)}m
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Efficiency */}
                        <div className="p-4 bg-purple-50/50 dark:bg-purple-900/10 rounded-lg">
                          <h5 className="font-medium text-purple-900 dark:text-purple-100 mb-3 flex items-center">
                            <TrendingUp className="w-4 h-4 mr-2" />
                            Efficiency
                          </h5>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Back-to-Back %</span>
                              <span className={`font-semibold ${
                                analytics.efficiency.backToBackPercentage > 60 
                                  ? 'text-red-600 dark:text-red-400' 
                                  : 'text-green-600 dark:text-green-400'
                              }`}>
                                {analytics.efficiency.backToBackPercentage.toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Optimal Usage</span>
                              <span className="font-semibold text-green-600 dark:text-green-400">
                                {analytics.efficiency.optimalTimeUsage.toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Overlaps</span>
                              <span className={`font-semibold ${
                                analytics.efficiency.overlapCount > 0 
                                  ? 'text-red-600 dark:text-red-400' 
                                  : 'text-green-600 dark:text-green-400'
                              }`}>
                                {analytics.efficiency.overlapCount}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};