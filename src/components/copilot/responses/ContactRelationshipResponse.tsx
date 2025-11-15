import React from 'react';
import { ContactRelationshipResponse as ContactRelationshipResponseType } from '../types';
import { Users, Building2, TrendingUp, Clock, Mail } from 'lucide-react';

interface ContactRelationshipResponseProps {
  data: ContactRelationshipResponseType;
  onActionClick?: (action: string, data?: any) => void;
}

export const ContactRelationshipResponse: React.FC<ContactRelationshipResponseProps> = ({ data, onActionClick }) => {
  const { contacts, companyContacts, topContacts, inactiveContacts, metrics } = data.data;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value);
  };

  const getRelationshipColor = (strength: string) => {
    switch (strength) {
      case 'strong': return 'text-green-500';
      case 'moderate': return 'text-yellow-500';
      case 'weak': return 'text-orange-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Metrics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-400">Total Contacts</span>
          </div>
          <div className="text-2xl font-bold text-white">{metrics.totalContacts}</div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-gray-400">With Deals</span>
          </div>
          <div className="text-2xl font-bold text-white">{metrics.contactsWithDeals}</div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium text-gray-400">Total Value</span>
          </div>
          <div className="text-2xl font-bold text-white">{formatCurrency(metrics.totalDealValue)}</div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-medium text-gray-400">Need Follow-up</span>
          </div>
          <div className="text-2xl font-bold text-white">{metrics.contactsNeedingFollowUp}</div>
        </div>
      </div>

      {/* Company Contacts */}
      {companyContacts && companyContacts.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-purple-500" />
            Contacts by Company
          </h3>
          <div className="space-y-4">
            {companyContacts.map((company) => (
              <div key={company.companyId} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-white">{company.companyName}</h4>
                    <p className="text-sm text-gray-400">{company.contacts.length} contacts</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-white">{formatCurrency(company.totalDealValue)}</div>
                    <div className="text-sm text-gray-400">{company.activeDeals} active deals</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {company.contacts.map((contact) => (
                    <div key={contact.id} className="flex items-center justify-between bg-gray-900/50 rounded p-2">
                      <div>
                        <div className="text-sm font-medium text-white">{contact.name}</div>
                        {contact.title && <div className="text-xs text-gray-400">{contact.title}</div>}
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-white">{formatCurrency(contact.totalDealValue)}</div>
                        <div className={`text-xs ${getRelationshipColor(contact.relationshipStrength)}`}>
                          {contact.relationshipStrength}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Contacts */}
      {topContacts.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            Top Contacts
          </h3>
          <div className="space-y-3">
            {topContacts.map((contact) => (
              <div key={contact.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-white">{contact.name}</h4>
                    {contact.company && <p className="text-sm text-gray-400">{contact.company}</p>}
                    {contact.title && <p className="text-xs text-gray-500">{contact.title}</p>}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-white">{formatCurrency(contact.totalDealValue)}</div>
                    <div className="text-sm text-gray-400">{contact.activeDeals} active deals</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 text-sm">
                  <div className={`${getRelationshipColor(contact.relationshipStrength)}`}>
                    {contact.relationshipStrength} relationship
                  </div>
                  {contact.lastContact && (
                    <div className="text-gray-400">
                      Last contact: {new Date(contact.lastContact).toLocaleDateString()}
                    </div>
                  )}
                  {contact.recentActivities > 0 && (
                    <div className="text-gray-400">
                      {contact.recentActivities} recent activities
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inactive Contacts */}
      {inactiveContacts.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-500" />
            Inactive Contacts ({inactiveContacts.length})
          </h3>
          <div className="space-y-3">
            {inactiveContacts.map((contact) => (
              <div key={contact.id} className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-white">{contact.name}</h4>
                    {contact.company && <p className="text-sm text-gray-400">{contact.company}</p>}
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-yellow-400">
                      {contact.daysSinceContact} days since contact
                    </div>
                    {contact.lastContact && (
                      <div className="text-xs text-gray-400">
                        {new Date(contact.lastContact).toLocaleDateString()}
                      </div>
                    )}
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

