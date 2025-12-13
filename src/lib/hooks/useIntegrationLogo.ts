import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/clientV2';

interface LogoResponse {
  logo_url: string | null;
  cached: boolean;
  error?: string;
}

// Map integration names to their official domains for logo.dev lookup
const INTEGRATION_DOMAINS: Record<string, string> = {
  // Google services
  google: 'google.com',
  gmail: 'gmail.com',
  'google-calendar': 'calendar.google.com',
  'google-drive': 'drive.google.com',
  'google-tasks': 'tasks.google.com',
  'google-workspace': 'workspace.google.com',
  'google-meet': 'meet.google.com',

  // Meeting Recorders
  fathom: 'fathom.video',
  fireflies: 'fireflies.ai',
  otter: 'otter.ai',
  granola: 'granola.so',
  gong: 'gong.io',
  chorus: 'chorus.ai',
  avoma: 'avoma.com',
  grain: 'grain.com',

  // Video Conferencing
  zoom: 'zoom.us',
  teams: 'microsoft.com',
  'microsoft-teams': 'teams.microsoft.com',
  webex: 'webex.com',

  // Calendar & Booking
  savvycal: 'savvycal.com',
  calendly: 'calendly.com',
  'cal-com': 'cal.com',
  acuity: 'acuityscheduling.com',
  doodle: 'doodle.com',
  outlook: 'outlook.com',
  'microsoft-outlook': 'outlook.com',

  // CRMs
  salesforce: 'salesforce.com',
  hubspot: 'hubspot.com',
  pipedrive: 'pipedrive.com',
  zoho: 'zoho.com',
  'zoho-crm': 'zoho.com',
  bullhorn: 'bullhorn.com',
  highlevel: 'gohighlevel.com',
  'go-highlevel': 'gohighlevel.com',
  close: 'close.com',
  'close-crm': 'close.com',
  copper: 'copper.com',
  freshsales: 'freshworks.com',
  'monday-crm': 'monday.com',
  attio: 'attio.com',
  folk: 'folk.app',

  // Dialers & Communication
  justcall: 'justcall.io',
  'just-call': 'justcall.io',
  ringover: 'ringover.com',
  cloudcall: 'cloudcall.com',
  '8x8': '8x8.com',
  aircall: 'aircall.io',
  dialpad: 'dialpad.com',
  ringcentral: 'ringcentral.com',
  vonage: 'vonage.com',
  twilio: 'twilio.com',

  // Team Communication
  slack: 'slack.com',
  discord: 'discord.com',
  intercom: 'intercom.com',
  crisp: 'crisp.chat',
  drift: 'drift.com',
  freshdesk: 'freshdesk.com',
  zendesk: 'zendesk.com',

  // Task & Project Management
  notion: 'notion.so',
  asana: 'asana.com',
  trello: 'trello.com',
  monday: 'monday.com',
  linear: 'linear.app',
  clickup: 'clickup.com',
  todoist: 'todoist.com',
  basecamp: 'basecamp.com',
  wrike: 'wrike.com',
  airtable: 'airtable.com',

  // Automation & No-Code
  zapier: 'zapier.com',
  make: 'make.com',
  integromat: 'make.com',
  n8n: 'n8n.io',
  tray: 'tray.io',
  workato: 'workato.com',
  webhooks: 'webhook.site',

  // Email Marketing & Outreach
  mailchimp: 'mailchimp.com',
  activecampaign: 'activecampaign.com',
  lemlist: 'lemlist.com',
  outreach: 'outreach.io',
  salesloft: 'salesloft.com',
  apollo: 'apollo.io',
  'instantly-ai': 'instantly.ai',
  woodpecker: 'woodpecker.co',
  sendgrid: 'sendgrid.com',
  mailgun: 'mailgun.com',
  klaviyo: 'klaviyo.com',
  brevo: 'brevo.com',
  convertkit: 'convertkit.com',

  // Sales Intelligence & Data
  linkedin: 'linkedin.com',
  'linkedin-sales-navigator': 'linkedin.com',
  zoominfo: 'zoominfo.com',
  clearbit: 'clearbit.com',
  lusha: 'lusha.com',
  'seamless-ai': 'seamless.ai',
  cognism: 'cognism.com',
  leadiq: 'leadiq.com',
  hunter: 'hunter.io',
  snov: 'snov.io',

  // E-Signature & Documents
  docusign: 'docusign.com',
  pandadoc: 'pandadoc.com',
  hellosign: 'hellosign.com',
  dropboxsign: 'sign.dropbox.com',
  proposify: 'proposify.com',
  qwilr: 'qwilr.com',
  better_proposals: 'betterproposals.io',

  // Payments & Billing
  stripe: 'stripe.com',
  paypal: 'paypal.com',
  quickbooks: 'quickbooks.intuit.com',
  xero: 'xero.com',
  freshbooks: 'freshbooks.com',
  chargebee: 'chargebee.com',
  paddle: 'paddle.com',
  recurly: 'recurly.com',

  // Analytics & BI
  mixpanel: 'mixpanel.com',
  amplitude: 'amplitude.com',
  segment: 'segment.com',
  'google-analytics': 'analytics.google.com',
  posthog: 'posthog.com',
  heap: 'heap.io',
  hotjar: 'hotjar.com',
  fullstory: 'fullstory.com',
  looker: 'looker.com',
  metabase: 'metabase.com',

  // AI & Productivity
  openai: 'openai.com',
  chatgpt: 'openai.com',
  anthropic: 'anthropic.com',
  claude: 'anthropic.com',
  jasper: 'jasper.ai',
  copy_ai: 'copy.ai',
  grammarly: 'grammarly.com',

  // Storage & Files
  dropbox: 'dropbox.com',
  box: 'box.com',
  onedrive: 'onedrive.live.com',

  // Development
  github: 'github.com',
  gitlab: 'gitlab.com',
  jira: 'atlassian.com',
  bitbucket: 'bitbucket.org',

  // Customer Success
  gainsight: 'gainsight.com',
  totango: 'totango.com',
  churnzero: 'churnzero.net',
  vitally: 'vitally.io',

  // Recruiting & HR
  greenhouse: 'greenhouse.io',
  lever: 'lever.co',
  workday: 'workday.com',
  bamboohr: 'bamboohr.com',
};

/**
 * Hook to fetch integration logos via logo.dev API (with S3 caching)
 * @param integrationId - The integration identifier (e.g., 'slack', 'fathom', 'google-workspace')
 * @returns Logo URL or null if not available
 */
export function useIntegrationLogo(integrationId: string | null | undefined) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!integrationId) {
      setLogoUrl(null);
      return;
    }

    // Get domain from mapping, or use integrationId as domain if not found
    const normalizedId = integrationId.toLowerCase().trim();
    const domain = INTEGRATION_DOMAINS[normalizedId] || `${normalizedId}.com`;

    if (!domain) {
      setLogoUrl(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setLogoUrl(null);

    // Fetch logo via edge function (uses logo.dev with S3 caching)
    supabase.functions
      .invoke<LogoResponse>('fetch-company-logo', {
        method: 'POST',
        body: { domain },
      })
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          setError(fetchError.message);
          setLogoUrl(null);
        } else if (data?.logo_url) {
          setLogoUrl(data.logo_url);
        } else {
          setLogoUrl(null);
        }
      })
      .catch((err) => {
        setError(err?.message || 'Failed to fetch logo');
        setLogoUrl(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [integrationId]);

  return { logoUrl, isLoading, error };
}

/**
 * Get domain for an integration ID (useful for direct URL construction)
 */
export function getIntegrationDomain(integrationId: string): string {
  const normalizedId = integrationId.toLowerCase().trim();
  return INTEGRATION_DOMAINS[normalizedId] || `${normalizedId}.com`;
}

/**
 * List of available integration domain mappings
 */
export const availableIntegrations = Object.keys(INTEGRATION_DOMAINS);
