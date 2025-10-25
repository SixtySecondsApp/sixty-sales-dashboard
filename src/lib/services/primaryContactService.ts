import { supabase } from '../supabase';

/**
 * Primary Contact Selection Service
 * Implements smart logic to determine the primary contact for a meeting
 */

export interface Contact {
  id: string;
  name: string;
  email: string;
  company_id: string | null;
  title: string | null;
  total_meetings_count: number;
}

export interface ContactScore {
  contact: Contact;
  score: number;
  reasons: string[];
}

// Job title keywords indicating seniority (weighted by importance)
const SENIORITY_KEYWORDS = {
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

/**
 * Calculate seniority score from job title
 * @param title - Job title (can be null)
 * @returns Seniority score (0-100)
 */
function calculateSeniorityScore(title: string | null): number {
  if (!title) return 0;

  const titleUpper = title.toUpperCase();
  let maxScore = 0;

  // Check for each keyword
  for (const [keyword, score] of Object.entries(SENIORITY_KEYWORDS)) {
    if (titleUpper.includes(keyword.toUpperCase())) {
      maxScore = Math.max(maxScore, score);
    }
  }

  return maxScore;
}

/**
 * Determine primary contact from a list of contacts
 * Uses weighted scoring based on:
 * 1. Meeting history (40% weight)
 * 2. Seniority/title (30% weight)
 * 3. Company majority (20% weight)
 * 4. Email domain quality (10% weight)
 *
 * @param contactIds - Array of contact IDs to evaluate
 * @param userId - User ID for filtering
 * @returns Primary contact ID or null
 */
export async function selectPrimaryContact(
  contactIds: string[],
  userId: string
): Promise<string | null> {
  if (!contactIds || contactIds.length === 0) {
    return null;
  }

  if (contactIds.length === 1) {
    return contactIds[0];
  }

  // Fetch all contacts with their data
  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('id, name, email, company_id, title, total_meetings_count')
    .in('id', contactIds)
    .eq('user_id', userId);

  if (error || !contacts || contacts.length === 0) {
    console.error('Error fetching contacts for primary selection:', error);
    return contactIds[0]; // Fallback to first contact
  }

  // Calculate scores for each contact
  const scores: ContactScore[] = contacts.map(contact => {
    const score = 0;
    const reasons: string[] = [];

    return {
      contact,
      score,
      reasons,
    };
  });

  // 1. Meeting History Score (40% weight)
  const maxMeetings = Math.max(...contacts.map(c => c.total_meetings_count || 0));
  if (maxMeetings > 0) {
    scores.forEach(item => {
      const meetingScore = ((item.contact.total_meetings_count || 0) / maxMeetings) * 40;
      item.score += meetingScore;
      if (item.contact.total_meetings_count > 0) {
        item.reasons.push(
          `${item.contact.total_meetings_count} previous meeting${item.contact.total_meetings_count > 1 ? 's' : ''}`
        );
      }
    });
  }

  // 2. Seniority Score (30% weight)
  scores.forEach(item => {
    const seniorityScore = (calculateSeniorityScore(item.contact.title) / 100) * 30;
    item.score += seniorityScore;
    if (seniorityScore > 5) {
      item.reasons.push(`Senior title: ${item.contact.title}`);
    }
  });

  // 3. Company Majority Score (20% weight)
  const companyCount = new Map<string, number>();
  contacts.forEach(contact => {
    if (contact.company_id) {
      const count = companyCount.get(contact.company_id) || 0;
      companyCount.set(contact.company_id, count + 1);
    }
  });

  const maxCompanyCount = Math.max(...Array.from(companyCount.values()), 0);
  if (maxCompanyCount > 1) {
    scores.forEach(item => {
      if (item.contact.company_id) {
        const count = companyCount.get(item.contact.company_id) || 0;
        if (count === maxCompanyCount) {
          item.score += 20;
          item.reasons.push(`Majority company (${count} attendees)`);
        }
      }
    });
  }

  // 4. Email Domain Quality Score (10% weight)
  // Prefer corporate emails over generic business emails
  scores.forEach(item => {
    const email = item.contact.email.toLowerCase();
    if (email.includes('@')) {
      const domain = email.split('@')[1];

      // Penalize common business email providers
      const genericProviders = ['zoho.com', 'mail.com', 'fastmail.com'];
      const isGeneric = genericProviders.some(provider => domain.includes(provider));

      if (!isGeneric) {
        item.score += 10;
        item.reasons.push('Corporate email domain');
      }
    }
  });

  // Sort by score (highest first)
  scores.sort((a, b) => b.score - a.score);

  const winner = scores[0];

  console.log('Primary contact selection:', {
    winner: {
      name: winner.contact.name,
      email: winner.contact.email,
      score: winner.score.toFixed(2),
      reasons: winner.reasons,
    },
    allScores: scores.map(s => ({
      name: s.contact.name,
      score: s.score.toFixed(2),
      reasons: s.reasons,
    })),
  });

  return winner.contact.id;
}

/**
 * Determine company for a meeting based on primary contact or attendee majority
 * @param contactIds - Array of contact IDs attending the meeting
 * @param primaryContactId - ID of primary contact (optional)
 * @param userId - User ID for filtering
 * @returns Company ID or null
 */
export async function determineMeetingCompany(
  contactIds: string[],
  primaryContactId: string | null,
  userId: string
): Promise<string | null> {
  if (!contactIds || contactIds.length === 0) {
    return null;
  }

  // If we have a primary contact, use their company
  if (primaryContactId) {
    const { data: primaryContact } = await supabase
      .from('contacts')
      .select('company_id')
      .eq('id', primaryContactId)
      .eq('user_id', userId)
      .single();

    if (primaryContact?.company_id) {
      return primaryContact.company_id;
    }
  }

  // Otherwise, find the company with the most attendees
  const { data: contacts } = await supabase
    .from('contacts')
    .select('company_id')
    .in('id', contactIds)
    .eq('user_id', userId);

  if (!contacts || contacts.length === 0) {
    return null;
  }

  // Count contacts per company
  const companyCount = new Map<string, number>();
  contacts.forEach(contact => {
    if (contact.company_id) {
      const count = companyCount.get(contact.company_id) || 0;
      companyCount.set(contact.company_id, count + 1);
    }
  });

  if (companyCount.size === 0) {
    return null;
  }

  // Return company with most attendees
  let maxCompanyId: string | null = null;
  let maxCount = 0;

  companyCount.forEach((count, companyId) => {
    if (count > maxCount) {
      maxCount = count;
      maxCompanyId = companyId;
    }
  });

  return maxCompanyId;
}
