/**
 * Contact Quality Scoring Utility
 *
 * Calculates quality scores for contacts based on:
 * - Meeting history (40%)
 * - Seniority/title (30%)
 * - Profile completeness (20%)
 * - Email domain quality (10%)
 */

// Job title keywords indicating seniority (from primaryContactService.ts)
const SENIORITY_KEYWORDS: Record<string, number> = {
  // C-Level executives (highest priority)
  CEO: 100,
  'Chief Executive': 100,
  Founder: 95,
  'Co-Founder': 95,
  President: 90,
  CFO: 90,
  'Chief Financial': 90,
  COO: 90,
  'Chief Operating': 90,
  CTO: 90,
  'Chief Technology': 90,
  CMO: 85,
  'Chief Marketing': 85,
  CRO: 85,
  'Chief Revenue': 85,

  // VP Level
  VP: 70,
  'Vice President': 70,
  EVP: 75,
  'Executive Vice President': 75,
  SVP: 75,
  'Senior Vice President': 75,

  // Director Level
  Director: 50,
  'Managing Director': 60,
  'Executive Director': 55,

  // Manager Level
  Manager: 30,
  'Senior Manager': 35,
  Lead: 25,
  'Team Lead': 25,

  // Individual Contributors
  Senior: 15,
  Principal: 20,
  Staff: 10,
};

// Generic email domains to penalize
const GENERIC_EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'aol.com',
  'icloud.com',
  'mail.com',
  'zoho.com',
  'fastmail.com',
  'protonmail.com',
];

export type ContactQualityTier = 'good' | 'average' | 'bad';

export interface ContactQualityScore {
  tier: ContactQualityTier;
  score: number; // 0-100
  breakdown: {
    meetingsScore: number;    // 0-40
    seniorityScore: number;   // 0-30
    profileScore: number;     // 0-20
    domainScore: number;      // 0-10
  };
  reasons: string[];
}

export interface ContactForScoring {
  email: string;
  title?: string | null;
  company_id?: string | null;
  linkedin_url?: string | null;
  total_meetings_count?: number | null;
  phone?: string | null;
}

/**
 * Calculate seniority score from job title
 */
export function calculateSeniorityScore(title: string | null | undefined): number {
  if (!title) return 0;

  const titleUpper = title.toUpperCase();
  let maxScore = 0;

  for (const [keyword, score] of Object.entries(SENIORITY_KEYWORDS)) {
    if (titleUpper.includes(keyword.toUpperCase())) {
      maxScore = Math.max(maxScore, score);
    }
  }

  return maxScore;
}

/**
 * Check if email domain is generic (personal provider)
 */
export function isGenericEmailDomain(email: string): boolean {
  if (!email || !email.includes('@')) return true;

  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return true;

  return GENERIC_EMAIL_DOMAINS.some(generic => domain === generic);
}

/**
 * Calculate comprehensive quality score for a contact
 */
export function calculateContactQualityScore(
  contact: ContactForScoring,
  maxMeetingsInSet: number = 10
): ContactQualityScore {
  const reasons: string[] = [];
  const breakdown = {
    meetingsScore: 0,
    seniorityScore: 0,
    profileScore: 0,
    domainScore: 0,
  };

  // 1. Meeting History Score (40% weight)
  const meetingCount = contact.total_meetings_count || 0;
  if (maxMeetingsInSet > 0 && meetingCount > 0) {
    breakdown.meetingsScore = Math.min(40, (meetingCount / maxMeetingsInSet) * 40);
    reasons.push(`${meetingCount} meeting${meetingCount > 1 ? 's' : ''}`);
  }

  // 2. Seniority Score (30% weight)
  const rawSeniority = calculateSeniorityScore(contact.title);
  breakdown.seniorityScore = (rawSeniority / 100) * 30;
  if (rawSeniority >= 50) {
    reasons.push(`Senior: ${contact.title}`);
  } else if (rawSeniority >= 25) {
    reasons.push(`Mid-level: ${contact.title}`);
  } else if (!contact.title) {
    reasons.push('No title');
  }

  // 3. Profile Completeness Score (20% weight)
  let profilePoints = 0;
  if (contact.company_id) {
    profilePoints += 10;
    reasons.push('Has company');
  } else {
    reasons.push('No company');
  }
  if (contact.linkedin_url) {
    profilePoints += 5;
  }
  if (contact.phone) {
    profilePoints += 5;
  }
  breakdown.profileScore = profilePoints;

  // 4. Email Domain Quality Score (10% weight)
  if (contact.email && !isGenericEmailDomain(contact.email)) {
    breakdown.domainScore = 10;
    reasons.push('Corporate email');
  } else {
    reasons.push('Generic email');
  }

  // Calculate total score
  const score = Math.round(
    breakdown.meetingsScore +
    breakdown.seniorityScore +
    breakdown.profileScore +
    breakdown.domainScore
  );

  // Determine tier
  let tier: ContactQualityTier;
  if (score >= 50) {
    tier = 'good';
  } else if (score >= 25) {
    tier = 'average';
  } else {
    tier = 'bad';
  }

  return {
    tier,
    score,
    breakdown,
    reasons,
  };
}

/**
 * Get tier thresholds for contact queries
 */
export const QUALITY_THRESHOLDS = {
  good: {
    minMeetings: 4,
    requiresTitle: true,
    requiresCompany: true,
  },
  average: {
    minMeetings: 1,
    maxMeetings: 3,
  },
  bad: {
    maxMeetings: 0,
  },
} as const;

/**
 * Get tier color classes for UI
 */
export function getTierColorClasses(tier: ContactQualityTier): {
  bg: string;
  text: string;
  border: string;
  badge: string;
} {
  switch (tier) {
    case 'good':
      return {
        bg: 'bg-emerald-500',
        text: 'text-emerald-600 dark:text-emerald-400',
        border: 'border-emerald-200 dark:border-emerald-800',
        badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      };
    case 'average':
      return {
        bg: 'bg-amber-500',
        text: 'text-amber-600 dark:text-amber-400',
        border: 'border-amber-200 dark:border-amber-800',
        badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      };
    case 'bad':
      return {
        bg: 'bg-red-500',
        text: 'text-red-600 dark:text-red-400',
        border: 'border-red-200 dark:border-red-800',
        badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      };
  }
}
