#!/usr/bin/env tsx
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { Buffer } from 'node:buffer';

type SavvyCalAttendee = {
  email?: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  is_organizer?: boolean;
};

type SavvyCalWebhookEvent = {
  id: string;
  occurred_at?: string;
  type?: string;
  version?: string;
  payload?: SavvyCalEventPayload;
} & SavvyCalEventPayload;

type SavvyCalEventPayload = {
  summary?: string;
  description?: string;
  start_at?: string;
  end_at?: string;
  scope?: { id?: string; slug?: string; name?: string };
  link?: { id?: string; slug?: string; name?: string; private_name?: string };
  scheduler?: SavvyCalAttendee;
  attendees?: SavvyCalAttendee[];
  state?: string;
};

interface SavvyCalApiResponse {
  data?: SavvyCalWebhookEvent[];
  entries?: SavvyCalWebhookEvent[];
  pagination?: {
    next_cursor?: string | null;
  };
  metadata?: {
    after?: string | null;
  };
}

interface CliOptions {
  days: number;
  scope?: string;
  limit?: number;
  output?: string;
  json?: boolean;
  since?: string;
  until?: string;
  help?: boolean;
  state?: string;
  period?: string;
}

const API_BASE_URL = 'https://api.savvycal.com/v1/events';
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = { days: 3 };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--days':
      case '-d': {
        const value = requireValue(arg, args[i + 1]);
        options.days = parseNumber(value, arg);
        i++;
        break;
      }
      case '--scope': {
        const value = requireValue(arg, args[i + 1]);
        options.scope = value;
        i++;
        break;
      }
      case '--limit':
      case '-l': {
        const value = requireValue(arg, args[i + 1]);
        options.limit = parseNumber(value, arg);
        i++;
        break;
      }
      case '--state': {
        const value = requireValue(arg, args[i + 1]);
        options.state = value;
        i++;
        break;
      }
      case '--period': {
        const value = requireValue(arg, args[i + 1]);
        options.period = value;
        i++;
        break;
      }
      case '--output':
      case '-o': {
        const value = requireValue(arg, args[i + 1]);
        options.output = value;
        i++;
        break;
      }
      case '--json':
        options.json = true;
        break;
      case '--since': {
        const value = requireValue(arg, args[i + 1]);
        options.since = value;
        i++;
        break;
      }
      case '--until': {
        const value = requireValue(arg, args[i + 1]);
        options.until = value;
        i++;
        break;
      }
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        break;
    }
  }

  return options;
}

function requireValue(flag: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function parseNumber(value: string, label: string): number {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid number provided for ${label}: "${value}"`);
  }
  return parsed;
}

function parseDateInput(value: string, label: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date provided for ${label}: "${value}"`);
  }
  return date;
}

function resolveAuthHeader(): string {
  const rawBearerToken =
    process.env.SAVVYCAL_SECRET_KEY ??
    process.env.SAVVYCAL_API_TOKEN ??
    process.env.SAVVYCAL_PRIVATE_KEY ??
    process.env.SAVVYCAL_API_KEY;

  const bearerToken = rawBearerToken?.trim();

  if (bearerToken) {
    return `Bearer ${bearerToken}`;
  }

  const publicKey = process.env.SAVVYCAL_PUBLIC_KEY?.trim();
  const secretKey = process.env.SAVVYCAL_SECRET_KEY?.trim();

  if (publicKey && secretKey) {
    const encoded = Buffer.from(`${publicKey}:${secretKey}`).toString('base64');
    return `Basic ${encoded}`;
  }

  if (secretKey?.startsWith('pt_secret_')) {
    // Personal access tokens are sometimes stored as "secret" in .env.
    return `Bearer ${secretKey}`;
  }

  throw new Error(
    'Missing SavvyCal credentials. Provide SAVVYCAL_API_TOKEN (preferred) or both SAVVYCAL_PUBLIC_KEY and SAVVYCAL_SECRET_KEY.',
  );
}

async function fetchBookings(
  authHeader: string,
  params: {
    scope?: string;
    limit?: number;
    state?: string;
    period?: string;
    since?: string;
    until?: string;
  },
): Promise<SavvyCalWebhookEvent[]> {
  const events: SavvyCalWebhookEvent[] = [];
  let cursor: string | undefined;
  const totalLimit = params.limit;
  const pageSize = Math.min(Math.max(totalLimit ?? 100, 1), 100);

  while (true) {
    const searchParams = new URLSearchParams();
    searchParams.set('limit', String(pageSize));
    searchParams.set('filter[state]', (params.state ?? 'all').toLowerCase());
    searchParams.set('filter[period]', (params.period ?? 'all').toLowerCase());
    if (params.scope) searchParams.set('filter[scope]', params.scope);
    if (params.since) searchParams.set('filter[since]', params.since);
    if (params.until) searchParams.set('filter[until]', params.until);
    if (cursor) searchParams.set('page[after]', cursor);

    const response = await fetch(`${API_BASE_URL}?${searchParams.toString()}`, {
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`SavvyCal API request failed (${response.status}): ${text}`);
    }

    const payload = (await response.json()) as SavvyCalApiResponse;
    const batch = payload.data ?? payload.entries ?? [];
    events.push(...batch);

    if (totalLimit && events.length >= totalLimit) {
      return events.slice(0, totalLimit);
    }

    cursor = payload.pagination?.next_cursor ?? payload.metadata?.after ?? undefined;
    if (!cursor) {
      break;
    }
  }

  return events;
}

function summarizeEvent(event: SavvyCalWebhookEvent) {
  const payload = event.payload ?? event;
  const attendees = payload.attendees ?? [];
  const firstExternalAttendee = attendees.find((attendee) => !attendee.is_organizer);
  const fallbackEmail =
    firstExternalAttendee?.email ??
    payload.scheduler?.email ??
    attendees.find((attendee) => attendee.email)?.email ??
    'unknown';
  const title =
    payload.summary ??
    payload.link?.private_name ??
    payload.link?.name ??
    `Meeting (${payload.scope?.slug ?? 'savvycal'})`;

  return {
    id: event.id,
    title,
    contact: fallbackEmail,
    start_at: payload.start_at ?? 'unknown',
    end_at: payload.end_at ?? null,
    scope: payload.scope?.slug ?? null,
    state: payload.state ?? event.type ?? 'unknown',
    occurred_at: event.occurred_at ?? payload.start_at ?? null,
  };
}

function printHelp() {
}

async function main() {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    return;
  }

  if (options.days <= 0) {
    throw new Error('The --days argument must be greater than zero.');
  }

  if (options.limit !== undefined && options.limit <= 0) {
    throw new Error('The --limit argument must be greater than zero when provided.');
  }

  const untilDate = options.until ? parseDateInput(options.until, '--until') : new Date();
  const sinceDate = options.since
    ? parseDateInput(options.since, '--since')
    : new Date(untilDate.getTime() - options.days * DAY_IN_MS);

  const authHeader = resolveAuthHeader();
  const debugMode = process.env.DEBUG_SAVVYCAL_FETCH === '1';

  if (debugMode) {
    const [scheme] = authHeader.split(' ', 1);
  }
  const sinceIso = sinceDate.toISOString();
  const untilIso = untilDate.toISOString();
  const events = await fetchBookings(authHeader, {
    scope: options.scope,
    limit: options.limit,
    state: options.state,
    period: options.period,
    since: sinceIso,
    until: untilIso,
  });

  const filteredEvents = filterEventsByDateAndScope(events, sinceDate, untilDate, options.scope);

  if (!filteredEvents.length) {
    return;
  }
  const summary = filteredEvents.map(summarizeEvent);
  const rowsToShow = Math.min(summary.length, 10);
  if (summary.length > rowsToShow) {
  }

  if (options.json && !options.output) {
  }

  if (options.output) {
    const filePath = path.resolve(process.cwd(), options.output);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(filteredEvents, null, 2));
  }
}

function filterEventsByDateAndScope(
  events: SavvyCalWebhookEvent[],
  since: Date,
  until: Date,
  scope?: string,
): SavvyCalWebhookEvent[] {
  const hasSince = Boolean(since);
  const hasUntil = Boolean(until);
  const scopeSlug = scope?.toLowerCase();

  return events.filter((event) => {
    const payload = event.payload ?? event;
    const start = payload.start_at ?? event.start_at;
    if (scopeSlug && payload.scope?.slug?.toLowerCase() !== scopeSlug) {
      return false;
    }

    if (!start) return true;
    const startTime = new Date(start);
    if (Number.isNaN(startTime.getTime())) {
      return true;
    }

    if (hasSince && startTime < since) {
      return false;
    }
    if (hasUntil && startTime > until) {
      return false;
    }
    return true;
  });
}

main().catch((error) => {
  process.exit(1);
});

