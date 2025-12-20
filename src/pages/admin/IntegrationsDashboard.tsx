/**
 * Integrations Dashboard
 *
 * Platform admin page for monitoring and testing all integrations.
 * Shows health status, recent test results, and links to individual integration test pages.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
  Video,
  Mail,
  MessageSquare,
  Users,
  Calendar,
  Phone,
  XCircle,
  Bell,
  BellOff,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  INTEGRATIONS,
  type IntegrationDefinition,
  type IntegrationHealthSummary,
  type IntegrationAlert,
  type HealthStatus,
} from '@/lib/integrationTesting';
import {
  getIntegrationHealthSummary,
  getActiveAlerts,
  acknowledgeAlert,
  resolveAlert,
} from '@/lib/integrationTesting/testRunner';

// Icon mapping for integrations
const iconMap: Record<string, React.ElementType> = {
  Video,
  Mail,
  MessageSquare,
  Users,
  Calendar,
  Phone,
};

// Status colors
const statusColors: Record<HealthStatus | 'unknown', string> = {
  healthy: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  critical: 'bg-red-500/10 text-red-500 border-red-500/20',
  unknown: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

const statusIcons: Record<HealthStatus | 'unknown', React.ElementType> = {
  healthy: CheckCircle,
  warning: AlertTriangle,
  critical: XCircle,
  unknown: Clock,
};

interface IntegrationCardProps {
  integration: IntegrationDefinition;
  healthSummary?: IntegrationHealthSummary;
}

function IntegrationCard({ integration, healthSummary }: IntegrationCardProps) {
  const Icon = iconMap[integration.icon] || Activity;
  const status: HealthStatus = healthSummary?.health_status || 'unknown';
  const StatusIcon = statusIcons[status];

  const lastTestAt = healthSummary?.last_test_at
    ? new Date(healthSummary.last_test_at)
    : null;

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <Link
      to={`/platform/integrations/${integration.name}`}
      className="block"
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'group relative bg-white dark:bg-gray-900/80 backdrop-blur-sm',
          'border border-gray-200 dark:border-gray-700/50 rounded-xl p-5',
          'hover:border-gray-300 dark:hover:border-gray-600',
          'transition-all duration-200 cursor-pointer',
          'shadow-sm hover:shadow-md dark:shadow-none'
        )}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'p-2.5 rounded-lg',
                'bg-gray-100 dark:bg-gray-800',
                'group-hover:bg-gray-200 dark:group-hover:bg-gray-700',
                'transition-colors'
              )}
            >
              <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {integration.displayName}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {integration.category}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                'text-xs font-medium',
                statusColors[status]
              )}
            >
              <StatusIcon className="w-3 h-3 mr-1" />
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
          </div>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
          {integration.description}
        </p>

        {healthSummary ? (
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-emerald-500" />
                {healthSummary.passed_count} passed
              </span>
              {healthSummary.failed_count > 0 && (
                <span className="flex items-center gap-1">
                  <XCircle className="w-3 h-3 text-red-500" />
                  {healthSummary.failed_count} failed
                </span>
              )}
            </div>
            {lastTestAt && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTimeAgo(lastTestAt)}
              </span>
            )}
          </div>
        ) : (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            No tests run yet
          </div>
        )}
      </motion.div>
    </Link>
  );
}

interface AlertCardProps {
  alert: IntegrationAlert;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
}

function AlertCard({ alert, onAcknowledge, onResolve }: AlertCardProps) {
  const severityColors: Record<string, string> = {
    critical: 'bg-red-500/10 border-red-500/30 text-red-500',
    high: 'bg-orange-500/10 border-orange-500/30 text-orange-500',
    medium: 'bg-amber-500/10 border-amber-500/30 text-amber-500',
    low: 'bg-blue-500/10 border-blue-500/30 text-blue-500',
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className={cn(
        'flex items-start gap-3 p-4 rounded-lg border',
        severityColors[alert.severity] || severityColors.medium
      )}
    >
      <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {alert.title}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {alert.message}
            </p>
          </div>
          <Badge variant="outline" className={cn('text-xs', severityColors[alert.severity])}>
            {alert.severity}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-3">
          {!alert.acknowledged_at && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAcknowledge(alert.id)}
              className="h-7 text-xs"
            >
              <Bell className="w-3 h-3 mr-1" />
              Acknowledge
            </Button>
          )}
          {!alert.resolved_at && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onResolve(alert.id)}
              className="h-7 text-xs"
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              Resolve
            </Button>
          )}
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
            {new Date(alert.created_at).toLocaleString()}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export default function IntegrationsDashboard() {
  const [healthSummaries, setHealthSummaries] = useState<IntegrationHealthSummary[]>([]);
  const [alerts, setAlerts] = useState<IntegrationAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [summaries, activeAlerts] = await Promise.all([
        getIntegrationHealthSummary(),
        getActiveAlerts(),
      ]);
      setHealthSummaries(summaries);
      setAlerts(activeAlerts);
    } catch (error) {
      console.error('[IntegrationsDashboard] Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleAcknowledge = async (alertId: string) => {
    const success = await acknowledgeAlert(alertId);
    if (success) {
      toast.success('Alert acknowledged');
      fetchData();
    } else {
      toast.error('Failed to acknowledge alert');
    }
  };

  const handleResolve = async (alertId: string) => {
    const success = await resolveAlert(alertId);
    if (success) {
      toast.success('Alert resolved');
      fetchData();
    } else {
      toast.error('Failed to resolve alert');
    }
  };

  // Calculate overall health
  const overallHealth = React.useMemo(() => {
    if (healthSummaries.length === 0) return 'unknown';

    const hasHealthy = healthSummaries.some((s) => s.health_status === 'healthy');
    const hasCritical = healthSummaries.some((s) => s.health_status === 'critical');
    const hasWarning = healthSummaries.some((s) => s.health_status === 'warning');

    if (hasCritical) return 'critical';
    if (hasWarning) return 'warning';
    if (hasHealthy) return 'healthy';
    return 'unknown';
  }, [healthSummaries]);

  const overallPassRate = React.useMemo(() => {
    if (healthSummaries.length === 0) return null;

    const totalPassed = healthSummaries.reduce((acc, s) => acc + s.passed_count, 0);
    const totalTests = healthSummaries.reduce((acc, s) => acc + s.total_tests, 0);

    if (totalTests === 0) return null;
    return Math.round((totalPassed / totalTests) * 100);
  }, [healthSummaries]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 p-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Integrations Dashboard
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Monitor integration health and run diagnostic tests
            </p>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
          >
            <RefreshCw className={cn('w-4 h-4 mr-2', refreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        {/* Overall Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            className={cn(
              'bg-white dark:bg-gray-900/80 backdrop-blur-sm',
              'border border-gray-200 dark:border-gray-700/50 rounded-xl p-5',
              'shadow-sm dark:shadow-none'
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Overall Health</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {overallHealth.charAt(0).toUpperCase() + overallHealth.slice(1)}
                </p>
              </div>
              <div
                className={cn(
                  'p-3 rounded-full',
                  statusColors[overallHealth]
                )}
              >
                {React.createElement(statusIcons[overallHealth], { className: 'w-6 h-6' })}
              </div>
            </div>
          </div>

          <div
            className={cn(
              'bg-white dark:bg-gray-900/80 backdrop-blur-sm',
              'border border-gray-200 dark:border-gray-700/50 rounded-xl p-5',
              'shadow-sm dark:shadow-none'
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Pass Rate</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {overallPassRate !== null ? `${overallPassRate}%` : 'N/A'}
                </p>
              </div>
              <div
                className={cn(
                  'p-3 rounded-full',
                  overallPassRate !== null && overallPassRate >= 80
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : overallPassRate !== null && overallPassRate >= 50
                      ? 'bg-amber-500/10 text-amber-500'
                      : 'bg-gray-500/10 text-gray-400'
                )}
              >
                {overallPassRate !== null && overallPassRate >= 80 ? (
                  <TrendingUp className="w-6 h-6" />
                ) : overallPassRate !== null && overallPassRate < 50 ? (
                  <TrendingDown className="w-6 h-6" />
                ) : (
                  <Activity className="w-6 h-6" />
                )}
              </div>
            </div>
          </div>

          <div
            className={cn(
              'bg-white dark:bg-gray-900/80 backdrop-blur-sm',
              'border border-gray-200 dark:border-gray-700/50 rounded-xl p-5',
              'shadow-sm dark:shadow-none'
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Active Alerts</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {alerts.length}
                </p>
              </div>
              <div
                className={cn(
                  'p-3 rounded-full',
                  alerts.length > 0
                    ? 'bg-red-500/10 text-red-500'
                    : 'bg-emerald-500/10 text-emerald-500'
                )}
              >
                {alerts.length > 0 ? (
                  <Bell className="w-6 h-6" />
                ) : (
                  <BellOff className="w-6 h-6" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Active Alerts */}
        {alerts.length > 0 && (
          <div
            className={cn(
              'bg-white dark:bg-gray-900/80 backdrop-blur-sm',
              'border border-gray-200 dark:border-gray-700/50 rounded-xl p-5',
              'shadow-sm dark:shadow-none'
            )}
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Active Alerts
            </h2>
            <div className="space-y-3">
              <AnimatePresence>
                {alerts.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    onAcknowledge={handleAcknowledge}
                    onResolve={handleResolve}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Integrations Grid */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            All Integrations
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {INTEGRATIONS.map((integration) => {
              const summary = healthSummaries.find(
                (s) => s.integration_name === integration.name
              );
              return (
                <IntegrationCard
                  key={integration.name}
                  integration={integration}
                  healthSummary={summary}
                />
              );
            })}
          </div>
        </div>

        {/* Quick Links */}
        <div
          className={cn(
            'bg-white dark:bg-gray-900/80 backdrop-blur-sm',
            'border border-gray-200 dark:border-gray-700/50 rounded-xl p-5',
            'shadow-sm dark:shadow-none'
          )}
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Quick Links
          </h2>
          <div className="flex flex-wrap gap-3">
            <Link to="/platform/dev/function-testing">
              <Button variant="outline" size="sm">
                <Activity className="w-4 h-4 mr-2" />
                Function Testing
              </Button>
            </Link>
            <Link to="/platform/dev/api-testing">
              <Button variant="outline" size="sm">
                <ExternalLink className="w-4 h-4 mr-2" />
                API Testing
              </Button>
            </Link>
            <Link to="/platform/cron-jobs">
              <Button variant="outline" size="sm">
                <Clock className="w-4 h-4 mr-2" />
                Cron Jobs
              </Button>
            </Link>
            <Link to="/platform/audit">
              <Button variant="outline" size="sm">
                <Activity className="w-4 h-4 mr-2" />
                Audit Logs
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
