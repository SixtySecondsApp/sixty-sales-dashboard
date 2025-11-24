/**
 * Sentiment and Relationship Strength Badges
 *
 * Visual indicators for prospect sentiment and relationship strength
 * displayed in health monitoring dashboards.
 */

import React from 'react';

// =====================================================
// SentimentBadge Component
// =====================================================

interface SentimentBadgeProps {
  sentimentScore: number | null;
  sentimentTrend?: 'improving' | 'stable' | 'declining' | 'unknown';
  size?: 'sm' | 'default';
}

export function SentimentBadge({ 
  sentimentScore, 
  sentimentTrend = 'unknown',
  size = 'default' 
}: SentimentBadgeProps) {
  // Determine sentiment status
  let status: 'positive' | 'neutral' | 'negative';
  let label: string;

  // Handle null/undefined values
  const score = sentimentScore ?? null;
  const trend = sentimentTrend ?? 'unknown';

  if (trend === 'declining' || (score !== null && score < 40)) {
    status = 'negative';
    label = 'Negative';
  } else if (score !== null && score >= 70) {
    status = 'positive';
    label = 'Positive';
  } else if (trend === 'improving') {
    status = 'positive';
    label = 'Positive';
  } else if (score !== null && score >= 40 && trend !== 'declining') {
    status = 'neutral';
    label = 'Neutral';
  } else {
    status = 'neutral';
    label = 'Neutral';
  }

  const sizeClasses = size === 'sm' 
    ? 'px-1.5 py-0.5 text-[10px]' 
    : 'px-2 py-1 text-xs';

  const colorClasses = {
    positive: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
    neutral: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-800',
    negative: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  };

  return (
    <span
      className={`inline-flex items-center rounded border font-medium ${sizeClasses} ${colorClasses[status]}`}
      title={`Sentiment: ${label} (Score: ${score !== null ? score : 'N/A'}, Trend: ${trend})`}
    >
      {label}
    </span>
  );
}

// =====================================================
// RelationshipStrengthBadge Component
// =====================================================

interface RelationshipStrengthBadgeProps {
  engagementScore: number | null;
  communicationScore: number | null;
  daysSinceLastContact: number | null;
  size?: 'sm' | 'default';
}

export function RelationshipStrengthBadge({
  engagementScore,
  communicationScore,
  daysSinceLastContact,
  size = 'default',
}: RelationshipStrengthBadgeProps) {
  // Determine relationship strength
  let status: 'strong' | 'moderate' | 'weak' | 'not_contacted';
  let label: string;

  // Handle null/undefined values
  const engagement = engagementScore ?? null;
  const communication = communicationScore ?? null;
  const daysSince = daysSinceLastContact ?? null;

  // Check if not contacted
  if (daysSince === null || daysSince > 90) {
    status = 'not_contacted';
    label = 'Not Contacted';
  } else {
    // Strong: high engagement AND high communication AND recent contact
    if (
      (engagement !== null && engagement >= 70) &&
      (communication !== null && communication >= 70) &&
      daysSince < 7
    ) {
      status = 'strong';
      label = 'Strong';
    }
    // Moderate: decent engagement OR communication AND recent enough contact
    else if (
      ((engagement !== null && engagement >= 40) ||
       (communication !== null && communication >= 40)) &&
      daysSince < 30
    ) {
      status = 'moderate';
      label = 'Moderate';
    }
    // Weak: low engagement AND low communication
    else if (
      (engagement === null || engagement < 40) &&
      (communication === null || communication < 40)
    ) {
      status = 'weak';
      label = 'Weak';
    }
    // Default to moderate if we have some data but don't meet other criteria
    else {
      status = 'moderate';
      label = 'Moderate';
    }
  }

  const sizeClasses = size === 'sm' 
    ? 'px-1.5 py-0.5 text-[10px]' 
    : 'px-2 py-1 text-xs';

  const colorClasses = {
    strong: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
    moderate: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
    weak: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
    not_contacted: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-800',
  };

  const tooltip = `Relationship: ${label} (Engagement: ${engagement !== null ? engagement : 'N/A'}, Communication: ${communication !== null ? communication : 'N/A'}, Last contact: ${daysSince !== null ? `${daysSince} days ago` : 'Never'})`;

  return (
    <span
      className={`inline-flex items-center rounded border font-medium ${sizeClasses} ${colorClasses[status]}`}
      title={tooltip}
    >
      {label}
    </span>
  );
}

