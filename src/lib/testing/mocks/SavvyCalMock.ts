/**
 * SavvyCal Integration Mock
 *
 * Provides realistic mock data and API responses for testing
 * SavvyCal scheduling integration workflows.
 */

import type { ProcessMapMock, MockType } from '@/lib/types/processMapTesting';

// ============================================================================
// Mock Data Types
// ============================================================================

export interface MockSavvyCalLink {
  id: string;
  slug: string;
  name: string;
  description?: string;
  duration_minutes: number;
  location_type: 'google_meet' | 'zoom' | 'phone' | 'in_person' | 'custom';
  is_active: boolean;
  booking_url: string;
  created_at: string;
  updated_at: string;
}

export interface MockSavvyCalBooking {
  id: string;
  link_id: string;
  link_slug: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  start_time: string;
  end_time: string;
  duration_minutes: number;
  timezone: string;
  location?: string;
  meeting_url?: string;
  attendee: MockSavvyCalAttendee;
  host: MockSavvyCalHost;
  notes?: string;
  answers?: Record<string, string>;
  cancelled_at?: string;
  cancellation_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface MockSavvyCalAttendee {
  name: string;
  email: string;
  phone?: string;
  timezone: string;
  company?: string;
}

export interface MockSavvyCalHost {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

export interface MockSavvyCalAvailability {
  date: string;
  slots: Array<{
    start_time: string;
    end_time: string;
    available: boolean;
  }>;
}

export interface MockSavvyCalOAuthToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

// ============================================================================
// Sample Data
// ============================================================================

const LINK_NAMES = [
  'Quick Chat (15 min)',
  'Discovery Call (30 min)',
  'Product Demo (45 min)',
  'Strategy Session (60 min)',
  'Technical Deep Dive (90 min)',
];

const ATTENDEE_NAMES = [
  { name: 'John Smith', email: 'john.smith@prospect.com', company: 'Acme Corp' },
  { name: 'Sarah Johnson', email: 'sarah.johnson@client.com', company: 'TechStart Inc' },
  { name: 'Michael Chen', email: 'michael.chen@lead.com', company: 'Global Solutions' },
  { name: 'Emily Davis', email: 'emily.davis@company.com', company: 'InnovateTech' },
];

const HOST_NAMES = [
  { name: 'Alex Thompson', email: 'alex@company.com' },
  { name: 'Jordan Lee', email: 'jordan@company.com' },
  { name: 'Casey Morgan', email: 'casey@company.com' },
];

const TIMEZONES = [
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
];

// ============================================================================
// Helper Functions
// ============================================================================

function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// ============================================================================
// SavvyCal Mock Class
// ============================================================================

export class SavvyCalMock {
  private links: Map<string, MockSavvyCalLink> = new Map();
  private bookings: Map<string, MockSavvyCalBooking> = new Map();

  constructor(options?: { preloadData?: boolean }) {
    if (options?.preloadData) {
      this.generateSampleData();
    }
  }

  // ============================================================================
  // Data Generators
  // ============================================================================

  generateLink(overrides?: Partial<MockSavvyCalLink>): MockSavvyCalLink {
    const name = randomElement(LINK_NAMES);
    const durationMatch = name.match(/\((\d+)\s*min\)/);
    const duration = durationMatch ? parseInt(durationMatch[1]) : 30;
    const slug = generateSlug(name);

    const link: MockSavvyCalLink = {
      id: generateId('link'),
      slug,
      name,
      description: `Book a ${duration}-minute session with our team`,
      duration_minutes: duration,
      location_type: randomElement(['google_meet', 'zoom', 'phone']),
      is_active: true,
      booking_url: `https://savvycal.com/company/${slug}`,
      created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };

    this.links.set(link.id, link);
    return link;
  }

  generateBooking(linkId?: string, overrides?: Partial<MockSavvyCalBooking>): MockSavvyCalBooking {
    const link = linkId ? this.links.get(linkId) : randomElement(Array.from(this.links.values()));
    if (!link) {
      this.generateLink();
    }
    const actualLink = link || Array.from(this.links.values())[0];

    const now = new Date();
    const daysOffset = Math.floor(Math.random() * 14) - 3; // -3 to +10 days
    const hour = Math.floor(Math.random() * 8) + 9; // 9 AM to 5 PM
    const startTime = new Date(now);
    startTime.setDate(startTime.getDate() + daysOffset);
    startTime.setHours(hour, 0, 0, 0);

    const endTime = new Date(startTime.getTime() + actualLink.duration_minutes * 60 * 1000);
    const attendee = randomElement(ATTENDEE_NAMES);
    const host = randomElement(HOST_NAMES);
    const timezone = randomElement(TIMEZONES);

    const status = daysOffset < 0
      ? randomElement(['completed', 'no_show', 'cancelled'])
      : randomElement(['scheduled', 'scheduled', 'scheduled', 'cancelled']);

    const booking: MockSavvyCalBooking = {
      id: generateId('booking'),
      link_id: actualLink.id,
      link_slug: actualLink.slug,
      status: status as MockSavvyCalBooking['status'],
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      duration_minutes: actualLink.duration_minutes,
      timezone,
      location: actualLink.location_type === 'phone' ? '+1 555 123 4567' : undefined,
      meeting_url: actualLink.location_type !== 'phone'
        ? `https://meet.google.com/${generateId('m')}`
        : undefined,
      attendee: {
        name: attendee.name,
        email: attendee.email,
        phone: Math.random() > 0.5 ? '+1 555 987 6543' : undefined,
        timezone,
        company: attendee.company,
      },
      host: {
        id: generateId('host'),
        name: host.name,
        email: host.email,
        avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${host.name}`,
      },
      notes: Math.random() > 0.6 ? 'Looking forward to discussing our partnership opportunities' : undefined,
      answers: Math.random() > 0.5 ? {
        'company_size': '50-100 employees',
        'main_challenge': 'Sales pipeline visibility',
      } : undefined,
      cancelled_at: status === 'cancelled' ? new Date().toISOString() : undefined,
      cancellation_reason: status === 'cancelled' ? 'Schedule conflict' : undefined,
      created_at: new Date(startTime.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };

    this.bookings.set(booking.id, booking);
    return booking;
  }

  generateAvailability(date: string, linkId?: string): MockSavvyCalAvailability {
    const slots: MockSavvyCalAvailability['slots'] = [];
    const baseDate = new Date(date);

    // Generate slots from 9 AM to 5 PM
    for (let hour = 9; hour < 17; hour++) {
      const startTime = new Date(baseDate);
      startTime.setHours(hour, 0, 0, 0);
      const endTime = new Date(startTime);
      endTime.setHours(hour + 1, 0, 0, 0);

      slots.push({
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        available: Math.random() > 0.3, // 70% chance of being available
      });
    }

    return { date, slots };
  }

  generateOAuthToken(): MockSavvyCalOAuthToken {
    return {
      access_token: `savvycal_access_${generateId('token')}`,
      refresh_token: `savvycal_refresh_${generateId('token')}`,
      expires_in: 7200,
      token_type: 'Bearer',
      scope: 'links:read bookings:read bookings:write',
    };
  }

  private generateSampleData(): void {
    // Generate links
    LINK_NAMES.forEach(name => {
      const durationMatch = name.match(/\((\d+)\s*min\)/);
      const duration = durationMatch ? parseInt(durationMatch[1]) : 30;
      this.generateLink({ name, duration_minutes: duration });
    });

    // Generate bookings
    const links = Array.from(this.links.values());
    for (let i = 0; i < 8; i++) {
      this.generateBooking(randomElement(links).id);
    }
  }

  // ============================================================================
  // Mock API Responses
  // ============================================================================

  async mockApiCall(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: Record<string, unknown>
  ): Promise<{
    status: number;
    data: unknown;
    headers: Record<string, string>;
  }> {
    await this.delay(50 + Math.random() * 100);

    const normalizedEndpoint = endpoint.toLowerCase();

    // OAuth
    if (normalizedEndpoint.includes('oauth/token')) {
      return {
        status: 200,
        data: this.generateOAuthToken(),
        headers: { 'content-type': 'application/json' },
      };
    }

    // List Links
    if (normalizedEndpoint.includes('/links') && method === 'GET') {
      const linkId = this.extractId(endpoint);
      if (linkId && this.links.has(linkId)) {
        return { status: 200, data: { data: this.links.get(linkId) }, headers: {} };
      }
      return {
        status: 200,
        data: { data: Array.from(this.links.values()), meta: { total: this.links.size } },
        headers: {},
      };
    }

    // List Bookings
    if (normalizedEndpoint.includes('/bookings') && method === 'GET') {
      const bookingId = this.extractId(endpoint);
      if (bookingId && this.bookings.has(bookingId)) {
        return { status: 200, data: { data: this.bookings.get(bookingId) }, headers: {} };
      }
      return {
        status: 200,
        data: { data: Array.from(this.bookings.values()), meta: { total: this.bookings.size } },
        headers: {},
      };
    }

    // Create Booking
    if (normalizedEndpoint.includes('/bookings') && method === 'POST') {
      const booking = this.generateBooking(body?.link_id as string, {
        attendee: body?.attendee as MockSavvyCalAttendee,
        start_time: body?.start_time as string,
      });
      return { status: 201, data: { data: booking }, headers: {} };
    }

    // Cancel Booking
    if (normalizedEndpoint.includes('/bookings') && method === 'DELETE') {
      const bookingId = this.extractId(endpoint);
      const booking = bookingId ? this.bookings.get(bookingId) : null;
      if (booking) {
        booking.status = 'cancelled';
        booking.cancelled_at = new Date().toISOString();
        booking.cancellation_reason = body?.reason as string || 'Cancelled by user';
        return { status: 200, data: { data: booking }, headers: {} };
      }
      return { status: 404, data: { error: 'Booking not found' }, headers: {} };
    }

    // Get Availability
    if (normalizedEndpoint.includes('/availability')) {
      const date = body?.date as string || new Date().toISOString().split('T')[0];
      const availability = this.generateAvailability(date);
      return { status: 200, data: { data: availability }, headers: {} };
    }

    // Webhook Registration
    if (normalizedEndpoint.includes('/webhooks') && method === 'POST') {
      return {
        status: 201,
        data: {
          data: {
            id: generateId('webhook'),
            url: body?.url,
            events: body?.events || ['booking.created', 'booking.cancelled'],
            active: true,
          },
        },
        headers: {},
      };
    }

    return {
      status: 200,
      data: { success: true, mocked: true },
      headers: {},
    };
  }

  // ============================================================================
  // Accessors
  // ============================================================================

  getLinks(): MockSavvyCalLink[] {
    return Array.from(this.links.values());
  }

  getBookings(): MockSavvyCalBooking[] {
    return Array.from(this.bookings.values());
  }

  getBookingsByStatus(status: MockSavvyCalBooking['status']): MockSavvyCalBooking[] {
    return Array.from(this.bookings.values()).filter(b => b.status === status);
  }

  reset(): void {
    this.links.clear();
    this.bookings.clear();
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private extractId(endpoint: string): string | undefined {
    const match = endpoint.match(/\/([a-z0-9_-]+)$/i);
    return match?.[1];
  }
}

// ============================================================================
// Pre-configured Mock Configs
// ============================================================================

export function createSavvyCalMockConfigs(workflowId: string, orgId: string): ProcessMapMock[] {
  const baseConfig = {
    workflowId,
    orgId,
    integration: 'savvycal',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return [
    {
      id: generateId('mock'),
      ...baseConfig,
      endpoint: 'oauth/token',
      mockType: 'success' as MockType,
      responseData: {
        access_token: 'savvycal_mock_token_12345',
        refresh_token: 'savvycal_refresh_67890',
        expires_in: 7200,
        token_type: 'Bearer',
      },
      errorResponse: null,
      delayMs: 100,
      matchConditions: null,
      priority: 10,
    },
    {
      id: generateId('mock'),
      ...baseConfig,
      endpoint: 'links',
      mockType: 'success' as MockType,
      responseData: {
        data: [
          { id: 'link_001', slug: 'discovery-call', name: 'Discovery Call', duration_minutes: 30 },
          { id: 'link_002', slug: 'demo', name: 'Product Demo', duration_minutes: 45 },
        ],
      },
      errorResponse: null,
      delayMs: 100,
      matchConditions: null,
      priority: 5,
    },
    {
      id: generateId('mock'),
      ...baseConfig,
      endpoint: 'bookings',
      mockType: 'success' as MockType,
      responseData: {
        data: [
          {
            id: 'booking_001',
            link_slug: 'discovery-call',
            status: 'scheduled',
            attendee: { name: 'John Smith', email: 'john@example.com' },
          },
        ],
      },
      errorResponse: null,
      delayMs: 150,
      matchConditions: null,
      priority: 5,
    },
    {
      id: generateId('mock'),
      ...baseConfig,
      endpoint: null,
      mockType: 'rate_limit' as MockType,
      responseData: null,
      errorResponse: {
        error: 'rate_limit_exceeded',
        message: 'Too many requests. Please try again later.',
        retry_after: 60,
      },
      delayMs: 0,
      matchConditions: { bodyContains: { trigger_rate_limit: true } },
      priority: 100,
    },
  ];
}
