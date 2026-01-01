import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { CRMAdapter, EmailAdapter, EnrichmentAdapter, MeetingAdapter, NotificationAdapter } from './types.ts';
import {
  createDbCrmAdapter,
  createDbEmailAdapter,
  createDbMeetingAdapter,
  createDbNotificationAdapter,
  createEnrichmentAdapter,
} from './dbAdapters.ts';
import {
  hasHubSpotIntegration,
  getHubSpotClientForOrg,
  createHubSpotCrmAdapter,
} from './hubspotAdapters.ts';

type SupabaseClient = ReturnType<typeof createClient>;

export interface AdapterBundle {
  crm: CRMAdapter;
  meetings: MeetingAdapter;
  email: EmailAdapter;
  notifications: NotificationAdapter;
  enrichment: EnrichmentAdapter;
}

/**
 * Composite CRM Adapter
 * Searches both local DB and HubSpot, merging results
 */
function createCompositeCrmAdapter(dbAdapter: CRMAdapter, hubspotAdapter: CRMAdapter | null): CRMAdapter {
  if (!hubspotAdapter) return dbAdapter;

  return {
    source: 'composite_crm',
    async getContact(params) {
      // Query both sources in parallel
      const [dbResult, hsResult] = await Promise.all([
        dbAdapter.getContact(params),
        hubspotAdapter.getContact(params).catch(() => ({ success: false, data: { contacts: [] }, source: 'hubspot_crm' })),
      ]);

      const dbContacts = dbResult.success && dbResult.data?.contacts ? dbResult.data.contacts : [];
      const hsContacts = hsResult.success && hsResult.data?.contacts ? hsResult.data.contacts : [];

      // Merge and dedupe by email
      const seenEmails = new Set<string>();
      const merged: any[] = [];

      // Prefer DB records first (they're local)
      for (const c of dbContacts) {
        const email = c.email?.toLowerCase();
        if (email && !seenEmails.has(email)) {
          seenEmails.add(email);
          merged.push({ ...c, source: 'local_crm' });
        } else if (!email) {
          merged.push({ ...c, source: 'local_crm' });
        }
      }

      // Add HubSpot records not in local DB
      for (const c of hsContacts) {
        const email = c.email?.toLowerCase();
        if (email && !seenEmails.has(email)) {
          seenEmails.add(email);
          merged.push({ ...c, source: 'hubspot' });
        } else if (!email) {
          merged.push({ ...c, source: 'hubspot' });
        }
      }

      return {
        success: true,
        data: { contacts: merged, sources: ['local_crm', 'hubspot'] },
        source: 'composite_crm',
      };
    },

    async getDeal(params) {
      // Query both sources in parallel
      const [dbResult, hsResult] = await Promise.all([
        dbAdapter.getDeal(params),
        hubspotAdapter.getDeal(params).catch(() => ({ success: false, data: { deals: [] }, source: 'hubspot_crm' })),
      ]);

      const dbDeals = dbResult.success && dbResult.data?.deals ? dbResult.data.deals : [];
      const hsDeals = hsResult.success && hsResult.data?.deals ? hsResult.data.deals : [];

      // Merge and dedupe by name (rough dedupe)
      const seenNames = new Set<string>();
      const merged: any[] = [];

      for (const d of dbDeals) {
        const name = d.name?.toLowerCase();
        if (name && !seenNames.has(name)) {
          seenNames.add(name);
          merged.push({ ...d, source: 'local_crm' });
        } else if (!name) {
          merged.push({ ...d, source: 'local_crm' });
        }
      }

      for (const d of hsDeals) {
        const name = d.name?.toLowerCase();
        if (name && !seenNames.has(name)) {
          seenNames.add(name);
          merged.push({ ...d, source: 'hubspot' });
        } else if (!name) {
          merged.push({ ...d, source: 'hubspot' });
        }
      }

      return {
        success: true,
        data: { deals: merged, sources: ['local_crm', 'hubspot'] },
        source: 'composite_crm',
      };
    },

    async updateCRM(params, ctx) {
      // Updates go to local DB only for now
      return dbAdapter.updateCRM(params, ctx);
    },
  };
}

/**
 * AdapterRegistry
 *
 * Returns adapters based on organization's connected integrations.
 * - If HubSpot is connected: composite adapter searches both DB and HubSpot
 * - Otherwise: DB-only adapters
 */
export class AdapterRegistry {
  constructor(private client: SupabaseClient, private userId: string) {}

  async forOrg(orgId: string | null): Promise<AdapterBundle> {
    const dbCrmAdapter = createDbCrmAdapter(this.client, this.userId);

    // Check if HubSpot is connected for this org
    let hubspotCrmAdapter: CRMAdapter | null = null;
    if (orgId) {
      const hasHubSpot = await hasHubSpotIntegration(this.client, orgId);
      if (hasHubSpot) {
        const hubspotClient = await getHubSpotClientForOrg(this.client, orgId);
        if (hubspotClient) {
          hubspotCrmAdapter = createHubSpotCrmAdapter(this.client, orgId, hubspotClient);
        }
      }
    }

    return {
      crm: createCompositeCrmAdapter(dbCrmAdapter, hubspotCrmAdapter),
      meetings: createDbMeetingAdapter(this.client, this.userId),
      email: createDbEmailAdapter(this.client, this.userId),
      notifications: createDbNotificationAdapter(this.client),
      enrichment: createEnrichmentAdapter(),
    };
  }
}

