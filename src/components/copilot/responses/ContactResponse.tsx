/**
 * Contact Response Component
 * Displays comprehensive contact summary with emails, deals, activities, meetings, and tasks
 */

import React, { useState } from 'react';
import { Mail, Briefcase, Activity, Calendar, CheckCircle2, ChevronDown, ChevronUp, ExternalLink, Phone, Building2 } from 'lucide-react';
import { ActionButtons } from '../ActionButtons';
import type { ContactResponse, EmailSummary, ContactDeal, ContactActivity, ContactMeeting, ContactTask } from '../types';
import { getMeetingSummaryPlainText } from '@/lib/utils/meetingSummaryParser';

interface ContactResponseProps {
  data: ContactResponse;
  onActionClick?: (action: any) => void;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const MetricCard: React.FC<{ label: string; value: string | number; variant?: 'default' | 'success' | 'warning' }> = ({
  label,
  value,
  variant = 'default'
}) => {
  const variantColors = {
    default: 'text-gray-100',
    success: 'text-emerald-400',
    warning: 'text-amber-400'
  };

  return (
    <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/40 rounded-lg p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-semibold ${variantColors[variant]}`}>{value}</div>
    </div>
  );
};

const EmailCard: React.FC<{ email: EmailSummary }> = ({ email }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div 
      onClick={() => setIsExpanded(!isExpanded)}
      className="bg-gray-900/80 backdrop-blur-sm border border-gray-800/50 rounded-lg p-3 cursor-pointer hover:bg-gray-900/90 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Mail className={`w-3 h-3 ${email.direction === 'sent' ? 'text-blue-400' : 'text-green-400'}`} />
            <span className="text-xs text-gray-500 capitalize">{email.direction}</span>
            <span className="text-xs text-gray-600">{formatDate(email.date)}</span>
          </div>
          <h5 className="text-sm font-medium text-gray-100 mb-1 truncate">{email.subject}</h5>
          {isExpanded ? (
            <p className="text-xs text-gray-400 mt-2">{email.summary}</p>
          ) : (
            <p className="text-xs text-gray-500 line-clamp-2">{email.snippet || email.summary}</p>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
        )}
      </div>
    </div>
  );
};

const DealCard: React.FC<{ deal: ContactDeal }> = ({ deal }) => {
  return (
    <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800/50 rounded-lg p-3">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h5 className="text-sm font-medium text-gray-100">{deal.name}</h5>
          <p className="text-xs text-gray-500">{deal.stage} · {deal.probability}%</p>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold text-gray-100">{formatCurrency(deal.value)}</div>
          <div className="text-xs text-gray-500">Health: {deal.healthScore}</div>
        </div>
      </div>
      {deal.closeDate && (
        <div className="text-xs text-gray-500">
          Expected close: {formatDate(deal.closeDate)}
        </div>
      )}
    </div>
  );
};

const ActivityCard: React.FC<{ activity: ContactActivity }> = ({ activity }) => {
  return (
    <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800/50 rounded-lg p-3">
      <div className="flex items-start gap-3">
        <Activity className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-gray-300 capitalize">{activity.type}</span>
            <span className="text-xs text-gray-600">{formatDate(activity.date)}</span>
          </div>
          {activity.notes && (
            <p className="text-xs text-gray-400 line-clamp-2">{activity.notes}</p>
          )}
        </div>
      </div>
    </div>
  );
};

const MeetingCard: React.FC<{ meeting: ContactMeeting }> = ({ meeting }) => {
  return (
    <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800/50 rounded-lg p-3">
      <div className="flex items-start gap-3">
        <Calendar className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h5 className="text-sm font-medium text-gray-100">{meeting.title}</h5>
            {meeting.hasTranscript && (
              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">Transcript</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mb-1">{formatDateTime(meeting.date)}</p>
          {meeting.summary && (
            <p className="text-xs text-gray-400 line-clamp-2">
              {getMeetingSummaryPlainText(meeting.summary)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const TaskCard: React.FC<{ task: ContactTask }> = ({ task }) => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-400';
      case 'high': return 'text-amber-400';
      case 'medium': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800/50 rounded-lg p-3">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h5 className="text-sm font-medium text-gray-100">{task.title}</h5>
            <span className={`text-xs font-medium ${getPriorityColor(task.priority)}`}>
              {task.priority}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="capitalize">{task.status}</span>
            {task.dueDate && (
              <>
                <span>·</span>
                <span>Due: {formatDate(task.dueDate)}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const ContactResponse: React.FC<ContactResponseProps> = ({ data, onActionClick }) => {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const contact = data.data.contact;
  const { emails, deals, activities, meetings, tasks, metrics } = data.data;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <p className="text-sm text-gray-300">{data.summary}</p>

      {/* Contact Header */}
      <div className="bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 backdrop-blur-sm border border-cyan-500/20 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-100 mb-2">{contact.name}</h3>
            <div className="space-y-1 text-sm text-gray-400">
              {contact.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <span>{contact.email}</span>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  <span>{contact.phone}</span>
                </div>
              )}
              {contact.title && (
                <div className="text-gray-500">{contact.title}</div>
              )}
              {contact.company && (
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  <span>{contact.company}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <MetricCard label="Total Deals" value={metrics.totalDeals} variant="default" />
        <MetricCard label="Deal Value" value={formatCurrency(metrics.totalDealValue)} variant="success" />
        <MetricCard label="Active Deals" value={metrics.activeDeals} variant="warning" />
        <MetricCard label="Recent Emails" value={metrics.recentEmails} variant="default" />
        <MetricCard label="Upcoming Meetings" value={metrics.upcomingMeetings} variant="warning" />
        <MetricCard label="Pending Tasks" value={metrics.pendingTasks} variant="default" />
      </div>

      {/* Recent Emails Section - Always show with "View All Emails" button */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-400" />
            Recent Emails {emails.length > 0 && `(${emails.length})`}
          </h4>
          <button
            onClick={() => {
              // Trigger email search for this contact
              onActionClick?.('search_emails', { 
                contactEmail: contact.email,
                contactName: contact.name 
              });
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 transition-colors text-xs font-medium"
          >
            <Mail className="w-3.5 h-3.5" />
            View All Emails
          </button>
        </div>
        
        {emails.length > 0 && (
          <>
            <div 
              onClick={() => toggleSection('emails')}
              className="flex items-center gap-2 cursor-pointer text-xs text-gray-500 hover:text-gray-400"
            >
              {expandedSection === 'emails' ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  <span>Hide recent emails</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  <span>Show {emails.length} recent emails from CRM</span>
                </>
              )}
            </div>
            {expandedSection === 'emails' && (
              <div className="space-y-2">
                {emails.map(email => (
                  <EmailCard key={email.id} email={email} />
                ))}
              </div>
            )}
          </>
        )}
        
        {emails.length === 0 && (
          <div className="text-xs text-gray-500 italic">
            No recent emails in CRM history. Click "View All Emails" to search Gmail.
          </div>
        )}
      </div>

      {/* Deals */}
      {deals.length > 0 && (
        <div className="space-y-3">
          <div 
            onClick={() => toggleSection('deals')}
            className="flex items-center justify-between cursor-pointer"
          >
            <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-amber-400" />
              Deals ({deals.length})
            </h4>
            {expandedSection === 'deals' ? (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </div>
          {expandedSection === 'deals' && (
            <div className="space-y-2">
              {deals.map(deal => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Activities */}
      {activities.length > 0 && (
        <div className="space-y-3">
          <div 
            onClick={() => toggleSection('activities')}
            className="flex items-center justify-between cursor-pointer"
          >
            <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              Recent Activities ({activities.length})
            </h4>
            {expandedSection === 'activities' ? (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </div>
          {expandedSection === 'activities' && (
            <div className="space-y-2">
              {activities.map(activity => (
                <ActivityCard key={activity.id} activity={activity} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Meetings */}
      {meetings.length > 0 && (
        <div className="space-y-3">
          <div 
            onClick={() => toggleSection('meetings')}
            className="flex items-center justify-between cursor-pointer"
          >
            <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              Meetings ({meetings.length})
            </h4>
            {expandedSection === 'meetings' ? (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </div>
          {expandedSection === 'meetings' && (
            <div className="space-y-2">
              {meetings.map(meeting => (
                <MeetingCard key={meeting.id} meeting={meeting} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tasks */}
      {tasks.length > 0 && (
        <div className="space-y-3">
          <div 
            onClick={() => toggleSection('tasks')}
            className="flex items-center justify-between cursor-pointer"
          >
            <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-violet-400" />
              Tasks ({tasks.length})
            </h4>
            {expandedSection === 'tasks' ? (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </div>
          {expandedSection === 'tasks' && (
            <div className="space-y-2">
              {tasks.map(task => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <ActionButtons actions={data.actions} onActionClick={onActionClick} />
    </div>
  );
};

export default ContactResponse;

