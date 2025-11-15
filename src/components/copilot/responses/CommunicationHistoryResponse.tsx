import React from 'react';
import { CommunicationHistoryResponse as CommunicationHistoryResponseType } from '../types';
import { Mail, Phone, Calendar, CheckSquare, FileText, Clock, AlertCircle } from 'lucide-react';

interface CommunicationHistoryResponseProps {
  data: CommunicationHistoryResponseType;
  onActionClick?: (action: string, data?: any) => void;
}

export const CommunicationHistoryResponse: React.FC<CommunicationHistoryResponseProps> = ({ data, onActionClick }) => {
  const { contactName, dealName, communications, timeline, overdueFollowUps, nextActions, summary } = data.data;

  const getIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="w-4 h-4" />;
      case 'call': return <Phone className="w-4 h-4" />;
      case 'meeting': return <Calendar className="w-4 h-4" />;
      case 'task': return <CheckSquare className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'email': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'call': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'meeting': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'task': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      {(contactName || dealName) && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white">
            {contactName && `Communication with ${contactName}`}
            {dealName && ` - ${dealName}`}
          </h3>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-400 mb-1">Total</div>
          <div className="text-2xl font-bold text-white">{summary.totalCommunications}</div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-400 mb-1">Emails</div>
          <div className="text-2xl font-bold text-white">{summary.emailsSent}</div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-400 mb-1">Calls</div>
          <div className="text-2xl font-bold text-white">{summary.callsMade}</div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-400 mb-1">Meetings</div>
          <div className="text-2xl font-bold text-white">{summary.meetingsHeld}</div>
        </div>
      </div>

      {/* Overdue Follow-ups */}
      {overdueFollowUps.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            Overdue Follow-ups ({overdueFollowUps.length})
          </h3>
          <div className="space-y-3">
            {overdueFollowUps.map((followUp) => (
              <div key={followUp.id} className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded ${getTypeColor(followUp.type)}`}>
                      {getIcon(followUp.type)}
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">{followUp.title}</h4>
                      {followUp.contactName && (
                        <p className="text-sm text-gray-400">Contact: {followUp.contactName}</p>
                      )}
                      {followUp.dealName && (
                        <p className="text-sm text-gray-400">Deal: {followUp.dealName}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-red-400">{followUp.daysOverdue} days overdue</div>
                    <div className="text-xs text-gray-400">
                      Due: {new Date(followUp.dueDate).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next Actions */}
      {nextActions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-blue-500" />
            Next Actions
          </h3>
          <div className="space-y-3">
            {nextActions.map((action) => (
              <div key={action.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded ${getTypeColor(action.type)}`}>
                      {getIcon(action.type)}
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">{action.title}</h4>
                      {action.contactName && (
                        <p className="text-sm text-gray-400">Contact: {action.contactName}</p>
                      )}
                      {action.dealName && (
                        <p className="text-sm text-gray-400">Deal: {action.dealName}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {action.dueDate && (
                      <div className="text-sm text-gray-400">
                        {new Date(action.dueDate).toLocaleDateString()}
                      </div>
                    )}
                    <div className={`text-xs mt-1 px-2 py-1 rounded ${
                      action.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                      action.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {action.priority}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Communications */}
      {communications.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Recent Communications</h3>
          <div className="space-y-3">
            {communications.map((comm) => (
              <div key={comm.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded ${getTypeColor(comm.type)}`}>
                    {getIcon(comm.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-white">{comm.subject || comm.type}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-1 rounded ${getTypeColor(comm.type)}`}>
                            {comm.type}
                          </span>
                          <span className="text-xs text-gray-400">
                            {comm.direction}
                          </span>
                        </div>
                      </div>
                      <div className="text-sm text-gray-400">
                        {new Date(comm.date).toLocaleDateString()}
                      </div>
                    </div>
                    {comm.summary && (
                      <p className="text-sm text-gray-300 mt-2">{comm.summary}</p>
                    )}
                    {comm.relatedDealName && (
                      <div className="mt-2 text-xs text-gray-400">
                        Related to: {comm.relatedDealName}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      {timeline.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Timeline</h3>
          <div className="space-y-3">
            {timeline.map((event) => (
              <div key={event.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-white">{event.title}</h4>
                    {event.description && (
                      <p className="text-sm text-gray-300 mt-1">{event.description}</p>
                    )}
                    {event.relatedTo && (
                      <div className="text-xs text-gray-400 mt-1">Related to: {event.relatedTo}</div>
                    )}
                  </div>
                  <div className="text-sm text-gray-400">
                    {new Date(event.date).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

