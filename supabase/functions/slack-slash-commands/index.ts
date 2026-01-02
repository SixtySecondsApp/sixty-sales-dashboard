// supabase/functions/slack-slash-commands/index.ts
// Main handler for /sixty and /60 slash commands

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import {
  verifySlackSignature,
  parseSlashCommandPayload,
  parseCommandText,
  getSlackOrgConnection,
  getSixtyUserContext,
  sendEphemeral,
  buildErrorResponse,
  buildHelpMessage,
  buildLoadingResponse,
  type SlashCommandPayload,
  type SixtyUserContext,
  type SlackOrgConnection,
} from '../_shared/slackAuth.ts';

// Import command handlers
import { handleToday } from './handlers/today.ts';
import { handleContact } from './handlers/contact.ts';
import { handleDeal } from './handlers/deal.ts';
import { handleMeetingBrief } from './handlers/meetingBrief.ts';
import { handleFollowUp } from './handlers/followUp.ts';
import { handleRisks } from './handlers/risks.ts';

// ============================================================================
// Environment
// ============================================================================

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const appUrl = Deno.env.get('APP_URL') || Deno.env.get('SITE_URL') || 'https://app.use60.com';

// ============================================================================
// Types
// ============================================================================

export interface CommandContext {
  supabase: SupabaseClient;
  payload: SlashCommandPayload;
  userContext: SixtyUserContext;
  orgConnection: SlackOrgConnection;
  appUrl: string;
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Read body as text for signature verification
    const rawBody = await req.text();

    // Verify Slack signature
    const timestamp = req.headers.get('X-Slack-Request-Timestamp') || '';
    const signature = req.headers.get('X-Slack-Signature') || '';

    const isValid = await verifySlackSignature(rawBody, timestamp, signature);
    if (!isValid) {
      console.error('Invalid Slack signature');
      return new Response('Invalid signature', { status: 401 });
    }

    // Parse slash command payload
    const payload = parseSlashCommandPayload(rawBody);
    if (!payload) {
      console.error('Failed to parse slash command payload');
      return new Response('Invalid payload', { status: 400 });
    }

    console.log(`Slash command received: ${payload.command} ${payload.text} from user ${payload.user_id}`);

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get org connection (bot token)
    const orgConnection = await getSlackOrgConnection(supabase, payload.team_id);
    if (!orgConnection) {
      return jsonResponse(buildErrorResponse(
        'Slack workspace not connected to Sixty. Please connect via Settings → Integrations.'
      ));
    }

    // Get Sixty user context
    const userContext = await getSixtyUserContext(supabase, payload.user_id, payload.team_id);
    if (!userContext) {
      return jsonResponse(buildErrorResponse(
        'Your Slack account is not linked to Sixty. Use `/sixty connect` or link via Settings → Profile.'
      ));
    }

    // Parse subcommand
    const { subcommand, args, rawArgs } = parseCommandText(payload.text);

    // Build context for handlers
    const ctx: CommandContext = {
      supabase,
      payload,
      userContext,
      orgConnection,
      appUrl,
    };

    // Route to appropriate handler
    return await routeCommand(ctx, subcommand, args, rawArgs);

  } catch (error) {
    console.error('Error handling slash command:', error);
    return jsonResponse(buildErrorResponse(
      'Something went wrong. Please try again or contact support.'
    ));
  }
});

// ============================================================================
// Command Router
// ============================================================================

async function routeCommand(
  ctx: CommandContext,
  subcommand: string,
  args: string[],
  rawArgs: string
): Promise<Response> {
  switch (subcommand) {
    case '':
    case 'help':
      // No subcommand or help → show help message
      return jsonResponse(buildHelpMessage());

    case 'today':
      // Day-at-a-glance
      return await handleTodayCommand(ctx);

    case 'contact':
      // Contact lookup
      if (!rawArgs) {
        return jsonResponse(buildErrorResponse(
          'Please specify a contact to look up. Example: `/sixty contact john@acme.com`'
        ));
      }
      return await handleContactCommand(ctx, rawArgs);

    case 'deal':
      // Deal snapshot
      if (!rawArgs) {
        return jsonResponse(buildErrorResponse(
          'Please specify a deal to look up. Example: `/sixty deal Acme Corp`'
        ));
      }
      return await handleDealCommand(ctx, rawArgs);

    case 'meeting-brief':
    case 'meeting':
    case 'prep':
      // Meeting prep (aliases: meeting-brief, meeting, prep)
      return await handleMeetingBriefCommand(ctx, rawArgs || 'next');

    case 'follow-up':
    case 'followup':
    case 'fu':
      // Draft follow-up (aliases: follow-up, followup, fu)
      if (!rawArgs) {
        return jsonResponse(buildErrorResponse(
          'Please specify who to follow up with. Example: `/sixty follow-up John at Acme`'
        ));
      }
      return await handleFollowUpCommand(ctx, rawArgs);

    case 'risks':
    case 'risk':
    case 'stale':
      // At-risk and stale deals (aliases: risks, risk, stale)
      return await handleRisksCommand(ctx, rawArgs || '');

    default:
      // Unknown command → show help with suggestion
      return jsonResponse({
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `❓ Unknown command: \`${subcommand}\`\n\nDid you mean one of these?`,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: getSuggestion(subcommand),
            },
          },
          {
            type: 'context',
            elements: [
              { type: 'mrkdwn', text: 'Use `/sixty help` to see all available commands.' },
            ],
          },
        ],
        text: `Unknown command: ${subcommand}. Use /sixty help for available commands.`,
      });
  }
}

// ============================================================================
// Command Handlers (wrappers with async response handling)
// ============================================================================

/**
 * Handle /sixty today
 * Sends loading message immediately, then fetches data and sends full response
 */
async function handleTodayCommand(ctx: CommandContext): Promise<Response> {
  // Send immediate loading response (Slack requires response within 3 seconds)
  const loadingResponse = buildLoadingResponse('Fetching your day at a glance...');

  // Process in background and send update via response_url
  processInBackground(async () => {
    try {
      const response = await handleToday(ctx);
      await sendEphemeral(ctx.payload.response_url, response);
    } catch (error) {
      console.error('Error in handleToday:', error);
      await sendEphemeral(ctx.payload.response_url, buildErrorResponse(
        'Failed to load your day. Please try again.'
      ));
    }
  });

  return jsonResponse(loadingResponse);
}

/**
 * Handle /sixty contact <query>
 */
async function handleContactCommand(ctx: CommandContext, query: string): Promise<Response> {
  const loadingResponse = buildLoadingResponse(`Searching for "${query}"...`);

  processInBackground(async () => {
    try {
      const response = await handleContact(ctx, query);
      await sendEphemeral(ctx.payload.response_url, response);
    } catch (error) {
      console.error('Error in handleContact:', error);
      await sendEphemeral(ctx.payload.response_url, buildErrorResponse(
        'Failed to search contacts. Please try again.'
      ));
    }
  });

  return jsonResponse(loadingResponse);
}

/**
 * Handle /sixty deal <query>
 */
async function handleDealCommand(ctx: CommandContext, query: string): Promise<Response> {
  const loadingResponse = buildLoadingResponse(`Searching for "${query}"...`);

  processInBackground(async () => {
    try {
      const response = await handleDeal(ctx, query);
      await sendEphemeral(ctx.payload.response_url, response);
    } catch (error) {
      console.error('Error in handleDeal:', error);
      await sendEphemeral(ctx.payload.response_url, buildErrorResponse(
        'Failed to search deals. Please try again.'
      ));
    }
  });

  return jsonResponse(loadingResponse);
}

/**
 * Handle /sixty meeting-brief [next|today|name]
 */
async function handleMeetingBriefCommand(ctx: CommandContext, target: string): Promise<Response> {
  const loadingResponse = buildLoadingResponse('Preparing meeting brief...');

  processInBackground(async () => {
    try {
      const response = await handleMeetingBrief(ctx, target);
      await sendEphemeral(ctx.payload.response_url, response);
    } catch (error) {
      console.error('Error in handleMeetingBrief:', error);
      await sendEphemeral(ctx.payload.response_url, buildErrorResponse(
        'Failed to load meeting brief. Please try again.'
      ));
    }
  });

  return jsonResponse(loadingResponse);
}

/**
 * Handle /sixty follow-up <person/company>
 */
async function handleFollowUpCommand(ctx: CommandContext, target: string): Promise<Response> {
  const loadingResponse = buildLoadingResponse('Drafting follow-up...');

  processInBackground(async () => {
    try {
      const response = await handleFollowUp(ctx, target);
      await sendEphemeral(ctx.payload.response_url, response);
    } catch (error) {
      console.error('Error in handleFollowUp:', error);
      await sendEphemeral(ctx.payload.response_url, buildErrorResponse(
        'Failed to draft follow-up. Please try again.'
      ));
    }
  });

  return jsonResponse(loadingResponse);
}

/**
 * Handle /sixty risks [stale|closing|all]
 */
async function handleRisksCommand(ctx: CommandContext, filter: string): Promise<Response> {
  const loadingResponse = buildLoadingResponse('Analyzing pipeline risks...');

  processInBackground(async () => {
    try {
      const response = await handleRisks(ctx, filter);
      await sendEphemeral(ctx.payload.response_url, response);
    } catch (error) {
      console.error('Error in handleRisks:', error);
      await sendEphemeral(ctx.payload.response_url, buildErrorResponse(
        'Failed to fetch at-risk deals. Please try again.'
      ));
    }
  });

  return jsonResponse(loadingResponse);
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Create JSON response for Slack
 */
function jsonResponse(body: { blocks: unknown[]; text: string }): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Process work in background (fire and forget)
 * Important: Slack requires response within 3 seconds
 */
function processInBackground(fn: () => Promise<void>): void {
  // Use setTimeout to not block the response
  setTimeout(() => {
    fn().catch(err => console.error('Background processing error:', err));
  }, 0);
}

/**
 * Get command suggestion based on input (fuzzy match)
 */
function getSuggestion(input: string): string {
  const commands = [
    { cmd: 'today', desc: 'Your day at a glance' },
    { cmd: 'contact', desc: 'Look up a contact' },
    { cmd: 'deal', desc: 'Deal snapshot' },
    { cmd: 'meeting-brief', desc: 'Meeting prep' },
    { cmd: 'follow-up', desc: 'Draft a follow-up' },
    { cmd: 'risks', desc: 'At-risk deals' },
  ];

  // Simple fuzzy match - find commands that start with same letter or contain the input
  const suggestions = commands.filter(c =>
    c.cmd.startsWith(input[0]) ||
    c.cmd.includes(input) ||
    input.includes(c.cmd.slice(0, 3))
  );

  if (suggestions.length > 0) {
    return suggestions.map(s => `• \`/sixty ${s.cmd}\` - ${s.desc}`).join('\n');
  }

  // Default: show all commands
  return commands.map(c => `• \`/sixty ${c.cmd}\` - ${c.desc}`).join('\n');
}
