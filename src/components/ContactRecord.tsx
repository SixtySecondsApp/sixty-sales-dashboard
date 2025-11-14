import React, { useState } from 'react';
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

interface ContactRecordProps {
  contact?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    company?: string;
    title?: string;
    location?: string;
    status?: 'active' | 'inactive';
    tags?: string[];
  };
  onEdit?: () => void;
  onDraftEmail?: () => void;
  onOpenCopilot?: () => void;
}

interface ActivityItem {
  id: string;
  type: 'email' | 'meeting' | 'reply' | 'linkedin';
  title: string;
  timestamp: string;
}

interface ActionItem {
  id: string;
  text: string;
  completed: boolean;
}

export const ContactRecord: React.FC<ContactRecordProps> = ({
  contact = {
    id: '1',
    firstName: 'Alexander',
    lastName: 'Wolf',
    email: 'alexander@alexanderwolfagency.com',
    company: 'Alexander Wolf Agency',
    title: 'Founder & CEO',
    location: 'New York, USA',
    status: 'active',
    tags: ['High Value']
  },
  onEdit,
  onDraftEmail,
  onOpenCopilot
}) => {
  const [actionItems, setActionItems] = useState<ActionItem[]>([
    { id: '1', text: 'Send proposal with phased approach', completed: true },
    { id: '2', text: 'Share Crimson Literary case study', completed: false },
    { id: '3', text: 'Schedule Q1 budget review call', completed: false }
  ]);

  const activities: ActivityItem[] = [
    { id: '1', type: 'email', title: 'Opened email "Q4 Proposal"', timestamp: '2 hours ago' },
    { id: '2', type: 'meeting', title: 'Completed meeting', timestamp: '3 days ago' },
    { id: '3', type: 'reply', title: 'Replied to your email', timestamp: '5 days ago' },
    { id: '4', type: 'linkedin', title: 'Viewed your LinkedIn profile', timestamp: '1 week ago' }
  ];

  const getInitials = () => {
    return `${contact.firstName[0]}${contact.lastName[0]}`.toUpperCase();
  };

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'email':
        return MailOpen;
      case 'meeting':
        return CheckCircle2;
      case 'reply':
        return Mail;
      case 'linkedin':
        return Linkedin;
      default:
        return Clock;
    }
  };

  const getActivityColor = (type: ActivityItem['type']) => {
    switch (type) {
      case 'email':
        return 'bg-blue-500/20 text-blue-400';
      case 'meeting':
        return 'bg-emerald-500/20 text-emerald-400';
      case 'reply':
        return 'bg-purple-500/20 text-purple-400';
      case 'linkedin':
        return 'bg-blue-500/20 text-blue-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const toggleActionItem = (id: string) => {
    setActionItems(items =>
      items.map(item =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

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
      <div className="mb-6 bg-blue-500/10 backdrop-blur-sm border border-blue-500/20 rounded-xl p-4">
        <div className="flex gap-3">
          <Sparkles className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-300 mb-1">AI Insight</p>
            <p className="text-sm text-gray-300 mb-3">
              {contact.firstName} has opened your last 3 emails within 1 hour of receiving them. High engagement indicates strong interest. Best time to follow up: Mornings 9-10 AM EST.
            </p>
            {onOpenCopilot && (
              <button
                onClick={onOpenCopilot}
                className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                Ask Copilot about this contact
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

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
              <span className="text-2xl font-bold text-emerald-400">78</span>
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-gray-400">Engagement</span>
                <span className="text-xs font-semibold text-emerald-400">High</span>
              </div>
              <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full w-4/5 bg-gradient-to-r from-emerald-500 to-emerald-400" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-gray-400">Momentum</span>
                <span className="text-xs font-semibold text-blue-400">Strong</span>
              </div>
              <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full w-3/4 bg-gradient-to-r from-blue-500 to-blue-400" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-gray-400">Response Time</span>
                <span className="text-xs font-semibold text-emerald-400">Fast</span>
              </div>
              <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full w-[90%] bg-gradient-to-r from-emerald-500 to-emerald-400" />
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
              <span className="text-sm font-semibold text-gray-100">5</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Emails Sent</span>
              <span className="text-sm font-semibold text-gray-100">12</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Avg Response Time</span>
              <span className="text-sm font-semibold text-emerald-400">2.3 hours</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Deal Value</span>
              <span className="text-sm font-semibold text-gray-100">£65,000</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Close Probability</span>
              <span className="text-sm font-semibold text-emerald-400">78%</span>
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
              onClick={onDraftEmail}
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
        <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-gray-100 flex items-center gap-2">
              <Video className="w-4 h-4 text-purple-400" />
              Last Meeting Summary
            </h4>
            <span className="text-xs text-gray-500">Nov 1, 2025</span>
          </div>

          <div className="space-y-4">
            <div>
              <h5 className="text-xs font-semibold text-gray-400 uppercase mb-2">Key Discussion Points</h5>
              <ul className="space-y-1.5 text-sm text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-blue-400">•</span>
                  Discussed Q1 2026 budget allocation for content services
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400">•</span>
                  {contact.firstName} expressed concerns about implementation timeline
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400">•</span>
                  Requested case studies from similar literary agencies
                </li>
              </ul>
            </div>

            <div>
              <h5 className="text-xs font-semibold text-gray-400 uppercase mb-2">Action Items</h5>
              <div className="space-y-2">
                {actionItems.map(item => {
                  const Icon = item.completed ? CheckCircle2 : Clock;
                  return (
                    <label
                      key={item.id}
                      className="flex items-start gap-2 cursor-pointer group"
                    >
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => toggleActionItem(item.id)}
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

            <div className="pt-4 border-t border-gray-800/50">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Meeting Sentiment</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-emerald-400">Positive</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div
                        key={i}
                        className={cn(
                          'w-1 h-4 rounded-full',
                          i <= 4 ? 'bg-emerald-500' : 'bg-gray-700'
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full px-4 py-2 text-sm font-semibold bg-gray-800/50 hover:bg-gray-800 text-gray-300 border border-gray-700/50"
            >
              <FileText className="w-4 h-4 mr-2" />
              View Full Transcript
            </Button>
          </div>
        </div>

        {/* Recent Activity Timeline */}
        <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800/50 rounded-xl p-6">
          <h4 className="text-sm font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            Recent Activity
          </h4>

          <div className="space-y-4">
            {activities.map(activity => {
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
          </div>
        </div>
      </div>
    </div>
  );
};

