/**
 * Shared types for the Smart Engagement Algorithm
 */

export interface UserMetrics {
  id: string;
  user_id: string;
  org_id: string;
  last_app_active_at: string | null;
  last_slack_active_at: string | null;
  last_notification_clicked_at: string | null;
  last_login_at: string | null;
  preferred_notification_frequency: NotificationFrequency;
  last_feedback_requested_at: string | null;
  notifications_since_last_feedback: number;
  // Computed fields
  app_engagement_score?: number;
  slack_engagement_score?: number;
  notification_engagement_score?: number;
  overall_engagement_score?: number;
  user_segment?: UserSegment;
  typical_active_hours?: Record<number, number[]>;
  peak_activity_hour?: number | null;
  avg_daily_sessions?: number;
  notification_fatigue_level?: number;
}

export interface ComputedScores {
  app_engagement_score: number;
  slack_engagement_score: number;
  notification_engagement_score: number;
  overall_engagement_score: number;
  user_segment: UserSegment;
  typical_active_hours: Record<number, number[]>;
  peak_activity_hour: number | null;
  avg_daily_sessions: number;
  notification_fatigue_level: number;
  should_request_feedback: boolean;
}

export type UserSegment =
  | "power_user"
  | "regular"
  | "casual"
  | "at_risk"
  | "dormant"
  | "churned";

export type NotificationFrequency = "high" | "moderate" | "low";

export type NotificationPriority = "urgent" | "high" | "normal" | "low";

export type NotificationChannel = "slack_dm" | "slack_channel" | "email" | "in_app";

export interface ActivityEvent {
  event_type: string;
  event_source: "app" | "slack";
  event_at: string;
  day_of_week: number;
  hour_of_day: number;
  session_id?: string;
}

export interface NotificationInteraction {
  delivered_at: string;
  clicked_at: string | null;
  dismissed_at: string | null;
  time_to_interaction_seconds: number | null;
  hour_of_day: number;
  day_of_week: number;
}

export interface QueuedNotification {
  id: string;
  user_id: string;
  org_id: string;
  notification_type: string;
  channel: NotificationChannel;
  priority: NotificationPriority;
  payload: Record<string, unknown>;
  scheduled_for: string;
  optimal_send_time: string | null;
  created_at: string;
  status: "pending" | "scheduled" | "sent" | "failed" | "cancelled";
  attempts: number;
  last_attempt_at: string | null;
  error_message: string | null;
  // Metadata
  related_entity_type?: string;
  related_entity_id?: string;
  dedupe_key?: string;
}

export interface SendTimeWindow {
  start_hour: number;
  end_hour: number;
  score: number; // 0-100 confidence score
}

export interface FrequencyLimitResult {
  allowed: boolean;
  reason?: string;
  next_allowed_at?: string;
  current_count: {
    hour: number;
    day: number;
  };
  limits: {
    max_per_hour: number;
    max_per_day: number;
  };
}

export interface OptimalSendTimeResult {
  recommended_time: string;
  confidence: number;
  factors: {
    peak_activity_alignment: number;
    historical_engagement: number;
    fatigue_adjustment: number;
    priority_boost: number;
  };
  alternative_times: string[];
}
