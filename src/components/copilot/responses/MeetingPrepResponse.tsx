import React from 'react';
import { MeetingPrepResponse as MeetingPrepResponseType } from '../types';
import { Calendar, User, Briefcase, MessageSquare, AlertTriangle, TrendingUp, CheckSquare } from 'lucide-react';

interface MeetingPrepResponseProps {
  data: MeetingPrepResponseType;
  onActionClick?: (action: string, data?: any) => void;
}

export const MeetingPrepResponse: React.FC<MeetingPrepResponseProps> = ({ data, onActionClick }) => {
  const { meeting, contact, deal, lastInteractions, talkingPoints, discoveryQuestions, actionItems, risks, opportunities, context } = data.data;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Meeting Header */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Calendar className="w-5 h-5 text-blue-500 mt-1" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">{meeting.title}</h3>
            <div className="mt-2 space-y-1 text-sm text-gray-400">
              <div>{new Date(meeting.startTime).toLocaleString()}</div>
              {meeting.location && <div>Location: {meeting.location}</div>}
              {meeting.attendees.length > 0 && (
                <div>Attendees: {meeting.attendees.map(a => a.name).join(', ')}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Contact Info */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <User className="w-5 h-5 text-purple-500 mt-1" />
          <div className="flex-1">
            <h4 className="font-semibold text-white">{contact.name}</h4>
            {contact.company && <p className="text-sm text-gray-400">{contact.company}</p>}
            {contact.title && <p className="text-xs text-gray-500">{contact.title}</p>}
            {contact.email && <p className="text-xs text-gray-500 mt-1">{contact.email}</p>}
          </div>
        </div>
      </div>

      {/* Deal Context */}
      {deal && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Briefcase className="w-5 h-5 text-blue-500 mt-1" />
            <div className="flex-1">
              <h4 className="font-semibold text-white">{deal.name}</h4>
              <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Value:</span>
                  <span className="text-white ml-2 font-semibold">{formatCurrency(deal.value)}</span>
                </div>
                <div>
                  <span className="text-gray-400">Stage:</span>
                  <span className="text-white ml-2 font-semibold">{deal.stage}</span>
                </div>
                <div>
                  <span className="text-gray-400">Probability:</span>
                  <span className="text-white ml-2 font-semibold">{deal.probability}%</span>
                </div>
                {deal.closeDate && (
                  <div>
                    <span className="text-gray-400">Close Date:</span>
                    <span className="text-white ml-2 font-semibold">
                      {new Date(deal.closeDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Context Summary */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <h4 className="font-semibold text-white mb-3">Relationship Context</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Duration:</span>
            <span className="text-white ml-2">{context.relationshipDuration}</span>
          </div>
          <div>
            <span className="text-gray-400">Previous Meetings:</span>
            <span className="text-white ml-2">{context.previousMeetings}</span>
          </div>
          {context.lastMeetingDate && (
            <div>
              <span className="text-gray-400">Last Meeting:</span>
              <span className="text-white ml-2">
                {new Date(context.lastMeetingDate).toLocaleDateString()}
              </span>
            </div>
          )}
          {context.sentiment && (
            <div>
              <span className="text-gray-400">Sentiment:</span>
              <span className={`ml-2 ${
                context.sentiment === 'positive' ? 'text-green-400' :
                context.sentiment === 'negative' ? 'text-red-400' :
                'text-gray-400'
              }`}>
                {context.sentiment}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Last Interactions */}
      {lastInteractions.length > 0 && (
        <div>
          <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-gray-400" />
            Recent Interactions
          </h4>
          <div className="space-y-3">
            {lastInteractions.map((interaction) => (
              <div key={interaction.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-sm font-medium text-white capitalize">{interaction.type}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(interaction.date).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-300 mt-2">{interaction.summary}</p>
                {interaction.keyPoints && interaction.keyPoints.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {interaction.keyPoints.map((point, idx) => (
                      <div key={idx} className="text-xs text-gray-400">• {point}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Talking Points */}
      {talkingPoints.length > 0 && (
        <div>
          <h4 className="font-semibold text-white mb-3">Talking Points</h4>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <ul className="space-y-2">
              {talkingPoints.map((point, idx) => (
                <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Discovery Questions */}
      {discoveryQuestions.length > 0 && (
        <div>
          <h4 className="font-semibold text-white mb-3">Discovery Questions</h4>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <ul className="space-y-2">
              {discoveryQuestions.map((question, idx) => (
                <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                  <span className="text-purple-500 mt-1">?</span>
                  <span>{question}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Action Items */}
      {actionItems.length > 0 && (
        <div>
          <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-yellow-500" />
            Action Items
          </h4>
          <div className="space-y-2">
            {actionItems.map((item) => (
              <div key={item.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      item.status === 'completed' ? 'bg-green-500' : 'bg-yellow-500'
                    }`} />
                    <div>
                      <div className="text-sm font-medium text-white">{item.title}</div>
                      {item.fromMeeting && (
                        <div className="text-xs text-gray-400 mt-1">From: {item.fromMeeting}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {item.status === 'completed' ? 'Completed' : 'Pending'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risks */}
      {risks.length > 0 && (
        <div>
          <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Risks to Watch
          </h4>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <ul className="space-y-2">
              {risks.map((risk, idx) => (
                <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                  <span className="text-red-500 mt-1">⚠</span>
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Opportunities */}
      {opportunities.length > 0 && (
        <div>
          <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            Opportunities
          </h4>
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
            <ul className="space-y-2">
              {opportunities.map((opp, idx) => (
                <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                  <span className="text-green-500 mt-1">↑</span>
                  <span>{opp}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

