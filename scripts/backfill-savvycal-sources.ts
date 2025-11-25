/**
 * Backfill SavvyCal lead sources from CSV export
 *
 * Usage:
 *   npx ts-node scripts/backfill-savvycal-sources.ts [--execute]
 *
 * By default runs in preview mode. Add --execute to actually update records.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as Papa from 'papaparse';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface CSVRow {
  id: string;
  link_id: string;
  state: string;
  start_at: string;
  scheduler_email: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string;
  utm_content: string;
}

interface Stats {
  total: number;
  matched: number;
  updated: number;
  skipped: number;
  errors: number;
  sourceBreakdown: Record<string, number>;
}

const CSV_PATH = path.resolve(__dirname, '../../../Downloads/All bookings.csv');

async function main() {
  const executeMode = process.argv.includes('--execute');

  console.log('🔍 SavvyCal Lead Source Backfill Tool');
  console.log(`Mode: ${executeMode ? '🚀 EXECUTE' : '👀 PREVIEW'}`);
  console.log('-----------------------------------\n');

  // Check if CSV exists
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV file not found: ${CSV_PATH}`);
    console.log('Please ensure the CSV is at: ~/Downloads/All bookings.csv');
    process.exit(1);
  }

  // Parse CSV
  console.log('📂 Reading CSV file...');
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
  const parsed = Papa.parse<CSVRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  console.log(`📊 Found ${parsed.data.length} rows in CSV\n`);

  // Get all leads from database
  console.log('📡 Fetching leads from database...');
  const { data: leads, error: fetchError } = await supabase
    .from('leads')
    .select('id, external_id, contact_email, meeting_start, utm_source, source_channel, booking_link_id');

  if (fetchError) {
    console.error('Failed to fetch leads:', fetchError.message);
    process.exit(1);
  }

  console.log(`📊 Found ${leads?.length || 0} leads in database\n`);

  // Create lookup maps
  const leadsByExternalId = new Map<string, typeof leads[0]>();
  const leadsByEmailAndTime = new Map<string, typeof leads[0]>();

  for (const lead of leads || []) {
    if (lead.external_id) {
      leadsByExternalId.set(lead.external_id, lead);
    }
    if (lead.contact_email && lead.meeting_start) {
      const key = `${lead.contact_email.toLowerCase()}|${new Date(lead.meeting_start).toISOString()}`;
      leadsByEmailAndTime.set(key, lead);
    }
  }

  const stats: Stats = {
    total: parsed.data.length,
    matched: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    sourceBreakdown: {},
  };

  // Process each CSV row
  console.log('🔄 Processing CSV rows...\n');

  const updates: { leadId: string; payload: Record<string, unknown> }[] = [];

  for (const row of parsed.data) {
    if (!row.id) continue;

    // Try to match the lead
    let lead = leadsByExternalId.get(row.id);

    // If not found by external_id, try email + meeting time
    if (!lead && row.scheduler_email && row.start_at) {
      const key = `${row.scheduler_email.toLowerCase()}|${new Date(row.start_at).toISOString()}`;
      lead = leadsByEmailAndTime.get(key);
    }

    if (!lead) {
      stats.skipped++;
      continue;
    }

    stats.matched++;

    // Skip if lead already has source tracking
    if (lead.utm_source || lead.source_channel) {
      stats.skipped++;
      continue;
    }

    // Build update payload
    const payload: Record<string, unknown> = {};

    if (row.utm_source) {
      payload.utm_source = row.utm_source;
    }
    if (row.utm_medium) {
      payload.utm_medium = row.utm_medium;
    }
    if (row.utm_campaign) {
      payload.utm_campaign = row.utm_campaign;
    }
    if (row.utm_term) {
      payload.utm_term = row.utm_term;
    }
    if (row.utm_content) {
      payload.utm_content = row.utm_content;
    }
    if (row.link_id && !lead.booking_link_id) {
      payload.booking_link_id = row.link_id;
    }

    // Derive source_channel from UTM
    if (row.utm_source) {
      const source = row.utm_source.toLowerCase();
      if (source === 'fb' || source === 'facebook' || source === 'ig' || source === 'instagram') {
        payload.source_channel = 'paid_social';
        payload.source_medium = 'meta';
      } else if (source === 'linkedin') {
        payload.source_channel = 'paid_social';
        payload.source_medium = 'linkedin';
      } else if (source === 'google') {
        payload.source_channel = row.utm_medium === 'cpc' ? 'paid_search' : 'organic';
        payload.source_medium = 'google';
      }
    }

    // Track source breakdown
    const sourceKey = row.utm_source || (row.link_id ? 'direct_link' : 'unknown');
    stats.sourceBreakdown[sourceKey] = (stats.sourceBreakdown[sourceKey] || 0) + 1;

    if (Object.keys(payload).length > 0) {
      updates.push({ leadId: lead.id, payload });
    }
  }

  // Print source breakdown
  console.log('📊 Source Breakdown:');
  console.log('-------------------');
  const sortedSources = Object.entries(stats.sourceBreakdown)
    .sort((a, b) => b[1] - a[1]);
  for (const [source, count] of sortedSources) {
    const displayName = getSourceDisplayName(source);
    console.log(`  ${displayName}: ${count}`);
  }
  console.log('');

  console.log(`📈 Summary:`);
  console.log(`  Total CSV rows: ${stats.total}`);
  console.log(`  Matched leads: ${stats.matched}`);
  console.log(`  To update: ${updates.length}`);
  console.log(`  Skipped (already has source): ${stats.skipped - (stats.matched - updates.length)}`);
  console.log('');

  if (!executeMode) {
    console.log('👀 PREVIEW MODE - No changes made');
    console.log('Run with --execute to apply updates');
    return;
  }

  // Execute updates
  console.log('🚀 Executing updates...\n');

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < updates.length; i++) {
    const { leadId, payload } = updates[i];

    const { error } = await supabase
      .from('leads')
      .update(payload)
      .eq('id', leadId);

    if (error) {
      errorCount++;
      if (errorCount <= 5) {
        console.error(`  ❌ Error updating lead ${leadId}: ${error.message}`);
      }
    } else {
      successCount++;
    }

    // Progress indicator
    if ((i + 1) % 100 === 0 || i === updates.length - 1) {
      console.log(`  Progress: ${i + 1}/${updates.length} (${successCount} updated, ${errorCount} errors)`);
    }
  }

  console.log('\n✅ Backfill complete!');
  console.log(`  Successfully updated: ${successCount}`);
  console.log(`  Errors: ${errorCount}`);
}

function getSourceDisplayName(source: string): string {
  const displayNames: Record<string, string> = {
    fb: 'Facebook Ads',
    facebook: 'Facebook Ads',
    ig: 'Instagram Ads',
    instagram: 'Instagram Ads',
    linkedin: 'LinkedIn Ads',
    google: 'Google',
    email: 'Email Outreach',
    direct_link: 'Direct (SavvyCal Link)',
    unknown: 'Unknown',
    '': 'Unknown',
  };
  return displayNames[source.toLowerCase()] || source;
}

main().catch(console.error);
