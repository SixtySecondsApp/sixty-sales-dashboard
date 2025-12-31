import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { CRMAdapter, EmailAdapter, MeetingAdapter, NotificationAdapter } from './types.ts';
import {
  createDbCrmAdapter,
  createDbEmailAdapter,
  createDbMeetingAdapter,
  createDbNotificationAdapter,
} from './dbAdapters.ts';

type SupabaseClient = ReturnType<typeof createClient>;

export interface AdapterBundle {
  crm: CRMAdapter;
  meetings: MeetingAdapter;
  email: EmailAdapter;
  notifications: NotificationAdapter;
}

/**
 * AdapterRegistry
 *
 * For now this returns DB-backed implementations.
 * The registry is shaped so we can later choose per-org based on connected integrations.
 */
export class AdapterRegistry {
  constructor(private client: SupabaseClient, private userId: string) {}

  async forOrg(_orgId: string | null): Promise<AdapterBundle> {
    return {
      crm: createDbCrmAdapter(this.client, this.userId),
      meetings: createDbMeetingAdapter(this.client, this.userId),
      email: createDbEmailAdapter(this.client, this.userId),
      notifications: createDbNotificationAdapter(this.client),
    };
  }
}

