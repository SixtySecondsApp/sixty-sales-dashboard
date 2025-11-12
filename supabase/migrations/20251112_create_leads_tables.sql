-- Create supporting tables for SavvyCal lead ingestion and rep preparation workflows
-- Includes lead sources, lead intake records, inbound event log, and prep notes

-- Ensure UUID generator extension exists (idempotent)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

--------------------------------------------------------------------------------
-- lead_sources: catalog describing inbound lead origins (ads, website, partner)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lead_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  channel TEXT,
  description TEXT,
  default_owner_id UUID REFERENCES profiles(id),
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_sources_channel ON lead_sources(channel);
CREATE INDEX IF NOT EXISTS idx_lead_sources_active ON lead_sources(is_active) WHERE is_active = true;

CREATE TRIGGER trg_update_lead_sources_updated_at
  BEFORE UPDATE ON lead_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE lead_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lead sources readable to authenticated users"
  ON lead_sources FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Lead sources manageable by service role"
  ON lead_sources FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

--------------------------------------------------------------------------------
-- leads: core intake table linking SavvyCal meetings to CRM context
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_source TEXT NOT NULL DEFAULT 'savvycal',
  external_id TEXT UNIQUE,
  external_occured_at TIMESTAMPTZ,
  source_id UUID REFERENCES lead_sources(id),
  source_channel TEXT,
  source_campaign TEXT,
  source_medium TEXT,
  booking_link_id TEXT,
  booking_link_slug TEXT,
  booking_link_name TEXT,
  booking_scope_slug TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'prepping', 'ready', 'converted', 'archived')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  enrichment_status TEXT NOT NULL DEFAULT 'pending' CHECK (enrichment_status IN ('pending', 'in_progress', 'completed', 'failed')),
  enrichment_provider TEXT,
  prep_status TEXT NOT NULL DEFAULT 'pending' CHECK (prep_status IN ('pending', 'in_progress', 'completed', 'failed')),
  prep_summary TEXT,
  owner_id UUID REFERENCES profiles(id),
  created_by UUID REFERENCES auth.users(id),
  converted_deal_id UUID REFERENCES deals(id),
  company_id UUID REFERENCES companies(id),
  contact_id UUID REFERENCES contacts(id),
  contact_name TEXT,
  contact_first_name TEXT,
  contact_last_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  contact_timezone TEXT,
  contact_marketing_opt_in BOOLEAN,
  scheduler_email TEXT,
  scheduler_name TEXT,
  domain TEXT,
  meeting_title TEXT,
  meeting_description TEXT,
  meeting_start TIMESTAMPTZ,
  meeting_end TIMESTAMPTZ,
  meeting_duration_minutes INTEGER,
  meeting_timezone TEXT,
  meeting_url TEXT,
  conferencing_type TEXT,
  conferencing_url TEXT,
  attendee_count INTEGER,
  external_attendee_emails TEXT[] DEFAULT '{}'::TEXT[],
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_leads_owner_id ON leads(owner_id);
CREATE INDEX IF NOT EXISTS idx_leads_contact_email ON leads(LOWER(contact_email));
CREATE INDEX IF NOT EXISTS idx_leads_domain ON leads(LOWER(domain));
CREATE INDEX IF NOT EXISTS idx_leads_source_id ON leads(source_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_prep_status ON leads(prep_status);
CREATE INDEX IF NOT EXISTS idx_leads_enrichment_status ON leads(enrichment_status);

CREATE TRIGGER trg_update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their leads"
  ON leads FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR (created_by IS NOT NULL AND created_by = auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND COALESCE(p.is_admin, false) = true
    )
  );

CREATE POLICY "Users can insert leads they create"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    OR owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND COALESCE(p.is_admin, false) = true
    )
  );

CREATE POLICY "Users can update leads they own"
  ON leads FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND COALESCE(p.is_admin, false) = true
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND COALESCE(p.is_admin, false) = true
    )
  );

CREATE POLICY "Users can soft delete leads they own"
  ON leads FOR DELETE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND COALESCE(p.is_admin, false) = true
    )
  );

--------------------------------------------------------------------------------
-- lead_events: append-only log of inbound SavvyCal webhooks / sync events
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lead_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  external_source TEXT NOT NULL DEFAULT 'savvycal',
  external_id TEXT,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  payload_hash TEXT,
  external_occured_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_events_lead_id ON lead_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_events_external_id ON lead_events(external_id);
CREATE INDEX IF NOT EXISTS idx_lead_events_event_type ON lead_events(event_type);

ALTER TABLE lead_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lead events visible to lead owners"
  ON lead_events FOR SELECT
  TO authenticated
  USING (
    lead_id IS NULL
    OR EXISTS (
      SELECT 1 FROM leads l
      WHERE l.id = lead_events.lead_id
        AND (
          l.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND COALESCE(p.is_admin, false) = true
          )
        )
    )
  );

CREATE POLICY "Lead events manageable by service role"
  ON lead_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

--------------------------------------------------------------------------------
-- lead_prep_notes: structured prep insights, tasks, and summaries for reps
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lead_prep_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  note_type TEXT NOT NULL CHECK (note_type IN ('summary', 'insight', 'question', 'task', 'resource')),
  title TEXT,
  body TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  is_auto_generated BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_prep_notes_lead_id ON lead_prep_notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_prep_notes_note_type ON lead_prep_notes(note_type);
CREATE INDEX IF NOT EXISTS idx_lead_prep_notes_created_at ON lead_prep_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_prep_notes_pinned ON lead_prep_notes(is_pinned) WHERE is_pinned = true;
CREATE INDEX IF NOT EXISTS idx_lead_prep_notes_auto ON lead_prep_notes(is_auto_generated) WHERE is_auto_generated = true;

CREATE TRIGGER trg_update_lead_prep_notes_updated_at
  BEFORE UPDATE ON lead_prep_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE lead_prep_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view prep notes for their leads"
  ON lead_prep_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leads l
      WHERE l.id = lead_prep_notes.lead_id
        AND (
          l.owner_id = auth.uid()
          OR (lead_prep_notes.created_by IS NOT NULL AND lead_prep_notes.created_by = auth.uid())
          OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND COALESCE(p.is_admin, false) = true
          )
        )
    )
  );

CREATE POLICY "Users can insert prep notes for accessible leads"
  ON lead_prep_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM leads l
      WHERE l.id = lead_prep_notes.lead_id
        AND (
          l.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND COALESCE(p.is_admin, false) = true
          )
        )
    )
  );

CREATE POLICY "Users can update their prep notes"
  ON lead_prep_notes FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND COALESCE(p.is_admin, false) = true
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND COALESCE(p.is_admin, false) = true
    )
  );

CREATE POLICY "Users can delete their prep notes"
  ON lead_prep_notes FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND COALESCE(p.is_admin, false) = true
    )
  );

CREATE POLICY "Prep notes manageable by service role"
  ON lead_prep_notes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

--------------------------------------------------------------------------------
-- lead analytics materialized view for dashboards
--------------------------------------------------------------------------------
CREATE OR REPLACE VIEW lead_source_summary AS
SELECT
  l.source_id,
  ls.source_key,
  ls.name AS source_name,
  COALESCE(l.source_channel, ls.channel) AS channel,
  COALESCE(l.source_medium, ls.utm_medium) AS medium,
  COALESCE(l.source_campaign, ls.utm_campaign) AS campaign,
  l.owner_id,
  COUNT(l.id) AS total_leads,
  COUNT(l.id) FILTER (WHERE l.status = 'converted') AS converted_leads,
  COUNT(l.id) FILTER (WHERE l.status = 'ready') AS ready_leads,
  COUNT(l.id) FILTER (WHERE l.status = 'prepping') AS prepping_leads,
  MIN(l.created_at) AS first_lead_at,
  MAX(l.created_at) AS last_lead_at
FROM leads l
LEFT JOIN lead_sources ls ON ls.id = l.source_id
WHERE l.deleted_at IS NULL
GROUP BY
  l.source_id,
  ls.source_key,
  ls.name,
  COALESCE(l.source_channel, ls.channel),
  COALESCE(l.source_medium, ls.utm_medium),
  COALESCE(l.source_campaign, ls.utm_campaign),
  l.owner_id;

COMMENT ON TABLE lead_sources IS 'Catalog of inbound lead sources and marketing channels';
COMMENT ON COLUMN lead_sources.source_key IS 'Stable slug used to map inbound webhook sources (e.g., website, linkedin_ads)';
COMMENT ON TABLE leads IS 'Inbound lead intake records generated from scheduling tools and manual capture';
COMMENT ON COLUMN leads.external_id IS 'External system identifier (SavvyCal event id)';
COMMENT ON COLUMN leads.owner_id IS 'Sales rep responsible for the lead';
COMMENT ON TABLE lead_events IS 'Append-only log of inbound webhook payloads for each lead';
COMMENT ON TABLE lead_prep_notes IS 'Structured prep insights and tasks generated for reps ahead of meetings';
COMMENT ON VIEW lead_source_summary IS 'Aggregated metrics summarising lead volume and outcomes by source/channel/owner';

