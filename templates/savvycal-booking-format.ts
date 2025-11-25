/**
 * SavvyCal Booking Format Template
 *
 * This template documents the data structure for SavvyCal bookings
 * used by our organization. Use this as a reference when:
 * - Importing bookings from other scheduling platforms
 * - Creating manual booking imports
 * - Building integrations with other calendar systems
 *
 * Organization: Sixty Seconds
 * Last Updated: 2025-11-25
 */

/**
 * Raw SavvyCal Booking structure from CSV export
 */
export interface SavvyCalBooking {
  // Identifiers
  id: string;                      // Unique booking ID
  link_id: string;                 // Booking link identifier
  poll_id: string;                 // Poll ID (for group scheduling)

  // State
  state: 'confirmed' | 'canceled' | 'pending';

  // Meeting details
  summary: string;                 // Meeting title/summary
  description: string;             // Meeting description
  start_at: string;                // ISO 8601 datetime
  end_at: string;                  // ISO 8601 datetime
  created_at: string;              // ISO 8601 datetime
  location: string;                // Meeting location/URL
  url: string;                     // SavvyCal booking URL

  // Organizer (internal team member)
  organizer_display_name: string;  // Team member's name
  organizer_email: string;         // Team member's email

  // Scheduler (external contact/lead)
  scheduler_display_name: string;  // Contact's full name
  scheduler_email: string;         // Contact's email
  scheduler_phone_number: string;  // Contact's phone (optional)

  // UTM Tracking
  utm_source: string;              // Traffic source
  utm_medium: string;              // Traffic medium
  utm_campaign: string;            // Campaign name
  utm_term: string;                // Search term
  utm_content: string;             // Content variant

  // Custom Questions (Q&A from booking form)
  question_1: string;
  answer_1: string;
  question_2: string;
  answer_2: string;
}

/**
 * Lead data structure for importing bookings into leads table
 */
export interface BookingLeadData {
  // External source tracking
  external_source: 'savvycal' | 'calendly' | 'hubspot' | string;
  external_id: string;
  external_occured_at: string | null;

  // Booking link info
  booking_link_id: string | null;
  booking_link_slug: string | null;

  // Status
  status: 'new' | 'contacted' | 'qualified' | 'archived';
  priority: 'low' | 'normal' | 'high' | 'urgent';

  // Owner
  owner_id: string;           // UUID of team member
  created_by: string;         // UUID of creator

  // Contact information
  contact_name: string;       // Full name
  contact_first_name: string;
  contact_last_name: string | null;
  contact_email: string;
  contact_phone: string | null;
  scheduler_email: string;    // Organizer's email
  scheduler_name: string;     // Organizer's name

  // Domain (extracted from email)
  domain: string;

  // Meeting details
  meeting_title: string;
  meeting_description: string | null;
  meeting_start: string | null;       // ISO 8601
  meeting_end: string | null;         // ISO 8601
  meeting_duration_minutes: number;
  meeting_url: string | null;
  conferencing_url: string | null;

  // UTM tracking
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;

  // Custom metadata
  metadata: {
    question_1: string | null;
    answer_1: string | null;
    question_2: string | null;
    answer_2: string | null;
    [key: string]: any;
  };

  // Timestamps
  first_seen_at: string;      // ISO 8601
}

/**
 * Helper functions for processing booking data
 */

/**
 * Split full name into first and last name
 */
export function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(' ').filter(p => p);
  if (parts.length === 0) return { firstName: 'Unknown', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/**
 * Clean phone number (remove leading + and whitespace)
 */
export function cleanPhone(phone: string): string {
  if (!phone) return '';
  return phone.replace(/^[\+\s]+/, '').trim();
}

/**
 * Extract domain from email address
 */
export function extractDomain(email: string): string {
  if (!email) return '';
  const parts = email.split('@');
  return parts[1] || '';
}

/**
 * Calculate meeting duration in minutes
 */
export function calculateDuration(startAt: string, endAt: string): number {
  if (!startAt || !endAt) return 30; // default 30 minutes
  const start = new Date(startAt);
  const end = new Date(endAt);
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

/**
 * Transform SavvyCal booking to lead data format
 */
export function transformBookingToLead(
  booking: SavvyCalBooking,
  ownerId: string
): BookingLeadData {
  const { firstName, lastName } = splitName(booking.scheduler_display_name);

  return {
    external_source: 'savvycal',
    external_id: booking.id,
    external_occured_at: booking.created_at || null,

    booking_link_id: booking.link_id || null,
    booking_link_slug: booking.link_id || null,

    status: booking.state === 'canceled' ? 'archived' : 'new',
    priority: 'normal',

    owner_id: ownerId,
    created_by: ownerId,

    contact_name: booking.scheduler_display_name,
    contact_first_name: firstName,
    contact_last_name: lastName || null,
    contact_email: booking.scheduler_email,
    contact_phone: cleanPhone(booking.scheduler_phone_number) || null,
    scheduler_email: booking.organizer_email,
    scheduler_name: booking.organizer_display_name,

    domain: extractDomain(booking.scheduler_email),

    meeting_title: booking.summary || 'SavvyCal Meeting',
    meeting_description: booking.description || null,
    meeting_start: booking.start_at || null,
    meeting_end: booking.end_at || null,
    meeting_duration_minutes: calculateDuration(booking.start_at, booking.end_at),
    meeting_url: booking.url || null,
    conferencing_url: booking.location || null,

    utm_source: booking.utm_source || null,
    utm_medium: booking.utm_medium || null,
    utm_campaign: booking.utm_campaign || null,
    utm_term: booking.utm_term || null,
    utm_content: booking.utm_content || null,

    metadata: {
      question_1: booking.question_1 || null,
      answer_1: booking.answer_1 || null,
      question_2: booking.question_2 || null,
      answer_2: booking.answer_2 || null,
    },

    first_seen_at: booking.created_at || new Date().toISOString(),
  };
}

/**
 * CSV column headers expected in SavvyCal export
 */
export const SAVVYCAL_CSV_HEADERS = [
  'id',
  'link_id',
  'poll_id',
  'state',
  'summary',
  'description',
  'start_at',
  'end_at',
  'created_at',
  'location',
  'organizer_display_name',
  'organizer_email',
  'scheduler_display_name',
  'scheduler_email',
  'scheduler_phone_number',
  'url',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'question_1',
  'answer_1',
  'question_2',
  'answer_2',
] as const;
