#!/usr/bin/env node

/**
 * Production to Staging Data Sync Script
 *
 * Syncs data from production Supabase to staging Supabase for testing
 * with real production data.
 *
 * Usage:
 *   node scripts/sync-production-to-staging.js                    # Interactive mode
 *   node scripts/sync-production-to-staging.js --tables=all       # Sync all tables
 *   node scripts/sync-production-to-staging.js --tables=activities,deals  # Specific tables
 *   node scripts/sync-production-to-staging.js --dry-run          # Preview only
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// =============================================================================
// Configuration
// =============================================================================

const PRODUCTION_CONFIG = {
  url: 'https://ygdpgliavpxeugaajgrb.supabase.co',
  serviceRoleKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnZHBnbGlhdnB4ZXVnYWFqZ3JiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTE4OTQ2MSwiZXhwIjoyMDgwNzY1NDYxfQ.n9MVawseoWgWSu7H48-lgpvl3dUFMqofI7lWlbqmEfI',
  projectId: 'ygdpgliavpxeugaajgrb'
};

const STAGING_CONFIG = {
  url: 'https://idurpiwkzxkzccifnrsu.supabase.co',
  serviceRoleKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkdXJwaXdrenhremNjaWZucnN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzg3MTA4OSwiZXhwIjoyMDgzNDQ3MDg5fQ.O61TpW91zzU6-U64RWF-XdWpncvHgcUG8Xo5nIUvpaY',
  projectId: 'idurpiwkzxkzccifnrsu'
};

// Tables to sync in dependency order (parent tables first)
const SYNC_ORDER = [
  'profiles',
  'organizations',
  'organization_memberships',
  'deal_stages',
  'companies',
  'contacts',
  'deals',
  'activities',
  'meetings',
  'tasks',
  'calendar_events',
  'fathom_integrations',
  'action_items',
  'meeting_attendees',
  'meeting_insights',
  'next_action_suggestions',
  'proposals',
  'relationship_health_scores'
];

// Tables that support incremental sync (have 'id' column)
const INCREMENTAL_TABLES = [
  'profiles', 'organizations', 'companies', 'contacts', 'deals',
  'activities', 'meetings', 'tasks', 'calendar_events', 'action_items'
];

// Batch size for inserts
const BATCH_SIZE = 100;

// =============================================================================
// Supabase Clients
// =============================================================================

const prodClient = createClient(PRODUCTION_CONFIG.url, PRODUCTION_CONFIG.serviceRoleKey, {
  auth: { persistSession: false }
});

const stagingClient = createClient(STAGING_CONFIG.url, STAGING_CONFIG.serviceRoleKey, {
  auth: { persistSession: false }
});

// =============================================================================
// Utility Functions
// =============================================================================

function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    warning: '\x1b[33m', // Yellow
    error: '\x1b[31m',   // Red
    reset: '\x1b[0m'
  };
  const prefix = {
    info: 'ℹ️ ',
    success: '✅',
    warning: '⚠️ ',
    error: '❌'
  };
  console.log(`${colors[type]}${prefix[type]} ${message}${colors.reset}`);
}

function formatNumber(num) {
  return num.toLocaleString();
}

async function getTableCount(client, table) {
  const { count, error } = await client
    .from(table)
    .select('*', { count: 'exact', head: true });

  if (error) {
    return { count: null, error: error.message };
  }
  return { count, error: null };
}

async function getTableData(client, table, offset = 0, limit = 1000) {
  const { data, error } = await client
    .from(table)
    .select('*')
    .range(offset, offset + limit - 1);

  if (error) {
    return { data: null, error: error.message };
  }
  return { data, error: null };
}

async function getAllTableData(client, table) {
  const allData = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await getTableData(client, table, offset, pageSize);
    if (error) {
      throw new Error(`Failed to fetch ${table}: ${error}`);
    }
    if (!data || data.length === 0) break;

    allData.push(...data);
    offset += data.length;

    if (data.length < pageSize) break;
  }

  return allData;
}

async function insertBatch(client, table, records, onConflict = 'id') {
  if (records.length === 0) return { success: 0, errors: 0 };

  const { error } = await client
    .from(table)
    .upsert(records, {
      onConflict,
      ignoreDuplicates: true
    });

  if (error) {
    // Try inserting one by one to identify problematic records
    let success = 0;
    let errors = 0;

    for (const record of records) {
      const { error: singleError } = await client
        .from(table)
        .upsert([record], { onConflict, ignoreDuplicates: true });

      if (singleError) {
        errors++;
      } else {
        success++;
      }
    }

    return { success, errors };
  }

  return { success: records.length, errors: 0 };
}

// =============================================================================
// Incremental Sync Functions
// =============================================================================

async function getTableIds(client, table) {
  const allIds = [];
  let offset = 0;
  const pageSize = 1000; // Supabase default limit

  while (true) {
    const { data, error } = await client
      .from(table)
      .select('id')
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`Failed to fetch IDs from ${table}: ${error.message}`);
    }
    if (!data || data.length === 0) break;

    allIds.push(...data.map(r => r.id));
    offset += data.length;

    if (data.length < pageSize) break;
  }

  return new Set(allIds);
}

async function getMissingIds(prodClient, stagingClient, table) {
  log(`  Fetching IDs from production...`, 'info');
  const prodIds = await getTableIds(prodClient, table);
  log(`  Found ${formatNumber(prodIds.size)} production records`, 'info');

  log(`  Fetching IDs from staging...`, 'info');
  const stagingIds = await getTableIds(stagingClient, table);
  log(`  Found ${formatNumber(stagingIds.size)} staging records`, 'info');

  // Find IDs in production but not in staging
  const missingIds = [...prodIds].filter(id => !stagingIds.has(id));
  log(`  Missing in staging: ${formatNumber(missingIds.length)} records`, 'info');

  return missingIds;
}

async function getRecordsByIds(client, table, ids) {
  if (ids.length === 0) return [];

  const allRecords = [];
  const batchSize = 50; // Supabase .in() limit

  for (let i = 0; i < ids.length; i += batchSize) {
    const batchIds = ids.slice(i, i + batchSize);
    const { data, error } = await client
      .from(table)
      .select('*')
      .in('id', batchIds);

    if (error) {
      log(`  Warning: Failed to fetch batch: ${error.message}`, 'warning');
      continue;
    }

    allRecords.push(...data);
  }

  return allRecords;
}

async function syncTableIncremental(table, options = {}) {
  const { dryRun = false, verbose = false } = options;

  log(`\n🔄 Incremental sync: ${table}`, 'info');

  try {
    // Find missing IDs
    const missingIds = await getMissingIds(prodClient, stagingClient, table);

    if (missingIds.length === 0) {
      log(`  ✅ Table is fully synced!`, 'success');
      return { table, success: true, synced: 0, mode: 'incremental' };
    }

    if (dryRun) {
      log(`  [DRY RUN] Would sync ${formatNumber(missingIds.length)} missing records`, 'warning');
      return { table, success: true, dryRun: true, missing: missingIds.length, mode: 'incremental' };
    }

    // Fetch missing records from production
    log(`  Fetching ${formatNumber(missingIds.length)} missing records from production...`, 'info');
    const missingRecords = await getRecordsByIds(prodClient, table, missingIds);
    log(`  Retrieved ${formatNumber(missingRecords.length)} records`, 'info');

    // Insert into staging
    log(`  Inserting into staging...`, 'info');
    let totalSuccess = 0;
    let totalErrors = 0;

    for (let i = 0; i < missingRecords.length; i += BATCH_SIZE) {
      const batch = missingRecords.slice(i, i + BATCH_SIZE);
      const { success, errors } = await insertBatch(stagingClient, table, batch);
      totalSuccess += success;
      totalErrors += errors;

      if (verbose) {
        const progress = Math.min(100, Math.round(((i + batch.length) / missingRecords.length) * 100));
        process.stdout.write(`\r  Progress: ${progress}% (${formatNumber(i + batch.length)}/${formatNumber(missingRecords.length)})`);
      }
    }

    if (verbose) console.log('');

    log(`  ✅ Synced: ${formatNumber(totalSuccess)} records`, 'success');
    if (totalErrors > 0) {
      log(`  ⚠️  Errors: ${formatNumber(totalErrors)} records`, 'warning');
    }

    return {
      table,
      success: true,
      synced: totalSuccess,
      errors: totalErrors,
      mode: 'incremental'
    };
  } catch (err) {
    log(`  ❌ Error: ${err.message}`, 'error');
    return { table, success: false, error: err.message, mode: 'incremental' };
  }
}

// =============================================================================
// Sync Functions
// =============================================================================

async function syncTable(table, options = {}) {
  const { dryRun = false, verbose = false } = options;

  log(`\nSyncing table: ${table}`, 'info');

  // Get counts from both environments
  const [prodCount, stagingCount] = await Promise.all([
    getTableCount(prodClient, table),
    getTableCount(stagingClient, table)
  ]);

  if (prodCount.error) {
    log(`Failed to get production count for ${table}: ${prodCount.error}`, 'error');
    return { table, success: false, error: prodCount.error };
  }

  if (stagingCount.error) {
    log(`Failed to get staging count for ${table}: ${stagingCount.error}`, 'error');
    return { table, success: false, error: stagingCount.error };
  }

  log(`  Production: ${formatNumber(prodCount.count)} records`, 'info');
  log(`  Staging: ${formatNumber(stagingCount.count)} records`, 'info');

  if (dryRun) {
    log(`  [DRY RUN] Would sync ${formatNumber(prodCount.count)} records`, 'warning');
    return {
      table,
      success: true,
      dryRun: true,
      prodCount: prodCount.count,
      stagingCount: stagingCount.count
    };
  }

  // Fetch all production data
  log(`  Fetching production data...`, 'info');
  let prodData;
  try {
    prodData = await getAllTableData(prodClient, table);
  } catch (err) {
    log(`  Failed to fetch: ${err.message}`, 'error');
    return { table, success: false, error: err.message };
  }

  log(`  Fetched ${formatNumber(prodData.length)} records`, 'info');

  if (prodData.length === 0) {
    log(`  No data to sync`, 'warning');
    return { table, success: true, synced: 0 };
  }

  // Insert in batches
  log(`  Inserting into staging...`, 'info');
  let totalSuccess = 0;
  let totalErrors = 0;

  for (let i = 0; i < prodData.length; i += BATCH_SIZE) {
    const batch = prodData.slice(i, i + BATCH_SIZE);
    const { success, errors } = await insertBatch(stagingClient, table, batch);
    totalSuccess += success;
    totalErrors += errors;

    if (verbose || (i + BATCH_SIZE) % 500 === 0) {
      const progress = Math.min(100, Math.round(((i + batch.length) / prodData.length) * 100));
      process.stdout.write(`\r  Progress: ${progress}% (${formatNumber(i + batch.length)}/${formatNumber(prodData.length)})`);
    }
  }

  console.log(''); // New line after progress

  log(`  Synced: ${formatNumber(totalSuccess)} records`, 'success');
  if (totalErrors > 0) {
    log(`  Errors: ${formatNumber(totalErrors)} records`, 'warning');
  }

  // Verify final count
  const finalCount = await getTableCount(stagingClient, table);
  log(`  Final staging count: ${formatNumber(finalCount.count)}`, 'info');

  return {
    table,
    success: true,
    synced: totalSuccess,
    errors: totalErrors,
    finalCount: finalCount.count
  };
}

async function syncAllTables(tables, options = {}) {
  const { incremental = false } = options;
  const results = [];

  for (const table of tables) {
    try {
      // Use incremental sync for supported tables when requested
      if (incremental && INCREMENTAL_TABLES.includes(table)) {
        const result = await syncTableIncremental(table, options);
        results.push(result);
      } else {
        const result = await syncTable(table, options);
        results.push(result);
      }
    } catch (err) {
      log(`Critical error syncing ${table}: ${err.message}`, 'error');
      results.push({ table, success: false, error: err.message });
    }
  }

  return results;
}

// =============================================================================
// Compare Tables
// =============================================================================

async function compareTables() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 Comparing Production vs Staging Counts');
  console.log('='.repeat(60));

  const comparison = [];

  for (const table of SYNC_ORDER) {
    const [prodCount, stagingCount] = await Promise.all([
      getTableCount(prodClient, table),
      getTableCount(stagingClient, table)
    ]);

    const diff = (prodCount.count || 0) - (stagingCount.count || 0);
    comparison.push({
      table,
      production: prodCount.count ?? 'Error',
      staging: stagingCount.count ?? 'Error',
      difference: prodCount.count && stagingCount.count ? diff : 'N/A',
      status: diff === 0 ? '✅' : diff > 0 ? '⚠️  Missing' : '🔄 Extra'
    });
  }

  // Print table
  console.log('\nTable'.padEnd(30) + 'Production'.padEnd(12) + 'Staging'.padEnd(12) + 'Diff'.padEnd(12) + 'Status');
  console.log('-'.repeat(75));

  for (const row of comparison) {
    const prod = String(row.production).padEnd(12);
    const staging = String(row.staging).padEnd(12);
    const diff = String(row.difference).padEnd(12);
    console.log(`${row.table.padEnd(30)}${prod}${staging}${diff}${row.status}`);
  }

  return comparison;
}

// =============================================================================
// Interactive Mode
// =============================================================================

function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

async function prompt(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function interactiveMode() {
  const rl = createInterface();

  console.log('\n' + '='.repeat(60));
  console.log('🔄 Production to Staging Data Sync');
  console.log('='.repeat(60));
  console.log('\nProduction:', PRODUCTION_CONFIG.url);
  console.log('Staging:', STAGING_CONFIG.url);

  // First show comparison
  await compareTables();

  console.log('\nOptions:');
  console.log('  1. Sync all tables (full replace)');
  console.log('  2. Sync all tables (incremental - only missing records)');
  console.log('  3. Sync specific table(s)');
  console.log('  4. Sync only tables with differences');
  console.log('  5. Dry run (preview only)');
  console.log('  6. Exit');

  const choice = await prompt(rl, '\nEnter choice (1-6): ');

  switch (choice.trim()) {
    case '1':
      const confirm1 = await prompt(rl, `\nThis will sync ${SYNC_ORDER.length} tables (full upsert). Continue? (yes/no): `);
      if (confirm1.toLowerCase() === 'yes') {
        rl.close();
        return syncAllTables(SYNC_ORDER, { verbose: true });
      }
      break;

    case '2':
      const confirm2 = await prompt(rl, `\nThis will do incremental sync for ${INCREMENTAL_TABLES.length} tables. Continue? (yes/no): `);
      if (confirm2.toLowerCase() === 'yes') {
        rl.close();
        return syncAllTables(INCREMENTAL_TABLES, { verbose: true, incremental: true });
      }
      break;

    case '3':
      console.log('\nAvailable tables:', SYNC_ORDER.join(', '));
      const tableInput = await prompt(rl, 'Enter table names (comma-separated): ');
      const tables = tableInput.split(',').map(t => t.trim()).filter(t => SYNC_ORDER.includes(t));
      if (tables.length > 0) {
        const useIncremental = await prompt(rl, 'Use incremental sync (only missing records)? (yes/no): ');
        rl.close();
        return syncAllTables(tables, { verbose: true, incremental: useIncremental.toLowerCase() === 'yes' });
      } else {
        log('No valid tables selected', 'warning');
      }
      break;

    case '4':
      const comparison = await compareTables();
      const diffTables = comparison
        .filter(c => typeof c.difference === 'number' && c.difference > 0)
        .map(c => c.table);

      if (diffTables.length === 0) {
        log('All tables are in sync!', 'success');
      } else {
        const confirm4 = await prompt(rl, `\nSync ${diffTables.length} tables with differences (incremental)? (yes/no): `);
        if (confirm4.toLowerCase() === 'yes') {
          rl.close();
          return syncAllTables(diffTables, { verbose: true, incremental: true });
        }
      }
      break;

    case '5':
      rl.close();
      return syncAllTables(SYNC_ORDER, { dryRun: true, verbose: true, incremental: true });

    case '6':
      console.log('\nExiting...');
      break;

    default:
      log('Invalid choice', 'warning');
  }

  rl.close();
  return [];
}

// =============================================================================
// CLI Mode
// =============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    tables: null,
    dryRun: false,
    compare: false,
    verbose: false,
    incremental: false
  };

  for (const arg of args) {
    if (arg.startsWith('--tables=')) {
      const value = arg.split('=')[1];
      options.tables = value === 'all' ? SYNC_ORDER : value.split(',').map(t => t.trim());
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--compare') {
      options.compare = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--incremental' || arg === '-i') {
      options.incremental = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Production to Staging Data Sync Script

Usage:
  node scripts/sync-production-to-staging.js [options]

Options:
  --tables=<list>    Tables to sync (comma-separated or 'all')
  --incremental, -i  Only sync missing records (faster, safer)
  --dry-run          Preview changes without syncing
  --compare          Only compare counts, don't sync
  --verbose, -v      Show detailed progress
  --help, -h         Show this help message

Examples:
  node scripts/sync-production-to-staging.js                              # Interactive mode
  node scripts/sync-production-to-staging.js --tables=all                 # Sync all tables (full)
  node scripts/sync-production-to-staging.js --tables=all --incremental   # Sync only missing
  node scripts/sync-production-to-staging.js --tables=activities -i       # Incremental for one table
  node scripts/sync-production-to-staging.js --compare                    # Compare only
  node scripts/sync-production-to-staging.js --tables=all --dry-run -i    # Preview incremental

Available tables:
  ${SYNC_ORDER.join(', ')}

Tables supporting incremental sync:
  ${INCREMENTAL_TABLES.join(', ')}
`);
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const options = parseArgs();

  if (options.compare) {
    await compareTables();
    return;
  }

  if (options.tables) {
    // CLI mode with specific tables
    console.log('\n' + '='.repeat(60));
    console.log('🔄 Production to Staging Data Sync');
    console.log('='.repeat(60));
    console.log('\nProduction:', PRODUCTION_CONFIG.url);
    console.log('Staging:', STAGING_CONFIG.url);
    console.log('Mode:', options.dryRun ? 'DRY RUN' : 'LIVE SYNC');
    console.log('Sync Type:', options.incremental ? 'INCREMENTAL (only missing records)' : 'FULL (upsert all)');
    console.log('Tables:', options.tables.join(', '));

    const results = await syncAllTables(options.tables, {
      dryRun: options.dryRun,
      verbose: options.verbose,
      incremental: options.incremental
    });

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 Summary');
    console.log('='.repeat(60));

    for (const result of results) {
      const mode = result.mode === 'incremental' ? '[incremental]' : '[full]';
      if (result.success) {
        if (result.dryRun) {
          const count = result.missing ?? result.prodCount ?? 0;
          console.log(`${result.table} ${mode}: Would sync ${formatNumber(count)} records`);
        } else {
          console.log(`${result.table} ${mode}: Synced ${formatNumber(result.synced || 0)} records (${formatNumber(result.errors || 0)} errors)`);
        }
      } else {
        console.log(`${result.table} ${mode}: FAILED - ${result.error}`);
      }
    }
  } else {
    // Interactive mode
    await interactiveMode();
  }
}

main().catch(err => {
  log(`Fatal error: ${err.message}`, 'error');
  console.error(err);
  process.exit(1);
});
