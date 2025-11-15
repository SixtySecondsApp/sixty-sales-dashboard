import React from 'react';
import { CompanyIntelligenceResponse as CompanyIntelligenceResponseType } from '../types';
import { Building2, Users, Briefcase, Activity, Calendar, TrendingUp, AlertTriangle, Target } from 'lucide-react';
import { MeetingSummaryDisplay } from '@/components/shared/MeetingSummaryDisplay';

interface CompanyIntelligenceResponseProps {
  data: CompanyIntelligenceResponseType;
  onActionClick?: (action: string, data?: any) => void;
}

export const CompanyIntelligenceResponse: React.FC<CompanyIntelligenceResponseProps> = ({ data, onActionClick }) => {
  const { company, contacts, deals, activities, meetings, insights, metrics } = data.data;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value);
  };

  const getRelationshipColor = (strength: string) => {
    switch (strength) {
      case 'strong': return 'text-green-500';
      case 'moderate': return 'text-yellow-500';
      default: return 'text-gray-500';
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'opportunity': return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'risk': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'trend': return <Target className="w-4 h-4 text-blue-500" />;
      default: return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Company Header */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Building2 className="w-6 h-6 text-blue-500 mt-1" />
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-white">{company.name}</h3>
            {company.industry && <p className="text-sm text-gray-400 mt-1">{company.industry}</p>}
            {company.website && (
              <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:underline mt-1 block">
                {company.website}
              </a>
            )}
            {company.description && (
              <p className="text-sm text-gray-300 mt-2">{company.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Briefcase className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-gray-400">Total Value</span>
          </div>
          <div className="text-2xl font-bold text-white">{formatCurrency(metrics.totalDealValue)}</div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-green-500" />
            <span className="text-sm font-medium text-gray-400">Active Deals</span>
          </div>
          <div className="text-2xl font-bold text-white">{metrics.activeDeals}</div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium text-gray-400">Contacts</span>
          </div>
          <div className="text-2xl font-bold text-white">{metrics.totalContacts}</div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-medium text-gray-400">Recent Activities</span>
          </div>
          <div className="text-2xl font-bold text-white">{metrics.recentActivities}</div>
        </div>
      </div>

      {/* Relationship Strength */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-gray-400">Relationship Strength</span>
            <div className={`text-2xl font-bold mt-1 ${getRelationshipColor(metrics.relationshipStrength)}`}>
              {metrics.relationshipStrength}
            </div>
          </div>
        </div>
      </div>

      {/* Contacts */}
      {contacts.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-500" />
            Contacts ({contacts.length})
          </h4>
          <div className="space-y-3">
            {contacts.map((contact) => (
              <div key={contact.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="font-semibold text-white">{contact.name}</h5>
                      {contact.isPrimary && (
                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                          Primary
                        </span>
                      )}
                    </div>
                    {contact.title && <p className="text-sm text-gray-400">{contact.title}</p>}
                    <div className="mt-2 space-y-1 text-xs text-gray-400">
                      {contact.email && <div>✉️ {contact.email}</div>}
                      {contact.phone && <div>📞 {contact.phone}</div>}
                      {contact.lastContact && (
                        <div>📅 Last contact: {new Date(contact.lastContact).toLocaleDateString()}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deals */}
      {deals.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-blue-500" />
            Deals ({deals.length})
          </h4>
          <div className="space-y-3">
            {deals.map((deal) => (
              <div key={deal.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h5 className="font-semibold text-white">{deal.name}</h5>
                    <p className="text-sm text-gray-400">{deal.stage}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-white">{formatCurrency(deal.value)}</div>
                    <div className="text-sm text-gray-400">{deal.probability}% probability</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                  <div>
                    <span className="text-gray-400">Health Score:</span>
                    <span className="text-white ml-2 font-semibold">{deal.healthScore}</span>
                  </div>
                  {deal.closeDate && (
                    <div>
                      <span className="text-gray-400">Close Date:</span>
                      <span className="text-white ml-2 font-semibold">
                        {new Date(deal.closeDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-400">Owner:</span>
                    <span className="text-white ml-2 font-semibold">{deal.owner}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-white mb-3">Key Insights</h4>
          <div className="space-y-3">
            {insights.map((insight) => (
              <div
                key={insight.id}
                className={`border rounded-lg p-4 ${
                  insight.type === 'opportunity' ? 'bg-green-500/10 border-green-500/20' :
                  insight.type === 'risk' ? 'bg-red-500/10 border-red-500/20' :
                  insight.type === 'trend' ? 'bg-blue-500/10 border-blue-500/20' :
                  'bg-gray-800/50 border-gray-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  {getInsightIcon(insight.type)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h5 className="font-semibold text-white capitalize">{insight.type}</h5>
                      <span className={`text-xs px-2 py-1 rounded ${
                        insight.impact === 'high' ? 'bg-red-500/20 text-red-400' :
                        insight.impact === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {insight.impact} impact
                      </span>
                    </div>
                    <h6 className="font-medium text-white mt-1">{insight.title}</h6>
                    <p className="text-sm text-gray-300 mt-1">{insight.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activities */}
      {activities.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
            <Activity className="w-5 h-5 text-yellow-500" />
            Recent Activities ({activities.length})
          </h4>
          <div className="space-y-2">
            {activities.slice(0, 5).map((activity) => (
              <div key={activity.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium text-white capitalize">{activity.type}</div>
                    {activity.summary && (
                      <p className="text-xs text-gray-300 mt-1">{activity.summary}</p>
                    )}
                    {activity.contactName && (
                      <div className="text-xs text-gray-400 mt-1">Contact: {activity.contactName}</div>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(activity.date).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meetings */}
      {meetings.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-500" />
            Meetings ({meetings.length})
          </h4>
          <div className="space-y-3">
            {meetings.map((meeting) => (
              <div key={meeting.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <h5 className="font-semibold text-white">{meeting.title}</h5>
                <div className="mt-2 space-y-1 text-sm text-gray-400">
                  <div>📅 {new Date(meeting.date).toLocaleDateString()}</div>
                  {meeting.attendees.length > 0 && (
                    <div>👥 {meeting.attendees.join(', ')}</div>
                  )}
                  {meeting.summary && (
                    <div className="text-sm text-gray-300 mt-2">
                      <MeetingSummaryDisplay summary={meeting.summary} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

