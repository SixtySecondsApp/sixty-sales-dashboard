import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Target,
  Lightbulb,
  Send,
  Edit3,
  MessageCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CopilotProps {
  onGenerateEmail?: () => void;
  onDraftEmail?: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

interface Priority {
  id: string;
  rank: number;
  title: string;
  description: string;
  color: string;
}

interface Insight {
  id: string;
  type: 'positive' | 'info';
  content: string;
  highlight?: string;
}

export const Copilot: React.FC<CopilotProps> = ({
  onGenerateEmail,
  onDraftEmail
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'user',
      content: 'What should I say to Alexander Wolf in my follow-up email?'
    },
    {
      id: '2',
      role: 'assistant',
      content: 'Based on your last meeting with Alexander on Nov 1st, here\'s what I recommend for your follow-up email:'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const priorities: Priority[] = [
    {
      id: '1',
      rank: 1,
      title: 'Follow up with Alexander Wolf',
      description: 'Last met 3 days ago • High engagement • Deal value: £65K',
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: '2',
      rank: 2,
      title: 'Address Maik Lankau\'s at-risk deal',
      description: 'No response in 11 days • Deal value: £42K • Risk level: High',
      color: 'from-amber-500 to-amber-600'
    },
    {
      id: '3',
      rank: 3,
      title: 'Prep for Russell Gentry meeting',
      description: 'Meeting at 2:00 PM today • First discovery call',
      color: 'from-purple-500 to-purple-600'
    }
  ];

  const insights: Insight[] = [
    {
      id: '1',
      type: 'positive',
      content: 'Walter Rogers opened your email 3× in the last hour',
      highlight: 'Walter Rogers'
    },
    {
      id: '2',
      type: 'info',
      content: 'Your close rate is up 15% this month',
      highlight: '15%'
    }
  ];

  const suggestedPrompts = [
    'Summarize my pipeline',
    'Show at-risk deals',
    'What meetings do I have today?',
    'Draft follow-up email'
  ];

  useEffect(() => {
    if (chatInputRef.current) {
      chatInputRef.current.style.height = 'auto';
      chatInputRef.current.style.height = `${chatInputRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newMessage]);
    setInputValue('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      setIsTyping(false);
      // In real implementation, this would be an API call
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePromptClick = (prompt: string) => {
    setInputValue(prompt);
    chatInputRef.current?.focus();
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 min-h-screen flex flex-col">
      {/* Copilot Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-100">AI Copilot</h2>
            <p className="text-sm text-gray-400">Your personal sales assistant</p>
          </div>
        </div>
      </div>

      {/* Context Cards (Today's Priorities) */}
      <div className="mb-8 space-y-4">
        {/* Priority Card */}
        <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800/50 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-gray-100">Your Top 3 Priorities Today</h3>
          </div>
          <div className="space-y-3">
            {priorities.map(priority => (
              <div
                key={priority.id}
                className="flex items-start gap-3 p-3 bg-gray-800/40 rounded-lg hover:bg-gray-800/60 transition-all cursor-pointer"
              >
                <div
                  className={cn(
                    'w-8 h-8 bg-gradient-to-br rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0',
                    priority.color
                  )}
                >
                  {priority.rank}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-100 mb-1">{priority.title}</p>
                  <p className="text-xs text-gray-400">{priority.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Insights Card */}
        <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800/50 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-semibold text-gray-100">Today's Insights</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.map(insight => (
              <div
                key={insight.id}
                className={cn(
                  'border rounded-lg p-3',
                  insight.type === 'positive'
                    ? 'bg-emerald-500/10 border-emerald-500/20'
                    : 'bg-blue-500/10 border-blue-500/20'
                )}
              >
                <p
                  className={cn(
                    'text-xs',
                    insight.type === 'positive' ? 'text-emerald-300' : 'text-blue-300'
                  )}
                >
                  {insight.highlight ? (
                    <>
                      <span className="font-semibold">{insight.highlight}</span>{' '}
                      {insight.content.replace(insight.highlight, '')}
                    </>
                  ) : (
                    insight.content
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 space-y-6 mb-6 overflow-y-auto">
        {messages.map((message, index) => (
          <div
            key={message.id}
            className={cn(
              'flex gap-3',
              message.role === 'user' ? 'justify-end' : ''
            )}
          >
            {message.role === 'assistant' && (
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
            )}
            <div
              className={cn(
                'rounded-xl px-4 py-3 max-w-2xl',
                message.role === 'user'
                  ? 'bg-blue-500/10 border border-blue-500/20'
                  : 'bg-gray-900/60 border border-gray-800/40'
              )}
            >
              {message.role === 'user' ? (
                <p className="text-sm text-gray-100">{message.content}</p>
              ) : (
                <div>
                  <p className="text-sm text-gray-100 mb-4">{message.content}</p>
                  
                  {index === messages.length - 1 && (
                    <div className="space-y-3 mb-4">
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase mb-2">
                          Key Points to Cover:
                        </p>
                        <ul className="space-y-1.5 text-sm text-gray-300">
                          <li className="flex items-start gap-2">
                            <span className="text-blue-400">•</span>
                            Reference his Q1 2026 budget timing (he mentioned this specifically)
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-blue-400">•</span>
                            Address timeline concerns with phased approach
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-blue-400">•</span>
                            Include the Crimson Literary case study he requested
                          </li>
                        </ul>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase mb-2">
                          Timing Tip:
                        </p>
                        <p className="text-sm text-gray-300">
                          Alexander opens emails quickly (avg 2.3 hours). Send between 9-10 AM EST for best engagement.
                        </p>
                      </div>
                    </div>
                  )}

                  {index === messages.length - 1 && (
                    <Button
                      onClick={onGenerateEmail || onDraftEmail}
                      className="px-4 py-2 text-sm font-semibold bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20"
                    >
                      <Edit3 className="w-4 h-4 mr-2" />
                      Generate Full Email Draft
                    </Button>
                  )}
                </div>
              )}
            </div>
            {message.role === 'user' && (
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                AB
              </div>
            )}
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="bg-gray-900/60 border border-gray-800/40 rounded-xl px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800/50 rounded-xl p-4 sticky bottom-6">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <textarea
              ref={chatInputRef}
              rows={1}
              placeholder="Ask Copilot anything about your pipeline, contacts, or next actions..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
            />
          </div>
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="px-6 py-3 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 flex-shrink-0"
          >
            <Send className="w-4 h-4 mr-2" />
            <span className="text-sm font-semibold">Send</span>
          </Button>
        </div>

        {/* Suggested Prompts */}
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestedPrompts.map((prompt, index) => (
            <button
              key={index}
              onClick={() => handlePromptClick(prompt)}
              className="px-3 py-1.5 bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 rounded-lg text-xs text-gray-300 transition-all"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

