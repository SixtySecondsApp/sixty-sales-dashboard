/**
 * Contact Record Component
 * Enhanced contact view with AI insights, meeting summaries, and health metrics
 */

import React, { useState, useEffect } from 'react';
import {
  Mail,
  Building2,
  Activity,
  TrendingUp,
  BarChart3,
  Zap,
  Video,
  Clock,
  MailOpen,
  CheckCircle2,
  Linkedin,
  ArrowRight,
  Sparkles,
  Phone,
  Calendar,
  FileText,
  Edit
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ContactRecordService } from '@/lib/services/contactRecordService';
import { useCopilot } from '@/lib/contexts/CopilotContext';
import { CopilotService } from '@/lib/services/copilotService';
import type { ContactRecordData, ActionItem, Activity as ActivityType } from './copilot/types';
import logger from '@/lib/utils/logger';

interface ContactRecordProps {
  contactId?: string;
  contact?: Partial<ContactRecordData>;
  onEdit?: () => void;
  onDraftEmail?: (contactId?: string) => void;
  onOpenCopilot?: () => void;
}

export const ContactRecord: React.FC<ContactRecordProps> = ({
  contactId,
  contact: propContact,
  onEdit,
  onDraftEmail,
  onOpenCopilot
}) => {
  const [contactData, setContactData] = useState<ContactRecordData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { openCopilot, setContext } = useCopilot();

  // Fetch contact data
  useEffect(() => {
    const fetchData = async () => {
      if (propContact) {
        // Use provided contact data
        setContactData(propContact as ContactRecordData);
        setIsLoading(false);
        return;
      }

      if (!contactId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        
        // Set Copilot context
        setContext({ contactId, currentView: 'contact' });

        const data = await ContactRecordService.getContactRecord(contactId);
        setContactData(data);
      } catch (err) {
        logger.error('Error fetching contact record:', err);
        setError(err instanceof Error ? err : new Error('Failed to load contact'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [contactId, propContact, setContext]);

  const handleToggleActionItem = async (itemId: string, completed: boolean) => {
    if (!contactData) return;

    try {
      await ContactRecordService.updateActionItem(contactData.id, itemId, completed);
      
      // Update local state
      setContactData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          lastMeeting: prev.lastMeeting ? {
            ...prev.lastMeeting,
            actionItems: prev.lastMeeting.actionItems.map(ai =>
              ai.id === itemId ? { ...ai, completed } : ai
            )
          } : undefined
        };
      });
    } catch (err) {
      logger.error('Error updating action item:', err);
    }
  };

  const handleDraftEmail = async () => {
    if (!contactData) return;

    try {
      const emailDraft = await CopilotService.draftEmail(
        contactData.id,
        `Follow-up email for ${contactData.firstName} ${contactData.lastName}`,
        'professional'
      );
      onDraftEmail?.(contactData.id);
    } catch (err) {
      logger.error('Error drafting email:', err);
      onDraftEmail?.(contactData.id);
    }
  };

  const handleOpenCopilot = () => {
    if (contactData) {
      openCopilot(`Tell me about ${contactData.firstName} ${contactData.lastName}`);
    } else {
      onOpenCopilot?.();
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-gray-800/50 rounded-xl" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="h-64 bg-gray-800/50 rounded-xl" />
            <div className="h-64 bg-gray-800/50 rounded-xl" />
            <div className="h-64 bg-gray-800/50 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !contactData) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-red-400">
            {error?.message || 'Contact not found'}
          </p>
        </div>
      </div>
    );
  }

  const contact = contactData;

  const getInitials = () => {
    return `${contact.firstName[0] || ''}${contact.lastName[0] || ''}`.toUpperCase() || '?';
  };

  const getActivityIcon = (type: ActivityType['type']) => {
    switch (type) {
      case 'email':
        return MailOpen;
      case 'meeting':
        return CheckCircle2;
      case 'reply':
        return Mail;
      case 'linkedin':
        return Linkedin;
      case 'call':
        return Phone;
      case 'task':
        return CheckCircle2;
      default:
        return Clock;
    }
  };

  const getActivityColor = (type: ActivityType['type']) => {
    switch (type) {
      case 'email':
        return 'bg-blue-500/20 text-blue-400';
      case 'meeting':
        return 'bg-emerald-500/20 text-emerald-400';
      case 'reply':
        return 'bg-purple-500/20 text-purple-400';
      case 'linkedin':
        return 'bg-blue-500/20 text-blue-400';
      case 'call':
        return 'bg-green-500/20 text-green-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  // Get primary AI insight for banner
  const primaryInsight = contact.aiInsights && contact.aiInsights.length > 0
    ? contact.aiInsights[0]
    : null;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Contact Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-2xl font-bold text-white">
            {getInitials()}
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-100 mb-1">
              {contact.firstName} {contact.lastName}
            </h2>
            <p className="text-sm text-gray-400 mb-2">
              {contact.title} {contact.company && `at ${contact.company}`}
            </p>
            <div className="flex gap-2 mb-3">
              {contact.status === 'active' && (
                <span className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-xs font-semibold text-emerald-400">
                  Active
                </span>
              )}
              {contact.tags?.map(tag => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded text-xs font-semibold text-blue-400"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="flex gap-4 text-sm">
              <span className="flex items-center gap-1 text-gray-400">
                <Mail className="w-4 h-4" />
                {contact.email}
              </span>
              {contact.location && (
                <span className="flex items-center gap-1 text-gray-400">
                  <Building2 className="w-4 h-4" />
                  {contact.location}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onEdit}
            className="px-4 py-2 text-sm font-semibold bg-gray-800/50 hover:bg-gray-800 text-gray-300 border border-gray-700/50"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit Contact
          </Button>
        </div>
      </div>

      {/* AI Insights Banner */}
      {primaryInsight && (
        <div className="mb-6 bg-blue-500/10 backdrop-blur-sm border-l-4 border-blue-500/50 rounded-xl p-4">
          <div className="flex gap-3">
            <Sparkles className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-300 mb-1">AI Insight</p>
              <p className="text-sm text-gray-300 mb-3">
                {primaryInsight.content}
              </p>
              <button
                onClick={handleOpenCopilot}
                className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                Ask Copilot about this contact
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Deal Health */}
        <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-gray-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              Deal Health
            </h4>
            <div className="flex items-center gap-2">
              <span className={cn(
                'text-2xl font-bold',
                contact.dealHealth.score >= 70 ? 'text-emerald-400' :
                contact.dealHealth.score >= 50 ? 'text-blue-400' : 'text-amber-400'
              )}>
                {contact.dealHealth.score}
              </span>
              <TrendingUp className={cn(
                'w-5 h-5',
                contact.dealHealth.score >= 70 ? 'text-emerald-400' :
                contact.dealHealth.score >= 50 ? 'text-blue-400' : 'text-amber-400'
              )} />
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-gray-400">Engagement</span>
                <span className={cn(
                  'text-xs font-semibold',
                  contact.dealHealth.metrics.engagement.value >= 70 ? 'text-emerald-400' :
                  contact.dealHealth.metrics.engagement.value >= 40 ? 'text-blue-400' : 'text-gray-400'
                )}>
                  {contact.dealHealth.metrics.engagement.label}
                </span>
              </div>
              <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full bg-gradient-to-r',
                    contact.dealHealth.metrics.engagement.value >= 70 ? 'from-emerald-500 to-emerald-400' :
                    contact.dealHealth.metrics.engagement.value >= 40 ? 'from-blue-500 to-blue-400' : 'from-gray-500 to-gray-400'
                  )}
                  style={{ width: `${contact.dealHealth.metrics.engagement.value}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-gray-400">Momentum</span>
                <span className={cn(
                  'text-xs font-semibold',
                  contact.dealHealth.metrics.momentum.value >= 70 ? 'text-emerald-400' :
                  contact.dealHealth.metrics.momentum.value >= 40 ? 'text-blue-400' : 'text-gray-400'
                )}>
                  {contact.dealHealth.metrics.momentum.label}
                </span>
              </div>
              <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full bg-gradient-to-r',
                    contact.dealHealth.metrics.momentum.value >= 70 ? 'from-emerald-500 to-emerald-400' :
                    contact.dealHealth.metrics.momentum.value >= 40 ? 'from-blue-500 to-blue-400' : 'from-gray-500 to-gray-400'
                  )}
                  style={{ width: `${contact.dealHealth.metrics.momentum.value}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-gray-400">Response Time</span>
                <span className={cn(
                  'text-xs font-semibold',
                  contact.dealHealth.metrics.responseTime.value >= 70 ? 'text-emerald-400' :
                  contact.dealHealth.metrics.responseTime.value >= 40 ? 'text-blue-400' : 'text-gray-400'
                )}>
                  {contact.dealHealth.metrics.responseTime.label}
                </span>
              </div>
              <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full bg-gradient-to-r',
                    contact.dealHealth.metrics.responseTime.value >= 70 ? 'from-emerald-500 to-emerald-400' :
                    contact.dealHealth.metrics.responseTime.value >= 40 ? 'from-blue-500 to-blue-400' : 'from-gray-500 to-gray-400'
                  )}
                  style={{ width: `${contact.dealHealth.metrics.responseTime.value}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Key Stats */}
        <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800/50 rounded-xl p-6">
          <h4 className="text-sm font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-400" />
            Key Stats
          </h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Total Meetings</span>
              <span className="text-sm font-semibold text-gray-100">{contact.stats.totalMeetings}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Emails Sent</span>
              <span className="text-sm font-semibold text-gray-100">{contact.stats.emailsSent}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Avg Response Time</span>
              <span className="text-sm font-semibold text-emerald-400">{contact.stats.avgResponseTime}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Deal Value</span>
              <span className="text-sm font-semibold text-gray-100">£{contact.stats.dealValue.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Close Probability</span>
              <span className="text-sm font-semibold text-emerald-400">{contact.stats.closeProbability}%</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800/50 rounded-xl p-6">
          <h4 className="text-sm font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            Quick Actions
          </h4>
          <div className="space-y-2">
            <Button
              onClick={handleDraftEmail}
              className="w-full px-4 py-2 text-sm font-semibold bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20"
            >
              <Mail className="w-4 h-4 mr-2" />
              Draft AI Email
            </Button>
            <Button
              variant="outline"
              className="w-full px-4 py-2 text-sm font-semibold bg-gray-800/50 hover:bg-gray-800 text-gray-300 border border-gray-700/50"
            >
              <Phone className="w-4 h-4 mr-2" />
              Schedule Call
            </Button>
            <Button
              variant="outline"
              className="w-full px-4 py-2 text-sm font-semibold bg-gray-800/50 hover:bg-gray-800 text-gray-300 border border-gray-700/50"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Book Meeting
            </Button>
            <Button
              variant="outline"
              className="w-full px-4 py-2 text-sm font-semibold bg-gray-800/50 hover:bg-gray-800 text-gray-300 border border-gray-700/50"
            >
              <FileText className="w-4 h-4 mr-2" />
              Send Proposal
            </Button>
          </div>
        </div>
      </div>

      {/* Recent Activity & Meeting Summaries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Last Meeting Summary */}
        {contact.lastMeeting ? (
          <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800/50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-gray-100 flex items-center gap-2">
                <Video className="w-4 h-4 text-purple-400" />
                Last Meeting Summary
              </h4>
              <span className="text-xs text-gray-500">
                {contact.lastMeeting.date.toLocaleDateString()}
              </span>
            </div>

            <div className="space-y-4">
              {contact.lastMeeting.discussionPoints.length > 0 && (
                <div>
                  <h5 className="text-xs font-semibold text-gray-400 uppercase mb-2">Key Discussion Points</h5>
                  <ul className="space-y-1.5 text-sm text-gray-300">
                    {contact.lastMeeting.discussionPoints.map((point, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-blue-400">•</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {contact.lastMeeting.actionItems.length > 0 && (
                <div>
                  <h5 className="text-xs font-semibold text-gray-400 uppercase mb-2">Action Items</h5>
                  <div className="space-y-2">
                    {contact.lastMeeting.actionItems.map(item => {
                      const Icon = item.completed ? CheckCircle2 : Clock;
                      return (
                        <label
                          key={item.id}
                          className="flex items-start gap-2 cursor-pointer group"
                        >
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={() => handleToggleActionItem(item.id, !item.completed)}
                            className="mt-1"
                          />
                          <span
                            className={cn(
                              'text-sm',
                              item.completed
                                ? 'text-gray-500 line-through'
                                : 'text-gray-300 group-hover:text-gray-100'
                            )}
                          >
                            {item.text}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-800/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Meeting Sentiment</span>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      contact.lastMeeting.sentiment === 'positive' ? 'text-emerald-400' :
                      contact.lastMeeting.sentiment === 'negative' ? 'text-red-400' : 'text-gray-400'
                    )}>
                      {contact.lastMeeting.sentiment.charAt(0).toUpperCase() + contact.lastMeeting.sentiment.slice(1)}
                    </span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div
                          key={i}
                          className={cn(
                            'w-1 h-4 rounded-full',
                            i <= contact.lastMeeting!.sentimentScore
                              ? contact.lastMeeting!.sentiment === 'positive' ? 'bg-emerald-500' :
                                contact.lastMeeting!.sentiment === 'negative' ? 'bg-red-500' : 'bg-gray-500'
                              : 'bg-gray-700'
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {contact.lastMeeting.transcriptUrl && (
                <Button
                  variant="outline"
                  className="w-full px-4 py-2 text-sm font-semibold bg-gray-800/50 hover:bg-gray-800 text-gray-300 border border-gray-700/50"
                  onClick={() => window.open(contact.lastMeeting!.transcriptUrl, '_blank')}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  View Full Transcript
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800/50 rounded-xl p-6">
            <div className="flex items-center justify-center h-32">
              <p className="text-sm text-gray-500">No meeting summaries available</p>
            </div>
          </div>
        )}

        {/* Recent Activity Timeline */}
        <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800/50 rounded-xl p-6">
          <h4 className="text-sm font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            Recent Activity
          </h4>

          <div className="space-y-4">
            {contact.recentActivity.length > 0 ? (
              <>
                {contact.recentActivity.map(activity => {
                  const Icon = getActivityIcon(activity.type);
                  return (
                    <div key={activity.id} className="flex gap-3">
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', getActivityColor(activity.type))}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-300 mb-1">{activity.title}</p>
                        <p className="text-xs text-gray-500">{activity.timestamp}</p>
                      </div>
                    </div>
                  );
                })}
                <Button
                  variant="ghost"
                  className="w-full px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-800/30"
                >
                  View All Activity
                </Button>
              </>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No recent activity</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

