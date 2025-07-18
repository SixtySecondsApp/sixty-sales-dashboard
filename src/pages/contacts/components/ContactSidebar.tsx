import React, { useState, useEffect } from 'react';
import { User, Users, Mail, Phone, Building2, TrendingUp, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiContactService } from '@/lib/services/apiContactService';
import type { Contact } from '@/lib/database/models';

interface ContactSidebarProps {
  contact: Contact;
}

export function ContactSidebar({ contact }: ContactSidebarProps) {
  const [leadOwner, setLeadOwner] = useState<any>(null);
  const [activitySummary, setActivitySummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!contact.id) return;
      
      try {
        setLoading(true);
        
        // Fetch real data in parallel
        const [ownerData, statsData] = await Promise.all([
          ApiContactService.getContactOwner(contact.id),
          ApiContactService.getContactStats(contact.id)
        ]);
        
        setLeadOwner(ownerData);
        setActivitySummary(statsData);
      } catch (error) {
        console.error('Error fetching sidebar data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [contact.id]);

  // Fallback data while loading or if no data
  const defaultOwner = {
    name: 'Unassigned',
    title: 'No Sales Rep',
    email: 'Not assigned',
    assigned_date: contact.created_at
  };

  const defaultStats = {
    meetings: 0,
    emails: 0,
    calls: 0,
    totalDeals: 0,
    engagementScore: 0
  };

  const ownerInfo = leadOwner || defaultOwner;
  const stats = activitySummary || defaultStats;

  const getInitials = (name: string) => {
    if (!name) return 'NA';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'Unknown';
    }
  };

  const getEngagementColor = (score: number) => {
    if (score >= 80) return 'from-green-500/20 to-blue-500/20 border-green-500/30 text-green-400';
    if (score >= 50) return 'from-yellow-500/20 to-orange-500/20 border-yellow-500/30 text-yellow-400';
    return 'from-red-500/20 to-pink-500/20 border-red-500/30 text-red-400';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Loading skeleton */}
        <div className="section-card animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-32 mb-4"></div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gray-700 rounded-full"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-700 rounded w-24"></div>
              <div className="h-3 bg-gray-700 rounded w-20"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Lead Owner Card */}
      <div className="section-card bg-gradient-to-br from-blue-900/20 to-blue-800/10 border-blue-500/20">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
          <User className="w-5 h-5 text-blue-400" />
          Lead Owner
        </h2>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
            {getInitials(ownerInfo.name)}
          </div>
          <div>
            <p className="text-white font-medium">{ownerInfo.name}</p>
            <p className="text-gray-400 text-sm">{ownerInfo.title}</p>
            <p className="text-gray-400 text-xs">{ownerInfo.email}</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-blue-500/20">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400 text-xs">Assigned</p>
              <p className="text-white">{formatDate(ownerInfo.assigned_date)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Last Contact</p>
              <p className="text-white">
                {stats.recentActivities?.length > 0 
                  ? formatDate(stats.recentActivities[0].created_at)
                  : 'No activity'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Information Card */}
      <div className="section-card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-400" />
          Contact Information
        </h2>
        <div className="space-y-4 text-sm">
          {/* Email */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50">
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Email</p>
              <p className="text-white">{contact.email}</p>
            </div>
            <button className="btn-icon">
              <Mail className="w-4 h-4" />
            </button>
          </div>

          {/* Phone */}
          {contact.phone && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50">
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Phone</p>
                <p className="text-white">{contact.phone}</p>
              </div>
              <button className="btn-icon">
                <Phone className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Additional Info */}
          <div className="grid grid-cols-1 gap-3">
            {contact.company && (
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Company</p>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  <span className="text-white">{contact.company.name}</span>
                  {contact.company.website && (
                    <a
                      href={contact.company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            )}
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Added on</p>
              <p className="text-white">
                {formatDate(contact.created_at)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Summary */}
      <div className="section-card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-400" />
          Activity Summary
        </h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="activity-metric text-center p-3 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20">
            <div className="text-2xl font-bold text-white mb-1">{stats.meetings}</div>
            <div className="text-xs text-gray-400">Meetings</div>
          </div>
          <div className="activity-metric text-center p-3 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20">
            <div className="text-2xl font-bold text-white mb-1">{stats.emails}</div>
            <div className="text-xs text-gray-400">Emails</div>
          </div>
          <div className="activity-metric text-center p-3 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20">
            <div className="text-2xl font-bold text-white mb-1">{stats.calls}</div>
            <div className="text-xs text-gray-400">Calls</div>
          </div>
          <div className="activity-metric text-center p-3 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20">
            <div className="text-2xl font-bold text-white mb-1">{stats.totalDeals}</div>
            <div className="text-xs text-gray-400">Deals</div>
          </div>
        </div>
        <div className={`p-3 rounded-lg bg-gradient-to-r ${getEngagementColor(stats.engagementScore)}`}>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-current rounded-full"></div>
            <span className="text-current text-sm font-medium">Engagement Score</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.engagementScore}%</div>
          <div className="text-xs text-gray-400">
            {stats.engagementScore >= 80 ? 'Highly engaged' :
             stats.engagementScore >= 50 ? 'Moderately engaged' : 
             'Low engagement'}
          </div>
        </div>
      </div>
    </div>
  );
} 