/**
 * Deal Health Alert Service
 *
 * Generates proactive alerts based on deal health scores and configured rules.
 * Evaluates thresholds and creates actionable notifications for sales reps.
 */

import { supabase } from '@/lib/supabase/clientV2';
import { notificationService } from './notificationService';
import type { DealHealthScore } from './dealHealthService';

// =====================================================
// Types
// =====================================================
export interface DealHealthAlert {
  id: string;
  deal_id: string;
  health_score_id: string | null;
  user_id: string;
  alert_type:
    | 'stage_stall'
    | 'sentiment_drop'
    | 'engagement_decline'
    | 'no_activity'
    | 'missed_follow_up'
    | 'close_date_approaching'
    | 'high_risk';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  suggested_actions: string[];
  action_priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  dismissed_at: string | null;
  notification_id: string | null;
  notification_sent: boolean;
  notification_sent_at: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface DealHealthRule {
  id: string;
  rule_name: string;
  rule_type: 'stage_velocity' | 'sentiment' | 'engagement' | 'activity' | 'response_time';
  description: string | null;
  threshold_value: number;
  threshold_operator: '>' | '<' | '>=' | '<=' | '=';
  threshold_unit: string | null;
  alert_severity: 'info' | 'warning' | 'critical';
  alert_message_template: string | null;
  suggested_action_template: string | null;
  conditions: Record<string, any> | null;
  is_active: boolean;
  is_system_rule: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface AlertGenerationContext {
  deal: any;
  healthScore: DealHealthScore;
  stageName: string;
  dealValue: number;
  expectedCloseDate: string | null;
}

// =====================================================
// Template Rendering
// =====================================================

/**
 * Render template with deal context
 */
function renderTemplate(template: string, context: AlertGenerationContext): string {
  let rendered = template;

  const replacements: Record<string, any> = {
    '{{deal_name}}': context.deal.name || 'Untitled Deal',
    '{{stage}}': context.stageName,
    '{{days_in_stage}}': context.healthScore.days_in_current_stage,
    '{{days_inactive}}': context.healthScore.days_since_last_activity || 'unknown',
    '{{sentiment_change}}': context.healthScore.sentiment_trend === 'declining' ? '20' : '10',
    '{{current_sentiment}}': context.healthScore.avg_sentiment_last_3_meetings
      ? (context.healthScore.avg_sentiment_last_3_meetings * 100).toFixed(0)
      : 'unknown',
    '{{meeting_count}}': context.healthScore.meeting_count_last_30_days,
    '{{avg_response_hours}}': context.healthScore.avg_response_time_hours || 'unknown',
    '{{days_until_close}}': context.expectedCloseDate
      ? Math.ceil((new Date(context.expectedCloseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 'unknown',
    '{{company}}': context.deal.company || 'Unknown Company',
  };

  for (const [key, value] of Object.entries(replacements)) {
    rendered = rendered.replace(new RegExp(key, 'g'), String(value));
  }

  return rendered;
}

// =====================================================
// Rule Evaluation
// =====================================================

/**
 * Evaluate if a rule's conditions match the deal context
 */
function evaluateRuleConditions(
  rule: DealHealthRule,
  context: AlertGenerationContext
): boolean {
  if (!rule.conditions) return true;

  const conditions = rule.conditions;

  // Check stage condition
  if (conditions.stage && context.stageName !== conditions.stage) {
    return false;
  }

  // Check deal value condition
  if (conditions.deal_value_min && context.dealValue < conditions.deal_value_min) {
    return false;
  }

  if (conditions.deal_value_max && context.dealValue > conditions.deal_value_max) {
    return false;
  }

  // Check if deal has expected close date
  if (conditions.has_close_date && !context.expectedCloseDate) {
    return false;
  }

  return true;
}

/**
 * Evaluate threshold against value
 */
function evaluateThreshold(
  value: number,
  operator: string,
  threshold: number
): boolean {
  switch (operator) {
    case '>':
      return value > threshold;
    case '<':
      return value < threshold;
    case '>=':
      return value >= threshold;
    case '<=':
      return value <= threshold;
    case '=':
      return value === threshold;
    default:
      return false;
  }
}

/**
 * Evaluate rule and return alert data if triggered
 */
function evaluateRule(
  rule: DealHealthRule,
  context: AlertGenerationContext
): Partial<DealHealthAlert> | null {
  // Check if rule conditions match
  if (!evaluateRuleConditions(rule, context)) {
    return null;
  }

  let triggered = false;
  let alertType: DealHealthAlert['alert_type'] = 'high_risk';

  // Evaluate based on rule type
  switch (rule.rule_type) {
    case 'stage_velocity':
      if (rule.threshold_unit === 'days') {
        triggered = evaluateThreshold(
          context.healthScore.days_in_current_stage,
          rule.threshold_operator,
          rule.threshold_value
        );
        alertType = 'stage_stall';
      } else if (rule.threshold_unit === 'days_until_close' && context.expectedCloseDate) {
        const daysUntilClose = Math.ceil(
          (new Date(context.expectedCloseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        triggered = evaluateThreshold(
          daysUntilClose,
          rule.threshold_operator,
          rule.threshold_value
        );
        alertType = 'close_date_approaching';
      }
      break;

    case 'sentiment':
      if (context.healthScore.sentiment_trend === 'declining') {
        triggered = true;
        alertType = 'sentiment_drop';
      }
      break;

    case 'engagement':
      if (rule.threshold_unit === 'meetings_per_month') {
        triggered = evaluateThreshold(
          context.healthScore.meeting_count_last_30_days,
          rule.threshold_operator,
          rule.threshold_value
        );
        alertType = 'engagement_decline';
      }
      break;

    case 'activity':
      if (rule.threshold_unit === 'days' && context.healthScore.days_since_last_activity !== null) {
        triggered = evaluateThreshold(
          context.healthScore.days_since_last_activity,
          rule.threshold_operator,
          rule.threshold_value
        );
        alertType = 'no_activity';
      }
      break;

    case 'response_time':
      if (rule.threshold_unit === 'hours' && context.healthScore.avg_response_time_hours !== null) {
        triggered = evaluateThreshold(
          context.healthScore.avg_response_time_hours,
          rule.threshold_operator,
          rule.threshold_value
        );
        alertType = 'missed_follow_up';
      }
      break;
  }

  if (!triggered) return null;

  // Generate alert data
  const title = renderTemplate(rule.alert_message_template || 'Deal Alert', context);
  const message = renderTemplate(
    rule.alert_message_template || 'This deal requires your attention.',
    context
  );

  const suggestedAction = rule.suggested_action_template
    ? renderTemplate(rule.suggested_action_template, context)
    : 'Review deal and take appropriate action.';

  return {
    alert_type: alertType,
    severity: rule.alert_severity,
    title,
    message,
    suggested_actions: [suggestedAction],
    action_priority: rule.alert_severity === 'critical' ? 'urgent' : 'medium',
  };
}

// =====================================================
// Alert Generation Functions
// =====================================================

/**
 * Generate alerts for a specific deal based on health score
 */
export async function generateAlertsForDeal(
  dealId: string,
  healthScore: DealHealthScore
): Promise<DealHealthAlert[]> {
  try {
    console.log(`[DealHealthAlert] Generating alerts for deal ${dealId}`);

    // Get deal details
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select(`
        *,
        deal_stages!inner(name)
      `)
      .eq('id', dealId)
      .single();

    if (dealError || !deal) {
      console.error('[DealHealthAlert] Error fetching deal:', dealError);
      return [];
    }

    // Get active rules
    const { data: rules, error: rulesError } = await supabase
      .from('deal_health_rules')
      .select('*')
      .eq('is_active', true)
      .order('rule_type');

    if (rulesError || !rules) {
      console.error('[DealHealthAlert] Error fetching rules:', rulesError);
      return [];
    }

    // Build context
    const context: AlertGenerationContext = {
      deal,
      healthScore,
      stageName: deal.deal_stages.name,
      dealValue: deal.value || 0,
      expectedCloseDate: deal.expected_close_date,
    };

    // Evaluate each rule
    const generatedAlerts: DealHealthAlert[] = [];
    const alertsToInsert: any[] = [];

    for (const rule of rules) {
      const alertData = evaluateRule(rule, context);

      if (alertData) {
        // Check if alert already exists and is active
        const { data: existingAlert } = await supabase
          .from('deal_health_alerts')
          .select('id')
          .eq('deal_id', dealId)
          .eq('alert_type', alertData.alert_type!)
          .eq('status', 'active')
          .maybeSingle();

        if (existingAlert) {
          console.log(`[DealHealthAlert] Alert already exists for ${alertData.alert_type}, skipping`);
          continue;
        }

        // Prepare alert for insertion
        alertsToInsert.push({
          deal_id: dealId,
          health_score_id: healthScore.id,
          user_id: deal.owner_id,
          ...alertData,
          status: 'active',
          metadata: {
            rule_id: rule.id,
            rule_name: rule.rule_name,
            health_score: healthScore.overall_health_score,
            risk_level: healthScore.risk_level,
          },
        });
      }
    }

    // Insert all generated alerts
    if (alertsToInsert.length > 0) {
      const { data: insertedAlerts, error: insertError } = await supabase
        .from('deal_health_alerts')
        .insert(alertsToInsert)
        .select();

      if (insertError) {
        console.error('[DealHealthAlert] Error inserting alerts:', insertError);
        return [];
      }

      generatedAlerts.push(...(insertedAlerts || []));

      // Send notifications for each alert
      for (const alert of insertedAlerts || []) {
        await sendAlertNotification(alert);
      }

      console.log(`[DealHealthAlert] Generated ${generatedAlerts.length} alerts for deal ${dealId}`);
    }

    return generatedAlerts;
  } catch (error) {
    console.error('[DealHealthAlert] Exception generating alerts:', error);
    return [];
  }
}

/**
 * Send notification for an alert
 */
async function sendAlertNotification(alert: DealHealthAlert): Promise<void> {
  try {
    // Get deal name for notification
    const { data: deal } = await supabase
      .from('deals')
      .select('name')
      .eq('id', alert.deal_id)
      .single();

    const dealName = deal?.name || 'Deal';

    // Create notification
    const notification = await notificationService.create({
      user_id: alert.user_id,
      title: alert.title,
      message: alert.message,
      type: alert.severity === 'critical' ? 'error' : alert.severity === 'warning' ? 'warning' : 'info',
      category: 'deal',
      entity_type: 'deal',
      entity_id: alert.deal_id,
      action_url: `/crm?deal=${alert.deal_id}`,
      metadata: {
        alert_id: alert.id,
        alert_type: alert.alert_type,
        suggested_actions: alert.suggested_actions,
      },
    });

    if (notification) {
      // Update alert with notification info
      await supabase
        .from('deal_health_alerts')
        .update({
          notification_id: notification.id,
          notification_sent: true,
          notification_sent_at: new Date().toISOString(),
        })
        .eq('id', alert.id);

      console.log(`[DealHealthAlert] Notification sent for alert ${alert.id}`);
    }
  } catch (error) {
    console.error('[DealHealthAlert] Error sending notification:', error);
  }
}

/**
 * Generate alerts for all deals with health scores
 */
export async function generateAlertsForAllDeals(userId: string): Promise<number> {
  try {
    console.log(`[DealHealthAlert] Generating alerts for all deals (user: ${userId})`);

    // Get all health scores for user
    const { data: healthScores, error } = await supabase
      .from('deal_health_scores')
      .select('*')
      .eq('user_id', userId);

    if (error || !healthScores) {
      console.error('[DealHealthAlert] Error fetching health scores:', error);
      return 0;
    }

    let totalAlerts = 0;

    // Generate alerts for each deal
    for (const healthScore of healthScores) {
      const alerts = await generateAlertsForDeal(healthScore.deal_id, healthScore);
      totalAlerts += alerts.length;
    }

    console.log(`[DealHealthAlert] Generated ${totalAlerts} total alerts`);
    return totalAlerts;
  } catch (error) {
    console.error('[DealHealthAlert] Exception generating alerts:', error);
    return 0;
  }
}

// =====================================================
// Alert Management Functions
// =====================================================

/**
 * Get active alerts for user
 */
export async function getActiveAlerts(userId: string): Promise<DealHealthAlert[]> {
  try {
    const { data, error } = await supabase
      .from('deal_health_alerts')
      .select(`
        *,
        deals!inner(name, company, deal_stages!inner(name))
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('severity', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[DealHealthAlert] Error fetching alerts:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[DealHealthAlert] Exception fetching alerts:', error);
    return [];
  }
}

/**
 * Get alerts for a specific deal
 */
export async function getDealAlerts(dealId: string): Promise<DealHealthAlert[]> {
  try {
    const { data, error } = await supabase
      .from('deal_health_alerts')
      .select('*')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[DealHealthAlert] Error fetching deal alerts:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[DealHealthAlert] Exception fetching deal alerts:', error);
    return [];
  }
}

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(alertId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('deal_health_alerts')
      .update({
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: userId,
      })
      .eq('id', alertId);

    if (error) {
      console.error('[DealHealthAlert] Error acknowledging alert:', error);
      return false;
    }

    console.log(`[DealHealthAlert] Alert ${alertId} acknowledged`);
    return true;
  } catch (error) {
    console.error('[DealHealthAlert] Exception acknowledging alert:', error);
    return false;
  }
}

/**
 * Resolve an alert
 */
export async function resolveAlert(alertId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('deal_health_alerts')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
      })
      .eq('id', alertId);

    if (error) {
      console.error('[DealHealthAlert] Error resolving alert:', error);
      return false;
    }

    console.log(`[DealHealthAlert] Alert ${alertId} resolved`);
    return true;
  } catch (error) {
    console.error('[DealHealthAlert] Exception resolving alert:', error);
    return false;
  }
}

/**
 * Dismiss an alert
 */
export async function dismissAlert(alertId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('deal_health_alerts')
      .update({
        status: 'dismissed',
        dismissed_at: new Date().toISOString(),
      })
      .eq('id', alertId);

    if (error) {
      console.error('[DealHealthAlert] Error dismissing alert:', error);
      return false;
    }

    console.log(`[DealHealthAlert] Alert ${alertId} dismissed`);
    return true;
  } catch (error) {
    console.error('[DealHealthAlert] Exception dismissing alert:', error);
    return false;
  }
}

/**
 * Get alert summary statistics
 */
export async function getAlertStats(userId: string): Promise<{
  total: number;
  critical: number;
  warning: number;
  info: number;
  byType: Record<string, number>;
}> {
  try {
    const { data: alerts } = await supabase
      .from('deal_health_alerts')
      .select('alert_type, severity')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (!alerts) {
      return { total: 0, critical: 0, warning: 0, info: 0, byType: {} };
    }

    const stats = {
      total: alerts.length,
      critical: alerts.filter((a) => a.severity === 'critical').length,
      warning: alerts.filter((a) => a.severity === 'warning').length,
      info: alerts.filter((a) => a.severity === 'info').length,
      byType: {} as Record<string, number>,
    };

    // Count by type
    alerts.forEach((alert) => {
      stats.byType[alert.alert_type] = (stats.byType[alert.alert_type] || 0) + 1;
    });

    return stats;
  } catch (error) {
    console.error('[DealHealthAlert] Exception getting alert stats:', error);
    return { total: 0, critical: 0, warning: 0, info: 0, byType: {} };
  }
}
