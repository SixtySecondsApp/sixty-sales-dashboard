#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

type SavvyCalWebhookEvent = {
  id: string;
  occurred_at: string;
  payload: any;
  type: string;
  version: string;
};

interface SavvyCalApiResponse {
  data: SavvyCalWebhookEvent[];
  pagination?: {
    next_cursor?: string | null;
  };
}

interface BackfillOptions {
  since?: string;
  until?: string;
  scope?: string;
  limit?: number;
  batchSize: number;
  inputFile?: string;
}

function parseArgs(): BackfillOptions {
  const args = process.argv.slice(2);
  const options: BackfillOptions = { batchSize: 20 };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = args[i + 1];
    switch (arg) {
      case '--since':
        options.since = value;
        i++;
        break;
      case '--until':
        options.until = value;
        i++;
        break;
      case '--scope':
        options.scope = value;
        i++;
        break;
      case '--limit':
        options.limit = Number(value);
        i++;
        break;
      case '--batch':
        options.batchSize = Number(value);
        i++;
        break;
      case '--file':
        options.inputFile = value;
        i++;
        break;
      default:
        break;
    }
  }

  return options;
}

async function fetchSavvyCalEvents(token: string, options: BackfillOptions): Promise<SavvyCalWebhookEvent[]> {
  if (options.inputFile) {
    const absolutePath = path.resolve(process.cwd(), options.inputFile);
    const content = fs.readFileSync(absolutePath, 'utf-8');
    const payload = JSON.parse(content);
    return Array.isArray(payload) ? payload : payload?.data ?? [];
  }

  const events: SavvyCalWebhookEvent[] = [];
  let cursor: string | undefined;

  while (true) {
    const params = new URLSearchParams();
    if (options.since) params.set('filter[since]', options.since);
    if (options.until) params.set('filter[until]', options.until);
    if (options.scope) params.set('filter[scope]', options.scope);
    if (options.limit) params.set('page[limit]', String(Math.min(options.limit, 100)));
    if (cursor) params.set('page[after]', cursor);

    const response = await fetch(`https://api.savvycal.com/v1/events?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`SavvyCal API request failed (${response.status}): ${text}`);
    }

    const payload = (await response.json()) as SavvyCalApiResponse;
    events.push(...(payload.data ?? []));

    if (options.limit && events.length >= options.limit) {
      return events.slice(0, options.limit);
    }

    cursor = payload.pagination?.next_cursor ?? undefined;
    if (!cursor) {
      break;
    }
  }

  return events;
}

async function main() {
  const options = parseArgs();

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const savvyCalToken = process.env.SAVVYCAL_API_TOKEN || process.env.SAVVYCAL_API_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }

  if (!savvyCalToken && !options.inputFile) {
    throw new Error('Provide SAVVYCAL_API_TOKEN or use --file to backfill from a JSON payload');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const events = await fetchSavvyCalEvents(savvyCalToken ?? '', options);
  if (!events.length) {
    return;
  }
  for (let i = 0; i < events.length; i += options.batchSize) {
    const batch = events.slice(i, i + options.batchSize);
    const { data, error } = await supabase.functions.invoke('savvycal-leads-webhook', {
      method: 'POST',
      body: batch,
    });

    if (error) {
      break;
    }
  }
}

main().catch((error) => {
  process.exit(1);
});













