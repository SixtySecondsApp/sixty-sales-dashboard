-- Create junction table for many-to-many relationship between meetings and contacts
-- This allows tracking all contacts that attended a meeting, not just the primary contact

CREATE TABLE IF NOT EXISTS meeting_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  role TEXT, -- 'organizer', 'attendee', 'guest', etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique meeting-contact pairs
  UNIQUE(meeting_id, contact_id)
);

-- Indexes for fast lookups
CREATE INDEX idx_meeting_contacts_meeting ON meeting_contacts(meeting_id);
CREATE INDEX idx_meeting_contacts_contact ON meeting_contacts(contact_id);
CREATE INDEX idx_meeting_contacts_primary ON meeting_contacts(is_primary) WHERE is_primary = true;

-- Add foreign key to meetings table for quick access to primary contact
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS primary_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_meetings_primary_contact ON meetings(primary_contact_id);

-- Add comments for documentation
COMMENT ON TABLE meeting_contacts IS 'Junction table linking meetings to all attending contacts (many-to-many)';
COMMENT ON COLUMN meeting_contacts.is_primary IS 'Indicates the primary external contact for this meeting';
COMMENT ON COLUMN meeting_contacts.role IS 'Role of contact in meeting: organizer, attendee, guest, etc.';
COMMENT ON COLUMN meetings.primary_contact_id IS 'Primary external contact for quick reference (denormalized from meeting_contacts)';

-- Create function to update contact meeting stats
CREATE OR REPLACE FUNCTION update_contact_meeting_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update total_meetings_count for the contact
  UPDATE contacts
  SET
    total_meetings_count = (
      SELECT COUNT(*)
      FROM meeting_contacts
      WHERE contact_id = NEW.contact_id
    ),
    last_interaction_at = (
      SELECT MAX(m.meeting_start)
      FROM meetings m
      JOIN meeting_contacts mc ON m.id = mc.meeting_id
      WHERE mc.contact_id = NEW.contact_id
    )
  WHERE id = NEW.contact_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update contact stats when meeting_contacts change
CREATE TRIGGER update_contact_stats_on_meeting_link
AFTER INSERT OR UPDATE ON meeting_contacts
FOR EACH ROW
EXECUTE FUNCTION update_contact_meeting_stats();

-- Also update when meeting_contacts are deleted
CREATE OR REPLACE FUNCTION update_contact_meeting_stats_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Update total_meetings_count for the contact
  UPDATE contacts
  SET
    total_meetings_count = (
      SELECT COUNT(*)
      FROM meeting_contacts
      WHERE contact_id = OLD.contact_id
    ),
    last_interaction_at = (
      SELECT MAX(m.meeting_start)
      FROM meetings m
      JOIN meeting_contacts mc ON m.id = mc.meeting_id
      WHERE mc.contact_id = OLD.contact_id
    )
  WHERE id = OLD.contact_id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_contact_stats_on_meeting_unlink
AFTER DELETE ON meeting_contacts
FOR EACH ROW
EXECUTE FUNCTION update_contact_meeting_stats_on_delete();
