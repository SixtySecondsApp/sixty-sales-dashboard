-- Create contact_notes table for storing notes related to contacts
CREATE TABLE IF NOT EXISTS contact_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_pinned BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}'::TEXT[],

  -- Constraints
  CHECK (LENGTH(TRIM(title)) > 0),
  CHECK (LENGTH(TRIM(content)) > 0)
);

-- Create indexes for better performance
CREATE INDEX idx_contact_notes_contact_id ON contact_notes(contact_id);
CREATE INDEX idx_contact_notes_created_by ON contact_notes(created_by);
CREATE INDEX idx_contact_notes_created_at ON contact_notes(created_at DESC);
CREATE INDEX idx_contact_notes_is_pinned ON contact_notes(is_pinned) WHERE is_pinned = true;
CREATE INDEX idx_contact_notes_tags ON contact_notes USING GIN(tags);

-- Composite indexes for common queries
CREATE INDEX idx_contact_notes_contact_pinned ON contact_notes(contact_id, is_pinned DESC, created_at DESC);
CREATE INDEX idx_contact_notes_contact_created ON contact_notes(contact_id, created_at DESC);

-- Create updated_at trigger
CREATE TRIGGER update_contact_notes_updated_at
    BEFORE UPDATE ON contact_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE contact_notes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can view notes for contacts they have access to
CREATE POLICY "Users can view contact notes they have access to" ON contact_notes
    FOR SELECT USING (
        contact_id IN (
            SELECT id FROM contacts
            WHERE user_id = auth.uid()
        )
    );

-- Users can create notes for contacts they have access to
CREATE POLICY "Users can create contact notes for accessible contacts" ON contact_notes
    FOR INSERT WITH CHECK (
        created_by = auth.uid()
        AND contact_id IN (
            SELECT id FROM contacts
            WHERE user_id = auth.uid()
        )
    );

-- Users can update their own notes for contacts they have access to
CREATE POLICY "Users can update their own contact notes" ON contact_notes
    FOR UPDATE USING (
        created_by = auth.uid()
        AND contact_id IN (
            SELECT id FROM contacts
            WHERE user_id = auth.uid()
        )
    ) WITH CHECK (
        created_by = auth.uid()
        AND contact_id IN (
            SELECT id FROM contacts
            WHERE user_id = auth.uid()
        )
    );

-- Users can delete their own notes for contacts they have access to
CREATE POLICY "Users can delete their own contact notes" ON contact_notes
    FOR DELETE USING (
        created_by = auth.uid()
        AND contact_id IN (
            SELECT id FROM contacts
            WHERE user_id = auth.uid()
        )
    );

-- Function to get note statistics for a contact
CREATE OR REPLACE FUNCTION get_contact_note_stats(target_contact_id UUID)
RETURNS TABLE(
    total_notes INTEGER,
    pinned_notes INTEGER,
    recent_notes INTEGER,
    last_note_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::INTEGER as total_notes,
        COUNT(*) FILTER (WHERE is_pinned = true)::INTEGER as pinned_notes,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::INTEGER as recent_notes,
        MAX(created_at) as last_note_date
    FROM contact_notes
    WHERE contact_id = target_contact_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_contact_note_stats(UUID) TO authenticated;

COMMENT ON TABLE contact_notes IS 'Stores notes and annotations related to contacts for team collaboration';
COMMENT ON COLUMN contact_notes.contact_id IS 'Reference to the contact this note belongs to';
COMMENT ON COLUMN contact_notes.title IS 'Short descriptive title for the note';
COMMENT ON COLUMN contact_notes.content IS 'Main content of the note (supports rich text)';
COMMENT ON COLUMN contact_notes.created_by IS 'User who created this note';
COMMENT ON COLUMN contact_notes.is_pinned IS 'Whether this note is pinned for quick access';
COMMENT ON COLUMN contact_notes.tags IS 'Array of tags for categorizing notes';
