/**
 * Deal Risk Panel Component
 *
 * Displays risk signals and aggregate risk assessment for a deal:
 * - Overall risk level and score
 * - Active risk signals
 * - Sentiment trend
 * - Recommended actions
 * - Ability to resolve/dismiss signals
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Clock,
  Users,
  DollarSign,
  Shield,
  Target,
  RefreshCw,
  Loader2,
  ChevronRight,
  X,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDealRiskSignals } from '@/lib/hooks/useDealRiskSignals';
import type { DealRiskSignal, RiskSeverity, RiskSignalType } from '@/lib/types/meetingIntelligence';

interface DealRiskPanelProps {
  dealId: string;
  className?: string;
  compact?: boolean;
}

export function DealRiskPanel({ dealId, className, compact = false }: DealRiskPanelProps) {
  const {
    signals,
    aggregate,
    loading,
    analyzing,
    error,
    analyzeRisks,
    resolveSignal,
    dismissSignal,
    riskLevel,
    riskScore,
    hasRisk,
  } = useDealRiskSignals(dealId);

  const [selectedSignal, setSelectedSignal] = useState<DealRiskSignal | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (compact) {
    return (
      <CompactRiskIndicator
        riskLevel={riskLevel}
        riskScore={riskScore}
        signalCount={signals.length}
        onAnalyze={analyzeRisks}
        analyzing={analyzing}
      />
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Risk Overview */}
      <div className="flex items-center justify-between">
        <RiskLevelBadge level={riskLevel} score={riskScore} />
        <button
          onClick={() => analyzeRisks()}
          disabled={analyzing}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border rounded-md hover:bg-muted/50 disabled:opacity-50"
        >
          {analyzing ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <RefreshCw className="h-3 w-3" />
              Re-analyze
            </>
          )}
        </button>
      </div>

      {/* Aggregate Stats */}
      {aggregate && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Days Since Meeting"
            value={aggregate.days_since_last_meeting?.toString() || 'N/A'}
            icon={Clock}
            alert={aggregate.days_since_last_meeting && aggregate.days_since_last_meeting > 14}
          />
          <StatCard
            label="Sentiment Trend"
            value={aggregate.sentiment_trend}
            icon={aggregate.sentiment_trend === 'declining' ? TrendingDown : TrendingUp}
            alert={aggregate.sentiment_trend === 'declining'}
          />
          <StatCard
            label="Champion Contact"
            value={aggregate.days_since_champion_contact ? `${aggregate.days_since_champion_contact}d ago` : 'N/A'}
            icon={Users}
            alert={aggregate.days_since_champion_contact && aggregate.days_since_champion_contact > 14}
          />
          <StatCard
            label="Forward Movement"
            value={aggregate.last_forward_movement_at ? 'Recent' : 'None'}
            icon={Target}
            alert={!aggregate.last_forward_movement_at}
          />
        </div>
      )}

      {/* Risk Summary */}
      {aggregate?.risk_summary && (
        <div className={cn(
          'p-4 rounded-lg',
          riskLevel === 'critical' && 'bg-red-500/10 border border-red-500/30',
          riskLevel === 'high' && 'bg-orange-500/10 border border-orange-500/30',
          riskLevel === 'medium' && 'bg-yellow-500/10 border border-yellow-500/30',
          riskLevel === 'low' && 'bg-green-500/10 border border-green-500/30'
        )}>
          <p className="text-sm">{aggregate.risk_summary}</p>
        </div>
      )}

      {/* Active Signals */}
      {signals.length > 0 ? (
        <div className="space-y-2">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Active Risk Signals ({signals.length})
          </h4>
          <div className="space-y-2">
            {signals.map((signal) => (
              <RiskSignalCard
                key={signal.id}
                signal={signal}
                onResolve={() => setSelectedSignal(signal)}
                onDismiss={() => dismissSignal(signal.id)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-6 bg-green-500/5 rounded-lg border border-green-500/20">
          <CheckCircle2 className="h-8 w-8 mx-auto text-green-500 mb-2" />
          <p className="text-sm text-muted-foreground">No active risk signals detected</p>
        </div>
      )}

      {/* Recommended Actions */}
      {aggregate?.recommended_actions && aggregate.recommended_actions.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <Target className="h-4 w-4" />
            Recommended Actions
          </h4>
          <div className="space-y-2">
            {aggregate.recommended_actions.map((action, i) => (
              <RecommendedActionCard key={i} action={action} />
            ))}
          </div>
        </div>
      )}

      {/* Resolution Modal */}
      <AnimatePresence>
        {selectedSignal && (
          <ResolutionModal
            signal={selectedSignal}
            notes={resolutionNotes}
            onNotesChange={setResolutionNotes}
            onResolve={() => {
              resolveSignal(selectedSignal.id, resolutionNotes);
              setSelectedSignal(null);
              setResolutionNotes('');
            }}
            onClose={() => {
              setSelectedSignal(null);
              setResolutionNotes('');
            }}
          />
        )}
      </AnimatePresence>

      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}

// Sub-components

function RiskLevelBadge({ level, score }: { level: RiskSeverity; score: number }) {
  const config = {
    critical: { bg: 'bg-red-500', icon: AlertTriangle, label: 'Critical Risk' },
    high: { bg: 'bg-orange-500', icon: AlertCircle, label: 'High Risk' },
    medium: { bg: 'bg-yellow-500', icon: AlertTriangle, label: 'Medium Risk' },
    low: { bg: 'bg-green-500', icon: CheckCircle2, label: 'Low Risk' },
  };

  const { bg, icon: Icon, label } = config[level];

  return (
    <div className="flex items-center gap-3">
      <div className={cn('p-2 rounded-full text-white', bg)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">Risk Score: {score}/100</p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  alert = false,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  alert?: boolean;
}) {
  return (
    <div className={cn(
      'p-3 rounded-lg border',
      alert ? 'bg-yellow-500/5 border-yellow-500/30' : 'bg-muted/50'
    )}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn('h-4 w-4', alert ? 'text-yellow-500' : 'text-muted-foreground')} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={cn('font-medium capitalize', alert && 'text-yellow-600')}>{value}</p>
    </div>
  );
}

function RiskSignalCard({
  signal,
  onResolve,
  onDismiss,
}: {
  signal: DealRiskSignal;
  onResolve: () => void;
  onDismiss: () => void;
}) {
  const severityConfig = {
    critical: { bg: 'bg-red-500/10 border-red-500/30', icon: 'text-red-500' },
    high: { bg: 'bg-orange-500/10 border-orange-500/30', icon: 'text-orange-500' },
    medium: { bg: 'bg-yellow-500/10 border-yellow-500/30', icon: 'text-yellow-500' },
    low: { bg: 'bg-blue-500/10 border-blue-500/30', icon: 'text-blue-500' },
  };

  const config = severityConfig[signal.severity];
  const SignalIcon = getSignalIcon(signal.signal_type);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn('p-3 rounded-lg border', config.bg)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <SignalIcon className={cn('h-5 w-5 mt-0.5', config.icon)} />
          <div>
            <p className="font-medium text-sm">{signal.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{signal.description}</p>
            {signal.evidence?.quotes?.length > 0 && (
              <div className="mt-2 space-y-1">
                {signal.evidence.quotes.slice(0, 2).map((quote, i) => (
                  <p key={i} className="text-xs italic text-muted-foreground">
                    "{quote}"
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onResolve}
            className="p-1 hover:bg-green-500/20 rounded text-green-600"
            title="Mark as resolved"
          >
            <CheckCircle2 className="h-4 w-4" />
          </button>
          <button
            onClick={onDismiss}
            className="p-1 hover:bg-muted rounded text-muted-foreground"
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <span className={cn(
          'px-2 py-0.5 rounded text-xs font-medium',
          signal.severity === 'critical' && 'bg-red-500/20 text-red-600',
          signal.severity === 'high' && 'bg-orange-500/20 text-orange-600',
          signal.severity === 'medium' && 'bg-yellow-500/20 text-yellow-600',
          signal.severity === 'low' && 'bg-blue-500/20 text-blue-600'
        )}>
          {signal.severity}
        </span>
        <span className="text-xs text-muted-foreground">
          Detected {new Date(signal.detected_at).toLocaleDateString()}
        </span>
      </div>
    </motion.div>
  );
}

function RecommendedActionCard({ action }: { action: { action: string; priority: string; rationale: string } }) {
  const priorityConfig = {
    high: 'bg-red-500/10 border-red-500/30 text-red-600',
    medium: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-600',
    low: 'bg-blue-500/10 border-blue-500/30 text-blue-600',
  };

  return (
    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
      <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground" />
      <div className="flex-1">
        <p className="text-sm font-medium">{action.action}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{action.rationale}</p>
      </div>
      <span className={cn(
        'px-2 py-0.5 rounded text-xs font-medium',
        priorityConfig[action.priority as keyof typeof priorityConfig]
      )}>
        {action.priority}
      </span>
    </div>
  );
}

function ResolutionModal({
  signal,
  notes,
  onNotesChange,
  onResolve,
  onClose,
}: {
  signal: DealRiskSignal;
  notes: string;
  onNotesChange: (notes: string) => void;
  onResolve: () => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-background rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold mb-4">Resolve Risk Signal</h3>
        <p className="text-sm text-muted-foreground mb-4">{signal.title}</p>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Add resolution notes (optional)..."
          className="w-full p-3 border rounded-md mb-4 text-sm"
          rows={3}
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border rounded-md hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={onResolve}
            className="px-4 py-2 text-sm bg-green-500 text-white rounded-md hover:bg-green-600"
          >
            Mark Resolved
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CompactRiskIndicator({
  riskLevel,
  riskScore,
  signalCount,
  onAnalyze,
  analyzing,
}: {
  riskLevel: RiskSeverity;
  riskScore: number;
  signalCount: number;
  onAnalyze: () => void;
  analyzing: boolean;
}) {
  const config = {
    critical: { bg: 'bg-red-500', text: 'text-red-500' },
    high: { bg: 'bg-orange-500', text: 'text-orange-500' },
    medium: { bg: 'bg-yellow-500', text: 'text-yellow-500' },
    low: { bg: 'bg-green-500', text: 'text-green-500' },
  };

  return (
    <div className="flex items-center gap-3">
      <div className={cn('w-3 h-3 rounded-full', config[riskLevel].bg)} />
      <span className={cn('text-sm font-medium capitalize', config[riskLevel].text)}>
        {riskLevel} Risk
      </span>
      {signalCount > 0 && (
        <span className="text-xs text-muted-foreground">
          ({signalCount} signal{signalCount > 1 ? 's' : ''})
        </span>
      )}
      <button
        onClick={onAnalyze}
        disabled={analyzing}
        className="p-1 hover:bg-muted rounded"
        title="Re-analyze"
      >
        {analyzing ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <RefreshCw className="h-3 w-3" />
        )}
      </button>
    </div>
  );
}

function getSignalIcon(type: RiskSignalType): React.ElementType {
  const icons: Record<RiskSignalType, React.ElementType> = {
    timeline_slip: Clock,
    budget_concern: DollarSign,
    competitor_mention: Shield,
    champion_silent: Users,
    sentiment_decline: TrendingDown,
    stalled_deal: AlertCircle,
    objection_unresolved: MessageSquare,
    stakeholder_concern: Users,
    scope_creep: Target,
    decision_delay: Clock,
  };
  return icons[type] || AlertTriangle;
}

export default DealRiskPanel;
