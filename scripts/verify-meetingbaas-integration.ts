/**
 * MeetingBaas Integration Verification Script
 *
 * Verifies that the MeetingBaas integration can properly see and join Google Calendar events.
 * Runs comprehensive checks on:
 * - Calendar connection status
 * - Recording settings
 * - Upcoming calendar events
 * - Cron job setup
 * - Recent deployments
 *
 * Usage:
 *   npx tsx scripts/verify-meetingbaas-integration.ts [--org-id=<org_id>] [--user-id=<user_id>]
 *
 * If org-id and user-id are not provided, the script will check all organizations.
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '../src/lib/supabase/database.types';

// Load environment variables
import * as dotenv from 'dotenv';
// Try .env.local first, then fall back to .env
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}

// Create admin client for verification (server-side only)
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Parse command line arguments
const args = process.argv.slice(2);
const orgIdArg = args.find(arg => arg.startsWith('--org-id='));
const userIdArg = args.find(arg => arg.startsWith('--user-id='));
const targetOrgId = orgIdArg?.split('=')[1];
const targetUserId = userIdArg?.split('=')[1];

interface VerificationResult {
  passed: boolean;
  message: string;
  details?: any;
}

interface VerificationReport {
  timestamp: string;
  targetOrg?: string;
  targetUser?: string;
  coreChecks: {
    calendarConnection: VerificationResult;
    recordingSettings: VerificationResult;
    upcomingEvents: VerificationResult;
    eventsHaveOrgId: VerificationResult;
    cronJobExists: VerificationResult;
    serviceRoleKey: VerificationResult;
    recentDeployments: VerificationResult;
  };
  optionalChecks: {
    externalAttendeeFiltering: VerificationResult;
    leadTimeConfiguration: VerificationResult;
    webhookEvents: VerificationResult;
  };
  summary: {
    totalPassed: number;
    totalFailed: number;
    criticalIssues: string[];
    warnings: string[];
    recommendations: string[];
  };
}

async function main() {
  console.log('🔍 MeetingBaas Integration Verification\n');
  console.log('═'.repeat(60));

  if (targetOrgId) {
    console.log(`Target Organization: ${targetOrgId}`);
  }
  if (targetUserId) {
    console.log(`Target User: ${targetUserId}`);
  }
  console.log('═'.repeat(60));
  console.log('');

  const report: VerificationReport = {
    timestamp: new Date().toISOString(),
    targetOrg: targetOrgId,
    targetUser: targetUserId,
    coreChecks: {} as any,
    optionalChecks: {} as any,
    summary: {
      totalPassed: 0,
      totalFailed: 0,
      criticalIssues: [],
      warnings: [],
      recommendations: []
    }
  };

  // ============================================================================
  // Core Checks
  // ============================================================================

  console.log('📋 Running Core Checks...\n');

  // 1. Check Calendar Connection
  console.log('1️⃣  Checking calendar connection to MeetingBaas...');
  try {
    let query = supabase
      .from('meetingbaas_calendars')
      .select('*')
      .eq('is_active', true);

    if (targetUserId) {
      query = query.eq('user_id', targetUserId);
    }

    const { data: calendars, error } = await query;

    if (error) throw error;

    report.coreChecks.calendarConnection = {
      passed: calendars && calendars.length > 0,
      message: calendars && calendars.length > 0
        ? `✅ Found ${calendars.length} active calendar connection(s)`
        : '❌ No active calendar connections found',
      details: calendars
    };

    if (!calendars || calendars.length === 0) {
      report.summary.criticalIssues.push('No calendar connected to MeetingBaas');
    }
  } catch (err: any) {
    report.coreChecks.calendarConnection = {
      passed: false,
      message: `❌ Error checking calendar connection: ${err.message}`,
      details: err
    };
    report.summary.criticalIssues.push('Failed to query meetingbaas_calendars table');
  }

  console.log(`   ${report.coreChecks.calendarConnection.message}\n`);

  // 2. Check Recording Settings
  console.log('2️⃣  Checking organization recording settings...');
  try {
    let query = supabase
      .from('organizations')
      .select('id, name, recording_settings');

    if (targetOrgId) {
      query = query.eq('id', targetOrgId);
    }

    const { data: orgs, error } = await query;

    if (error) throw error;

    const orgResults: any[] = [];
    orgs?.forEach(org => {
      const settings = org.recording_settings as any || {};
      const autoEnabled = settings.auto_record_enabled === true;
      const hasWebhookToken = !!settings.webhook_token;
      const leadTime = settings.auto_record_lead_time_minutes || 2;

      orgResults.push({
        id: org.id,
        name: org.name,
        auto_record_enabled: autoEnabled,
        has_webhook_token: hasWebhookToken,
        lead_time_minutes: leadTime
      });

      if (!autoEnabled) {
        report.summary.criticalIssues.push(`Org "${org.name}": auto_record_enabled is false`);
      }
      if (!hasWebhookToken) {
        report.summary.warnings.push(`Org "${org.name}": Missing webhook token (will be auto-generated)`);
      }
    });

    const enabledCount = orgResults.filter(o => o.auto_record_enabled).length;
    const totalCount = orgResults.length;

    report.coreChecks.recordingSettings = {
      passed: enabledCount > 0,
      message: enabledCount > 0
        ? `✅ ${enabledCount}/${totalCount} organization(s) have auto-record enabled`
        : `❌ No organizations have auto-record enabled`,
      details: orgResults
    };
  } catch (err: any) {
    report.coreChecks.recordingSettings = {
      passed: false,
      message: `❌ Error checking recording settings: ${err.message}`,
      details: err
    };
    report.summary.criticalIssues.push('Failed to query organization settings');
  }

  console.log(`   ${report.coreChecks.recordingSettings.message}\n`);

  // 3. Check Upcoming Calendar Events with Meeting URLs
  console.log('3️⃣  Checking upcoming calendar events with meeting URLs...');
  try {
    let query = supabase
      .from('calendar_events')
      .select('id, external_id, title, start_time, meeting_url, org_id, user_id')
      .gt('start_time', new Date().toISOString())
      .not('meeting_url', 'is', null)
      .order('start_time', { ascending: true })
      .limit(10);

    if (targetOrgId) {
      query = query.eq('org_id', targetOrgId);
    }
    if (targetUserId) {
      query = query.eq('user_id', targetUserId);
    }

    const { data: events, error } = await query;

    if (error) throw error;

    report.coreChecks.upcomingEvents = {
      passed: events && events.length > 0,
      message: events && events.length > 0
        ? `✅ Found ${events.length} upcoming event(s) with meeting URLs`
        : '⚠️  No upcoming events with meeting URLs found',
      details: events?.map(e => ({
        id: e.id,
        title: e.title,
        start_time: e.start_time,
        meeting_url: e.meeting_url,
        org_id: e.org_id
      }))
    };

    if (!events || events.length === 0) {
      report.summary.warnings.push('No upcoming meetings to join (may be expected)');
    }
  } catch (err: any) {
    report.coreChecks.upcomingEvents = {
      passed: false,
      message: `❌ Error checking upcoming events: ${err.message}`,
      details: err
    };
  }

  console.log(`   ${report.coreChecks.upcomingEvents.message}\n`);

  // 4. Check if Calendar Events have org_id populated
  console.log('4️⃣  Checking if calendar events have org_id populated...');
  try {
    const { count, error } = await supabase
      .from('calendar_events')
      .select('*', { count: 'exact', head: true })
      .is('org_id', null);

    if (error) throw error;

    report.coreChecks.eventsHaveOrgId = {
      passed: count === 0,
      message: count === 0
        ? '✅ All calendar events have org_id populated'
        : `❌ Found ${count} calendar event(s) with missing org_id`,
      details: { missing_org_id_count: count }
    };

    if (count && count > 0) {
      report.summary.criticalIssues.push(`${count} calendar events missing org_id (required for scheduler)`);
    }
  } catch (err: any) {
    report.coreChecks.eventsHaveOrgId = {
      passed: false,
      message: `❌ Error checking org_id: ${err.message}`,
      details: err
    };
  }

  console.log(`   ${report.coreChecks.eventsHaveOrgId.message}\n`);

  // 5. Check Cron Job Exists
  console.log('5️⃣  Checking if auto-join-scheduler cron job exists...');
  try {
    const { data: cronJobs, error } = await supabase.rpc('pg_cron_jobs' as any).select('*');

    // Note: This RPC might not exist or might require special permissions
    // Fallback to checking job table directly
    const { data: jobs, error: jobError } = await supabase
      .from('cron.job' as any)
      .select('*')
      .eq('jobname', 'auto-join-scheduler')
      .maybeSingle();

    if (jobError && jobError.code !== 'PGRST116') {
      // Different error than "not found"
      throw jobError;
    }

    report.coreChecks.cronJobExists = {
      passed: !!jobs,
      message: jobs
        ? `✅ Cron job "auto-join-scheduler" exists (schedule: ${jobs.schedule})`
        : '❌ Cron job "auto-join-scheduler" not found',
      details: jobs || { error: 'Table might not be accessible - check pg_cron extension' }
    };

    if (!jobs) {
      report.summary.criticalIssues.push('Cron job not configured - bots will not auto-join');
      report.summary.recommendations.push('Run migration: 20260104210000_auto_join_scheduler_cron.sql');
    }
  } catch (err: any) {
    report.coreChecks.cronJobExists = {
      passed: false,
      message: `⚠️  Cannot verify cron job (may need superuser permissions): ${err.message}`,
      details: err
    };
    report.summary.warnings.push('Cannot access cron.job table - check manually in Supabase Dashboard');
  }

  console.log(`   ${report.coreChecks.cronJobExists.message}\n`);

  // 6. Check Service Role Key in Vault
  console.log('6️⃣  Checking if service role key exists in vault...');
  try {
    const { data: secrets, error } = await supabase
      .from('vault.secrets' as any)
      .select('name')
      .eq('name', 'service_role_key')
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    report.coreChecks.serviceRoleKey = {
      passed: !!secrets,
      message: secrets
        ? '✅ Service role key found in vault'
        : '❌ Service role key not found in vault',
      details: secrets || { note: 'Cron job will fail without this key' }
    };

    if (!secrets) {
      report.summary.criticalIssues.push('Service role key missing from vault - cron won\'t authenticate');
      report.summary.recommendations.push('Add service_role_key to vault: Dashboard → Settings → Vault');
    }
  } catch (err: any) {
    report.coreChecks.serviceRoleKey = {
      passed: false,
      message: `⚠️  Cannot verify vault secrets (may need superuser permissions): ${err.message}`,
      details: err
    };
    report.summary.warnings.push('Cannot access vault.secrets table - check manually in Supabase Dashboard');
  }

  console.log(`   ${report.coreChecks.serviceRoleKey.message}\n`);

  // 7. Check Recent Recording Deployments
  console.log('7️⃣  Checking recent recording deployments...');
  try {
    let query = supabase
      .from('recordings')
      .select('id, status, meeting_title, calendar_event_id, created_at, error_message')
      .not('calendar_event_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (targetOrgId) {
      query = query.eq('org_id', targetOrgId);
    }

    const { data: recordings, error } = await query;

    if (error) throw error;

    const pendingCount = recordings?.filter(r => r.status === 'pending' || r.status === 'bot_joining').length || 0;
    const failedCount = recordings?.filter(r => r.status === 'failed').length || 0;
    const successCount = recordings?.filter(r => r.status === 'ready' || r.status === 'recording').length || 0;

    report.coreChecks.recentDeployments = {
      passed: recordings && recordings.length > 0,
      message: recordings && recordings.length > 0
        ? `✅ Found ${recordings.length} recent recording(s) (${successCount} successful, ${pendingCount} pending, ${failedCount} failed)`
        : '⚠️  No recent recording deployments (may be expected if no meetings scheduled)',
      details: {
        total: recordings?.length || 0,
        successful: successCount,
        pending: pendingCount,
        failed: failedCount,
        recent: recordings?.slice(0, 5).map(r => ({
          id: r.id,
          status: r.status,
          title: r.meeting_title,
          created_at: r.created_at,
          error: r.error_message
        }))
      }
    };

    if (failedCount > 0) {
      report.summary.warnings.push(`${failedCount} recording deployment(s) failed - check error messages`);
    }
  } catch (err: any) {
    report.coreChecks.recentDeployments = {
      passed: false,
      message: `❌ Error checking recent deployments: ${err.message}`,
      details: err
    };
  }

  console.log(`   ${report.coreChecks.recentDeployments.message}\n`);

  // ============================================================================
  // Optional Checks
  // ============================================================================

  console.log('\n🔍 Running Optional Checks...\n');

  // 8. External Attendee Filtering
  console.log('8️⃣  Checking external attendee filtering configuration...');
  try {
    let query = supabase
      .from('organizations')
      .select('id, name, company_domain, recording_settings');

    if (targetOrgId) {
      query = query.eq('id', targetOrgId);
    }

    const { data: orgs, error } = await query;

    if (error) throw error;

    const filteringEnabled = orgs?.filter(o => {
      const settings = o.recording_settings as any || {};
      return settings.auto_record_external_only === true;
    });

    const missingDomain = filteringEnabled?.filter(o => !o.company_domain);

    report.optionalChecks.externalAttendeeFiltering = {
      passed: !missingDomain || missingDomain.length === 0,
      message: missingDomain && missingDomain.length > 0
        ? `⚠️  ${missingDomain.length} org(s) have external filtering enabled but missing company_domain`
        : filteringEnabled && filteringEnabled.length > 0
          ? `✅ External filtering configured for ${filteringEnabled.length} org(s)`
          : 'ℹ️  External attendee filtering not enabled',
      details: {
        enabled_count: filteringEnabled?.length || 0,
        missing_domain: missingDomain?.map(o => ({ id: o.id, name: o.name }))
      }
    };

    if (missingDomain && missingDomain.length > 0) {
      report.summary.warnings.push('External filtering enabled but company_domain not set - will record all meetings');
    }
  } catch (err: any) {
    report.optionalChecks.externalAttendeeFiltering = {
      passed: true,
      message: `⚠️  Could not check external filtering: ${err.message}`,
      details: err
    };
  }

  console.log(`   ${report.optionalChecks.externalAttendeeFiltering.message}\n`);

  // 9. Lead Time Configuration
  console.log('9️⃣  Checking lead time configuration...');
  try {
    let query = supabase
      .from('organizations')
      .select('id, name, recording_settings');

    if (targetOrgId) {
      query = query.eq('id', targetOrgId);
    }

    const { data: orgs, error } = await query;

    if (error) throw error;

    const leadTimes = orgs?.map(o => {
      const settings = o.recording_settings as any || {};
      return {
        org: o.name,
        lead_time: settings.auto_record_lead_time_minutes || 2
      };
    });

    const avgLeadTime = leadTimes?.reduce((sum, lt) => sum + lt.lead_time, 0) / (leadTimes?.length || 1);

    report.optionalChecks.leadTimeConfiguration = {
      passed: true,
      message: `ℹ️  Average lead time: ${avgLeadTime.toFixed(1)} minutes`,
      details: leadTimes
    };

    if (avgLeadTime > 5) {
      report.summary.recommendations.push('Consider reducing lead time to 2-3 minutes for better join timing');
    }
  } catch (err: any) {
    report.optionalChecks.leadTimeConfiguration = {
      passed: true,
      message: `⚠️  Could not check lead time: ${err.message}`,
      details: err
    };
  }

  console.log(`   ${report.optionalChecks.leadTimeConfiguration.message}\n`);

  // 10. Webhook Events
  console.log('🔟  Checking recent webhook events...');
  try {
    const { data: webhooks, error } = await supabase
      .from('webhook_events')
      .select('id, event_type, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    report.optionalChecks.webhookEvents = {
      passed: true,
      message: webhooks && webhooks.length > 0
        ? `✅ Received ${webhooks.length} recent webhook event(s)`
        : 'ℹ️  No recent webhook events (expected if no meetings joined yet)',
      details: webhooks?.slice(0, 5).map(w => ({
        type: w.event_type,
        received_at: w.created_at
      }))
    };
  } catch (err: any) {
    report.optionalChecks.webhookEvents = {
      passed: true,
      message: `ℹ️  Could not check webhook events: ${err.message}`,
      details: err
    };
  }

  console.log(`   ${report.optionalChecks.webhookEvents.message}\n`);

  // ============================================================================
  // Summary
  // ============================================================================

  console.log('\n═'.repeat(60));
  console.log('📊 Verification Summary\n');

  const allChecks = [
    ...Object.values(report.coreChecks),
    ...Object.values(report.optionalChecks)
  ];

  report.summary.totalPassed = allChecks.filter(c => c.passed).length;
  report.summary.totalFailed = allChecks.filter(c => !c.passed).length;

  console.log(`✅ Passed: ${report.summary.totalPassed}/${allChecks.length}`);
  console.log(`❌ Failed: ${report.summary.totalFailed}/${allChecks.length}\n`);

  if (report.summary.criticalIssues.length > 0) {
    console.log('🚨 Critical Issues:\n');
    report.summary.criticalIssues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue}`);
    });
    console.log('');
  }

  if (report.summary.warnings.length > 0) {
    console.log('⚠️  Warnings:\n');
    report.summary.warnings.forEach((warning, i) => {
      console.log(`   ${i + 1}. ${warning}`);
    });
    console.log('');
  }

  if (report.summary.recommendations.length > 0) {
    console.log('💡 Recommendations:\n');
    report.summary.recommendations.forEach((rec, i) => {
      console.log(`   ${i + 1}. ${rec}`);
    });
    console.log('');
  }

  console.log('═'.repeat(60));

  // Overall assessment
  if (report.summary.criticalIssues.length === 0) {
    console.log('\n✅ Integration Status: HEALTHY');
    console.log('   MeetingBaas should be able to see and join calendar events.');
  } else {
    console.log('\n❌ Integration Status: NEEDS ATTENTION');
    console.log(`   ${report.summary.criticalIssues.length} critical issue(s) must be resolved.`);
  }

  console.log('');

  // Save report to file
  const reportPath = `./verification-report-${Date.now()}.json`;
  const fs = await import('fs');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Full report saved to: ${reportPath}\n`);
}

main().catch(err => {
  console.error('\n❌ Verification failed with error:', err);
  process.exit(1);
});
