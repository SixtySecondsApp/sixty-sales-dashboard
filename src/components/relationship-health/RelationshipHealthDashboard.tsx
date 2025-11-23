/**
 * RelationshipHealthDashboard Component
 *
 * Main dashboard for the Relationship Health Monitor feature.
 * Provides a comprehensive view of all relationship health metrics,
 * ghost risks, intervention opportunities, and actionable insights.
 */

import { useState, useMemo } from 'react';
import {
  useAllRelationshipsHealth,
  useGhostRisks,
  useInterventionAnalytics,
} from '@/lib/hooks/useRelationshipHealth';
import { HealthScoreBadge } from './HealthScoreBadge';
import { InterventionAlertCard } from './InterventionAlertCard';
import { GhostDetectionPanel } from './GhostDetectionPanel';
import { InterventionModal } from './InterventionModal';
import { TemplateLibrary } from './TemplateLibrary';
import { RelationshipTimeline } from './RelationshipTimeline';
import type { RelationshipHealthScore } from '@/lib/services/relationshipHealthService';
import type { GhostRisk } from '@/lib/services/ghostDetectionService';
import {
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Users,
  Send,
  BarChart3,
  Settings,
  Filter,
  Search,
  ArrowUp,
  ArrowDown,
  Clock,
  Target,
} from 'lucide-react';

interface RelationshipHealthDashboardProps {
  userId: string;
}

type ViewMode = 'overview' | 'at-risk' | 'interventions' | 'templates' | 'analytics';
type SortOption = 'health' | 'risk' | 'recent' | 'value';

/**
 * Render the Relationship Health Dashboard for a given user.
 *
 * Fetches relationship health data, ghost-risk alerts, and intervention analytics for the specified user,
 * then presents summary statistics, filtered/sortable relationship lists, urgent alerts, templates, and an
 * intervention workflow UI including a modal to send interventions.
 *
 * @param userId - ID of the user whose relationships and analytics should be displayed
 * @returns The JSX element for the Relationship Health Dashboard
 */
export function RelationshipHealthDashboard({ userId }: RelationshipHealthDashboardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [sortBy, setSortBy] = useState<SortOption>('health');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRelationship, setSelectedRelationship] = useState<RelationshipHealthScore | null>(null);
  const [selectedGhostRisk, setSelectedGhostRisk] = useState<GhostRisk | null>(null);
  const [showInterventionModal, setShowInterventionModal] = useState(false);

  // Fetch data
  const { relationships, isLoading: loadingRelationships } = useAllRelationshipsHealth(userId);
  const { ghostRisks, isLoading: loadingGhosts } = useGhostRisks(userId);
  const { analytics } = useInterventionAnalytics(userId, 30);

  // Calculate summary stats
  const stats = useMemo(() => {
    if (!relationships) {
      return {
        total: 0,
        healthy: 0,
        atRisk: 0,
        critical: 0,
        ghost: 0,
        avgScore: 0,
      };
    }

    const total = relationships.length;
    const healthy = relationships.filter((r) => r.health_status === 'healthy').length;
    const atRisk = relationships.filter((r) => r.health_status === 'at_risk').length;
    const critical = relationships.filter((r) => r.health_status === 'critical').length;
    const ghost = relationships.filter((r) => r.health_status === 'ghost').length;
    const avgScore = total > 0
      ? Math.round(relationships.reduce((sum, r) => sum + r.overall_health_score, 0) / total)
      : 0;

    return { total, healthy, atRisk, critical, ghost, avgScore };
  }, [relationships]);

  // Filter and sort relationships
  const filteredRelationships = useMemo(() => {
    if (!relationships) return [];

    let filtered = relationships;

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((r) => {
        // TODO: Join with contacts/companies to search by name
        return r.contact_id?.toLowerCase().includes(query) ||
               r.company_id?.toLowerCase().includes(query);
      });
    }

    // Filter by view mode
    if (viewMode === 'at-risk') {
      filtered = filtered.filter((r) => ['at_risk', 'critical', 'ghost'].includes(r.health_status));
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'health') {
        return a.overall_health_score - b.overall_health_score; // Lowest first
      } else if (sortBy === 'risk') {
        const statusOrder = { ghost: 0, critical: 1, at_risk: 2, healthy: 3 };
        return statusOrder[a.health_status] - statusOrder[b.health_status];
      } else if (sortBy === 'recent') {
        return new Date(b.last_calculated_at).getTime() - new Date(a.last_calculated_at).getTime();
      }
      return 0;
    });

    return filtered;
  }, [relationships, searchQuery, viewMode, sortBy]);

  const handleSendIntervention = (relationshipHealth: RelationshipHealthScore, ghostRisk: GhostRisk) => {
    setSelectedRelationship(relationshipHealth);
    setSelectedGhostRisk(ghostRisk);
    setShowInterventionModal(true);
  };

  if (loadingRelationships || loadingGhosts) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Relationship Health Monitor</h1>
          <p className="text-gray-400 mt-1">
            AI-powered early warning system for relationship decay
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 transition-colors">
          <Settings className="w-4 h-4" />
          Settings
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total Relationships"
          value={stats.total}
          icon={Users}
          color="blue"
        />
        <StatCard
          label="Healthy"
          value={stats.healthy}
          icon={CheckCircle2}
          color="green"
          percentage={stats.total > 0 ? Math.round((stats.healthy / stats.total) * 100) : 0}
        />
        <StatCard
          label="At Risk"
          value={stats.atRisk}
          icon={AlertTriangle}
          color="yellow"
          percentage={stats.total > 0 ? Math.round((stats.atRisk / stats.total) * 100) : 0}
        />
        <StatCard
          label="Critical"
          value={stats.critical}
          icon={TrendingDown}
          color="orange"
          percentage={stats.total > 0 ? Math.round((stats.critical / stats.total) * 100) : 0}
        />
        <StatCard
          label="Ghost"
          value={stats.ghost}
          icon={Activity}
          color="red"
          percentage={stats.total > 0 ? Math.round((stats.ghost / stats.total) * 100) : 0}
        />
      </div>

      {/* Intervention Performance */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard
            label="Interventions Sent"
            value={analytics.sent}
            icon={Send}
            color="blue"
          />
          <MetricCard
            label="Response Rate"
            value={`${analytics.responseRate}%`}
            icon={Target}
            color="green"
            trend={analytics.responseRate > 40 ? 'up' : 'down'}
          />
          <MetricCard
            label="Recovery Rate"
            value={`${analytics.recoveryRate}%`}
            icon={CheckCircle2}
            color="purple"
            trend={analytics.recoveryRate > 30 ? 'up' : 'down'}
          />
          <MetricCard
            label="Replied"
            value={analytics.replied}
            icon={BarChart3}
            color="orange"
          />
        </div>
      )}

      {/* View Mode Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10">
        <TabButton
          active={viewMode === 'overview'}
          onClick={() => setViewMode('overview')}
          icon={Activity}
        >
          Overview
        </TabButton>
        <TabButton
          active={viewMode === 'at-risk'}
          onClick={() => setViewMode('at-risk')}
          icon={AlertTriangle}
          badge={stats.atRisk + stats.critical + stats.ghost}
        >
          At Risk
        </TabButton>
        <TabButton
          active={viewMode === 'interventions'}
          onClick={() => setViewMode('interventions')}
          icon={Send}
        >
          Interventions
        </TabButton>
        <TabButton
          active={viewMode === 'templates'}
          onClick={() => setViewMode('templates')}
          icon={BarChart3}
        >
          Templates
        </TabButton>
        <TabButton
          active={viewMode === 'analytics'}
          onClick={() => setViewMode('analytics')}
          icon={TrendingDown}
        >
          Analytics
        </TabButton>
      </div>

      {/* Overview View */}
      {viewMode === 'overview' && (
        <div className="space-y-6">
          {/* Critical Alerts */}
          {ghostRisks && ghostRisks.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                Urgent: Relationships at Risk ({ghostRisks.length})
              </h2>
              <div className="space-y-3">
                {ghostRisks.slice(0, 5).map((risk) => {
                  const relationship = relationships?.find((r) => r.id === risk.relationshipHealthId);
                  if (!relationship) return null;
                  return (
                    <InterventionAlertCard
                      key={risk.id}
                      relationshipHealth={relationship}
                      ghostRisk={risk}
                      contactName={risk.contactId || 'Unknown'} // TODO: Join with contacts
                      onSendIntervention={() => handleSendIntervention(relationship, risk)}
                      onSnooze={() => {}}
                      onMarkHandled={() => {}}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Search and Filter */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search relationships..."
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="health">Sort by Health (Lowest)</option>
              <option value="risk">Sort by Risk (Highest)</option>
              <option value="recent">Sort by Recent</option>
            </select>
          </div>

          {/* Relationship List */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredRelationships.map((relationship) => (
              <RelationshipCard
                key={relationship.id}
                relationship={relationship}
                onClick={() => setSelectedRelationship(relationship)}
              />
            ))}
          </div>
        </div>
      )}

      {/* At Risk View */}
      {viewMode === 'at-risk' && (
        <div className="space-y-4">
          <p className="text-gray-400">
            Showing {filteredRelationships.length} relationships requiring attention
          </p>
          <div className="space-y-3">
            {ghostRisks?.map((risk) => {
              const relationship = relationships?.find((r) => r.id === risk.relationshipHealthId);
              if (!relationship) return null;
              return (
                <InterventionAlertCard
                  key={risk.id}
                  relationshipHealth={relationship}
                  ghostRisk={risk}
                  contactName={risk.contactId || 'Unknown'}
                  onSendIntervention={() => handleSendIntervention(relationship, risk)}
                  onSnooze={() => {}}
                  onMarkHandled={() => {}}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Templates View */}
      {viewMode === 'templates' && (
        <TemplateLibrary />
      )}

      {/* Analytics View */}
      {viewMode === 'analytics' && (
        <div className="space-y-6">
          <div className="text-center py-12 bg-white/5 border border-white/10 rounded-lg">
            <BarChart3 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">Analytics view coming soon</p>
            <p className="text-sm text-gray-500 mt-1">
              Detailed performance metrics and trends
            </p>
          </div>
        </div>
      )}

      {/* Intervention Modal */}
      {showInterventionModal && selectedRelationship && selectedGhostRisk && (
        <InterventionModal
          isOpen={showInterventionModal}
          onClose={() => {
            setShowInterventionModal(false);
            setSelectedRelationship(null);
            setSelectedGhostRisk(null);
          }}
          relationshipHealth={selectedRelationship}
          ghostRisk={selectedGhostRisk}
          personalizedTemplate={null} // Will be fetched inside modal
          onSendIntervention={async () => {
            // Handle intervention sending
            setShowInterventionModal(false);
          }}
        />
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'yellow' | 'orange' | 'red';
  percentage?: number;
}

/**
 * Renders a small statistic card showing a label, an icon, a primary value, and an optional percentage.
 *
 * @param label - Human-readable label shown above the value
 * @param value - Primary value displayed prominently
 * @param icon - Icon component rendered in the colored square at the top-right
 * @param color - Visual theme for the icon background; one of "blue", "green", "yellow", "orange", or "red"
 * @param percentage - Optional percentage displayed to the right of the value (rendered as `percentage%`)
 * @returns A JSX element containing the styled stat card
 */
function StatCard({ label, value, icon: Icon, color, percentage }: StatCardProps) {
  const colors = {
    blue: 'bg-blue-500/10 text-blue-400',
    green: 'bg-green-500/10 text-green-400',
    yellow: 'bg-yellow-500/10 text-yellow-400',
    orange: 'bg-orange-500/10 text-orange-400',
    red: 'bg-red-500/10 text-red-400',
  };

  return (
    <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-400">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="flex items-end justify-between">
        <p className="text-2xl font-bold text-white">{value}</p>
        {percentage !== undefined && (
          <span className="text-sm text-gray-400">{percentage}%</span>
        )}
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'purple' | 'orange';
  trend?: 'up' | 'down';
}

/**
 * Renders a compact metric card showing a label, icon, numeric/text value, and an optional trend indicator.
 *
 * @param label - Short descriptor shown above the metric value
 * @param value - Primary metric to display (number or text)
 * @param icon - Icon component rendered next to the label
 * @param color - Theme color for the icon (affects icon color classes)
 * @param trend - Optional trend direction; `'up'` shows a green upward arrow, `'down'` shows a red downward arrow
 * @returns A JSX element representing the styled metric card
 */
function MetricCard({ label, value, icon: Icon, color, trend }: MetricCardProps) {
  const colors = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    purple: 'text-purple-400',
    orange: 'text-orange-400',
  };

  return (
    <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${colors[color]}`} />
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <div className="flex items-end justify-between">
        <p className="text-2xl font-bold text-white">{value}</p>
        {trend && (
          <span className={trend === 'up' ? 'text-green-400' : 'text-red-400'}>
            {trend === 'up' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
          </span>
        )}
      </div>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  badge?: number;
  children: React.ReactNode;
}

/**
 * Renders a tab-like button used to switch dashboard views with an optional notification badge.
 *
 * Displays an icon and label, highlights when active, invokes `onClick` when pressed, and shows a red circular badge when `badge` is a positive number (values above 99 render as "99+").
 *
 * @param active - Whether the tab is currently active (affects visual styling)
 * @param onClick - Click handler invoked when the tab is pressed
 * @param icon - Icon component to render at the start of the tab
 * @param badge - Optional numeric badge count; omitted when `undefined` or 0
 * @param children - Visible label content for the tab
 * @returns The rendered tab button element
 */
function TabButton({ active, onClick, icon: Icon, badge, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
        active
          ? 'border-blue-500 text-white'
          : 'border-transparent text-gray-400 hover:text-gray-300'
      }`}
    >
      <Icon className="w-4 h-4" />
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

interface RelationshipCardProps {
  relationship: RelationshipHealthScore;
  onClick: () => void;
}

/**
 * Renders a compact, clickable card that displays a relationship's identity, health badge, and three sub-scores.
 *
 * Shows the contact or company identifier, relationship type, an overall HealthScoreBadge (score, status, trend),
 * communication/response/engagement scores, and optional last-contact days. Clicking the card invokes the provided handler.
 *
 * @param relationship - Relationship health data to display (identifiers, overall score, health status/trend, component scores, and last-contact info)
 * @param onClick - Callback invoked when the card is clicked
 * @returns A button-styled card element that summarizes a single relationship's health for use in lists or grids
 */
function RelationshipCard({ relationship, onClick }: RelationshipCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/[0.07] transition-colors text-left"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-white font-semibold mb-1">
            {relationship.contact_id || relationship.company_id || 'Unknown'}
          </h3>
          <p className="text-sm text-gray-400">
            {relationship.relationship_type === 'contact' ? 'Contact' : 'Company'}
          </p>
        </div>
        <HealthScoreBadge
          score={relationship.overall_health_score}
          status={relationship.health_status}
          trend={relationship.health_trend}
          size="sm"
        />
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-gray-400 text-xs mb-1">Communication</p>
          <p className="text-white font-medium">
            {relationship.communication_frequency_score || 0}
          </p>
        </div>
        <div>
          <p className="text-gray-400 text-xs mb-1">Response</p>
          <p className="text-white font-medium">
            {relationship.response_behavior_score || 0}
          </p>
        </div>
        <div>
          <p className="text-gray-400 text-xs mb-1">Engagement</p>
          <p className="text-white font-medium">
            {relationship.engagement_quality_score || 0}
          </p>
        </div>
      </div>

      {relationship.days_since_last_contact !== null && (
        <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2 text-xs text-gray-400">
          <Clock className="w-3 h-3" />
          Last contact: {relationship.days_since_last_contact} days ago
        </div>
      )}
    </button>
  );
}