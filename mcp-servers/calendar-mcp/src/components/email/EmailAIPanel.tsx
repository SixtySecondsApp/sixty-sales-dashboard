import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  TrendingUp,
  Clock,
  Users,
  Mail,
  AlertTriangle,
  CheckCircle,
  Calendar,
  MessageSquare,
  Sparkles,
  ChevronRight,
  Star,
  Filter,
  Zap,
  Target,
  Heart,
  Eye,
  Lightbulb,
} from 'lucide-react';

import { emailAIService, type EmailAnalysis } from '../../lib/services/emailAIService';

interface EmailAIPanelProps {
  emailId: string;
  subject: string;
  content: string;
  sender: string;
  metadata?: Record<string, any>;
  onActionTrigger?: (action: string, data: any) => void;
}

interface AIInsight {
  id: string;
  type: 'priority' | 'category' | 'sentiment' | 'action' | 'meeting' | 'summary';
  title: string;
  description: string;
  confidence: number;
  icon: React.ReactNode;
  color: string;
  actionable: boolean;
  data?: any;
}

export const EmailAIPanel: React.FC<EmailAIPanelProps> = ({
  emailId,
  subject,
  content,
  sender,
  metadata,
  onActionTrigger,
}) => {
  const [analysis, setAnalysis] = useState<EmailAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [activeTab, setActiveTab] = useState<'insights' | 'replies' | 'meetings' | 'summary'>('insights');
  const [selectedReply, setSelectedReply] = useState<string | null>(null);

  useEffect(() => {
    analyzeEmail();
  }, [emailId, subject, content, sender]);

  const analyzeEmail = async () => {
    setLoading(true);
    try {
      const result = await emailAIService.analyzeEmail(subject, content, sender, metadata);
      setAnalysis(result);
      generateInsights(result);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const generateInsights = (analysis: EmailAnalysis) => {
    const newInsights: AIInsight[] = [];

    // Priority insight
    if (analysis.priority.score >= 4) {
      newInsights.push({
        id: 'priority',
        type: 'priority',
        title: `${analysis.priority.level} Priority`,
        description: `Priority score: ${analysis.priority.score}/5. ${analysis.priority.factors.join(', ')}`,
        confidence: analysis.priority.confidence,
        icon: <AlertTriangle className="w-4 h-4" />,
        color: analysis.priority.score >= 5 ? 'red' : analysis.priority.score >= 4 ? 'orange' : 'yellow',
        actionable: true,
        data: analysis.priority,
      });
    }

    // Category insight
    if (analysis.categories.length > 0) {
      const topCategory = analysis.categories[0];
      newInsights.push({
        id: 'category',
        type: 'category',
        title: `${topCategory.name} Email`,
        description: topCategory.description,
        confidence: topCategory.confidence,
        icon: <Filter className="w-4 h-4" />,
        color: topCategory.color,
        actionable: false,
        data: topCategory,
      });
    }

    // Sentiment insight
    if (analysis.sentiment.label !== 'Neutral') {
      newInsights.push({
        id: 'sentiment',
        type: 'sentiment',
        title: `${analysis.sentiment.label} Sentiment`,
        description: `Sentiment score: ${analysis.sentiment.score.toFixed(2)}`,
        confidence: analysis.sentiment.confidence,
        icon: analysis.sentiment.label === 'Positive' ? <Heart className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />,
        color: analysis.sentiment.label === 'Positive' ? 'green' : 'red',
        actionable: false,
        data: analysis.sentiment,
      });
    }

    // Meeting extraction insight
    if (analysis.meetingExtractions.length > 0) {
      const meeting = analysis.meetingExtractions[0];
      newInsights.push({
        id: 'meeting',
        type: 'meeting',
        title: 'Meeting Detected',
        description: meeting.isProposal ? 'Meeting proposal found' : 'Meeting information extracted',
        confidence: meeting.confidence,
        icon: <Calendar className="w-4 h-4" />,
        color: 'blue',
        actionable: true,
        data: meeting,
      });
    }

    // Action required insight
    if (analysis.keyEntities.actions.length > 0) {
      newInsights.push({
        id: 'action',
        type: 'action',
        title: 'Actions Required',
        description: `${analysis.keyEntities.actions.length} actions identified`,
        confidence: 0.8,
        icon: <Target className="w-4 h-4" />,
        color: 'purple',
        actionable: true,
        data: analysis.keyEntities.actions,
      });
    }

    setInsights(newInsights);
  };

  const handleInsightAction = (insight: AIInsight) => {
    if (!onActionTrigger) return;

    switch (insight.type) {
      case 'priority':
        onActionTrigger('set_priority', { emailId, priority: insight.data.score });
        break;
      case 'meeting':
        onActionTrigger('create_meeting', { emailId, meeting: insight.data });
        break;
      case 'action':
        onActionTrigger('create_tasks', { emailId, actions: insight.data });
        break;
    }
  };

  const handleReplySelect = (replyId: string) => {
    const reply = analysis?.smartReplies.find(r => r.id === replyId);
    if (reply && onActionTrigger) {
      onActionTrigger('compose_reply', { emailId, reply });
    }
  };

  const getColorClass = (color: string, type: 'bg' | 'text' | 'border' = 'bg') => {
    const colorMap: Record<string, Record<string, string>> = {
      red: {
        bg: 'bg-red-500/10 dark:bg-red-500/20',
        text: 'text-red-600 dark:text-red-400',
        border: 'border-red-500/20',
      },
      orange: {
        bg: 'bg-orange-500/10 dark:bg-orange-500/20',
        text: 'text-orange-600 dark:text-orange-400',
        border: 'border-orange-500/20',
      },
      yellow: {
        bg: 'bg-yellow-500/10 dark:bg-yellow-500/20',
        text: 'text-yellow-600 dark:text-yellow-400',
        border: 'border-yellow-500/20',
      },
      green: {
        bg: 'bg-green-500/10 dark:bg-green-500/20',
        text: 'text-green-600 dark:text-green-400',
        border: 'border-green-500/20',
      },
      blue: {
        bg: 'bg-blue-500/10 dark:bg-blue-500/20',
        text: 'text-blue-600 dark:text-blue-400',
        border: 'border-blue-500/20',
      },
      purple: {
        bg: 'bg-purple-500/10 dark:bg-purple-500/20',
        text: 'text-purple-600 dark:text-purple-400',
        border: 'border-purple-500/20',
      },
    };

    return colorMap[color]?.[type] || colorMap.blue[type];
  };

  if (loading) {
    return (
      <div className="bg-white/5 dark:bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-xl p-6">
        <div className="flex items-center space-x-3 mb-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Brain className="w-6 h-6 text-blue-400" />
          </motion.div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            AI Analysis
          </h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200/50 dark:bg-gray-700/50 rounded w-full"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="bg-white/5 dark:bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-xl p-6">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>AI analysis unavailable</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 dark:bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              AI Insights
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Smart analysis and suggestions
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-100/50 dark:bg-gray-800/50 rounded-lg p-1">
          {[
            { id: 'insights', label: 'Insights', icon: <Lightbulb className="w-4 h-4" /> },
            { id: 'replies', label: 'Replies', icon: <MessageSquare className="w-4 h-4" /> },
            { id: 'meetings', label: 'Meetings', icon: <Calendar className="w-4 h-4" /> },
            { id: 'summary', label: 'Summary', icon: <Eye className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'insights' && (
            <motion.div
              key="insights"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              {insights.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No significant insights detected</p>
                </div>
              ) : (
                insights.map((insight) => (
                  <motion.div
                    key={insight.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`p-4 rounded-lg border ${getColorClass(insight.color, 'bg')} ${getColorClass(insight.color, 'border')}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-lg ${getColorClass(insight.color, 'text')}`}>
                          {insight.icon}
                        </div>
                        <div className="flex-1">
                          <h4 className={`font-medium ${getColorClass(insight.color, 'text')}`}>
                            {insight.title}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {insight.description}
                          </p>
                          <div className="flex items-center space-x-2 mt-2">
                            <div className="flex items-center space-x-1">
                              <Star className="w-3 h-3 text-yellow-400" />
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {(insight.confidence * 100).toFixed(0)}% confidence
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      {insight.actionable && (
                        <button
                          onClick={() => handleInsightAction(insight)}
                          className="flex items-center space-x-1 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-md text-sm font-medium transition-colors"
                        >
                          <span>Act</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))
              )}

              {/* Tags */}
              {analysis.tags.length > 0 && (
                <div className="mt-6 pt-6 border-t border-white/10">
                  <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                    Tags
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {analysis.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs rounded-full"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'replies' && (
            <motion.div
              key="replies"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-3"
            >
              {analysis.smartReplies.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No smart replies available</p>
                </div>
              ) : (
                analysis.smartReplies.map((reply) => (
                  <div
                    key={reply.id}
                    className="p-4 bg-gray-50/50 dark:bg-gray-800/50 rounded-lg border border-gray-200/50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/70 transition-colors cursor-pointer"
                    onClick={() => handleReplySelect(reply.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          reply.tone === 'Professional' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                          reply.tone === 'Casual' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
                          reply.tone === 'Friendly' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' :
                          'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}>
                          {reply.tone}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Star className="w-3 h-3 text-yellow-400" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {(reply.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                      {reply.content}
                    </p>
                    {reply.suggestedAction && (
                      <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                        → {reply.suggestedAction}
                      </div>
                    )}
                  </div>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'meetings' && (
            <motion.div
              key="meetings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-3"
            >
              {analysis.meetingExtractions.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No meetings detected in this email</p>
                </div>
              ) : (
                analysis.meetingExtractions.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-200/50 dark:border-blue-800/50"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-medium text-blue-900 dark:text-blue-100">
                        {meeting.title}
                      </h4>
                      <div className="flex items-center space-x-1">
                        <Star className="w-3 h-3 text-yellow-400" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {(meeting.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      {meeting.dateTime && (
                        <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                          <Clock className="w-4 h-4" />
                          <span>{meeting.dateTime.toLocaleString()}</span>
                        </div>
                      )}
                      {meeting.duration && (
                        <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                          <TrendingUp className="w-4 h-4" />
                          <span>{meeting.duration} minutes</span>
                        </div>
                      )}
                      {meeting.attendees.length > 0 && (
                        <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                          <Users className="w-4 h-4" />
                          <span>{meeting.attendees.join(', ')}</span>
                        </div>
                      )}
                      {meeting.location && (
                        <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                          <Mail className="w-4 h-4" />
                          <span>{meeting.location}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-3">
                      {meeting.description}
                    </p>
                    {meeting.isProposal && (
                      <div className="mt-3 p-2 bg-yellow-100/50 dark:bg-yellow-900/20 rounded-md">
                        <div className="flex items-center space-x-2 text-yellow-800 dark:text-yellow-200">
                          <Zap className="w-4 h-4" />
                          <span className="text-sm font-medium">Meeting Proposal</span>
                        </div>
                      </div>
                    )}
                    <div className="mt-3 flex space-x-2">
                      <button
                        onClick={() => onActionTrigger?.('create_meeting', { emailId, meeting })}
                        className="flex items-center space-x-1 px-3 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-md text-sm font-medium transition-colors"
                      >
                        <Calendar className="w-3 h-3" />
                        <span>Add to Calendar</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'summary' && (
            <motion.div
              key="summary"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="p-4 bg-gray-50/50 dark:bg-gray-800/50 rounded-lg">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                  Summary
                </h4>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {analysis.summary}
                </p>
              </div>

              {/* Key Entities */}
              <div className="space-y-3">
                {Object.entries(analysis.keyEntities).map(([type, entities]) => {
                  if (entities.length === 0) return null;
                  
                  return (
                    <div key={type} className="p-3 bg-white/5 dark:bg-gray-900/20 rounded-lg">
                      <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2 capitalize">
                        {type}
                      </h5>
                      <div className="flex flex-wrap gap-1">
                        {entities.map((entity, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-gray-200/50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 text-xs rounded"
                          >
                            {entity}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};