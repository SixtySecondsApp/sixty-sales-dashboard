#!/usr/bin/env tsx
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

type SavvyCalEvent = {
  id: string;
  summary?: string;
  start_at?: string;
  end_at?: string;
  state?: string;
  scope?: { slug?: string };
  scheduler?: { email?: string };
  attendees?: Array<{ email?: string; is_organizer?: boolean }>;
  link?: { private_name?: string; name?: string };
};

interface CliOptions {
  start: string;
  end: string;
  scope?: string;
  state: string;
  period: string;
  chunkDays: number;
  pageSize: number;
  output?: string;
  json?: boolean;
  verbose?: boolean;
}

const API_URL = 'https://api.savvycal.com/v1/events';
const DEFAULT_CHUNK_DAYS = 30;
const DEFAULT_PAGE_SIZE = 100;

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: Partial<CliOptions> = {
    state: 'all',
    period: 'all',
    chunkDays: DEFAULT_CHUNK_DAYS,
    pageSize: DEFAULT_PAGE_SIZE,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = args[i + 1];
    switch (arg) {
      case '--start':
        options.start = requireValue(arg, value);
        i++;
        break;
      case '--end':
        options.end = requireValue(arg, value);
        i++;
        break;
      case '--scope':
        options.scope = requireValue(arg, value);
        i++;
        break;
      case '--state':
        options.state = requireValue(arg, value);
        i++;
        break;
      case '--period':
        options.period = requireValue(arg, value);
        i++;
        break;
      case '--chunk-days':
        options.chunkDays = parsePositiveInt(arg, value);
        i++;
        break;
      case '--page-size':
        options.pageSize = Math.min(100, parsePositiveInt(arg, value));
        i++;
        break;
      case '--output':
        options.output = requireValue(arg, value);
        i++;
        break;
      case '--json':
        options.json = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      default:
        console.warn(`Ignoring unknown option "${arg}"`);
        break;
    }
  }

  if (!options.start || !options.end) {
    throw new Error('Both --start and --end are required (ISO 8601 timestamps).');
  }

  return options as CliOptions;
}

function requireValue(flag: string, value?: string): string {
  if (!value) throw new Error(`Missing value for ${flag}`);
  return value;
}

function parsePositiveInt(flag: string, value?: string): number {
  const parsed = Number(requireValue(flag, value));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid number for ${flag}: "${value}"`);
  }
  return parsed;
}

function resolveAuthHeader(): string {
  const token =
    process.env.SAVVYCAL_SECRET_KEY ??
    process.env.SAVVYCAL_API_TOKEN ??
    process.env.SAVVYCAL_PRIVATE_KEY ??
    process.env.SAVVYCAL_API_KEY;

  if (!token) {
    throw new Error('Missing SavvyCal credentials. Set SAVVYCAL_SECRET_KEY or SAVVYCAL_API_TOKEN.');
  }

  return `Bearer ${token.trim()}`;
}

function buildChunks(start: Date, end: Date, chunkDays: number): Array<{ start: Date; end: Date }> {
  const chunks: Array<{ start: Date; end: Date }> = [];
  let cursor = new Date(start);

  while (cursor < end) {
    const chunkStart = new Date(cursor);
    const chunkEnd = new Date(Math.min(end.getTime(), chunkStart.getTime() + chunkDays * 24 * 60 * 60 * 1000));
    chunks.push({ start: chunkStart, end: chunkEnd });
    cursor = new Date(chunkEnd.getTime() + 1);
  }

  return chunks;
}

async function fetchChunk(
  authHeader: string,
  params: {
    startIso: string;
    endIso: string;
    scope?: string;
    state: string;
    period: string;
    pageSize: number;
    verbose?: boolean;
  },
): Promise<SavvyCalEvent[]> {
  const events: SavvyCalEvent[] = [];
  let cursor: string | undefined;

  while (true) {
    const searchParams = new URLSearchParams();
    searchParams.set('limit', String(params.pageSize));
    searchParams.set('filter[state]', params.state.toLowerCase());
    searchParams.set('filter[period]', params.period.toLowerCase());
    searchParams.set('filter[since]', params.startIso);
    searchParams.set('filter[until]', params.endIso);
    if (params.scope) searchParams.set('filter[scope]', params.scope);
    if (cursor) searchParams.set('page[after]', cursor);

    const url = `${API_URL}?${searchParams.toString()}`;

    if (params.verbose) {
      console.log(`[savvycal] GET ${url}`);
    }

    const response = await fetch(url, {
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`SavvyCal API failed (${response.status}): ${text}`);
    }

    const payload = (await response.json()) as { entries?: SavvyCalEvent[]; metadata?: { after?: string | null } };
    events.push(...(payload.entries ?? []));

    cursor = payload.metadata?.after ?? undefined;
    if (!cursor) break;
  }

  return events;
}

function summarize(event: SavvyCalEvent) {
  const attendees = event.attendees ?? [];
  const contact =
    attendees.find((attendee) => !attendee.is_organizer)?.email ??
    event.scheduler?.email ??
    attendees.find((attendee) => attendee.email)?.email ??
    'unknown';

  return {
    id: event.id,
    title: event.summary ?? event.link?.private_name ?? event.link?.name ?? 'Meeting',
    contact,
    start_at: event.start_at ?? 'unscheduled',
    end_at: event.end_at ?? 'unscheduled',
    scope: event.scope?.slug ?? 'unknown',
    state: event.state ?? 'unknown',
  };
}

async function main() {
  const options = parseArgs();
  const startDate = new Date(options.start);
  const endDate = new Date(options.end);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new Error('Invalid --start or --end date. Use ISO timestamps (e.g., 2025-01-01T00:00:00Z).');
  }

  if (startDate >= endDate) {
    throw new Error('--end must be after --start.');
  }

  const authHeader = resolveAuthHeader();
  const chunks = buildChunks(startDate, endDate, options.chunkDays);

  const seen = new Map<string, SavvyCalEvent>();

  for (const chunk of chunks) {
    const startIso = chunk.start.toISOString();
    const endIso = chunk.end.toISOString();
    if (options.verbose) {
      console.log(`Fetching ${startIso} → ${endIso}`);
    }
    const events = await fetchChunk(authHeader, {
      startIso,
      endIso,
      scope: options.scope,
      state: options.state,
      period: options.period,
      pageSize: options.pageSize,
      verbose: options.verbose,
    });

    for (const event of events) {
      if (!seen.has(event.id)) {
        seen.set(event.id, event);
      }
    }
  }

  const sorted = [...seen.values()].sort((a, b) => {
    const aTime = a.start_at ? Date.parse(a.start_at) : 0;
    const bTime = b.start_at ? Date.parse(b.start_at) : 0;
    return aTime - bTime;
  });

  if (!sorted.length) {
    console.log('No bookings found for the requested window.');
    return;
  }

  console.log(`Collected ${sorted.length} unique booking(s).`);
  console.table(sorted.slice(0, 10).map(summarize));
  if (sorted.length > 10) {
    console.log(`Showing first 10 rows. Total rows: ${sorted.length}`);
  }

  if (options.json && !options.output) {
    console.log(JSON.stringify(sorted, null, 2));
  }

  if (options.output) {
    const destination = path.resolve(process.cwd(), options.output);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, JSON.stringify(sorted, null, 2));
    console.log(`Saved ${sorted.length} booking(s) to ${destination}`);
  }
}

main().catch((error) => {
  console.error('[exportSavvyCalMeetings] Failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});






