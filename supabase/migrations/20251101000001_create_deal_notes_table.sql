-- Create deal_notes table for storing notes related to deals
CREATE TABLE IF NOT EXISTS deal_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
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
CREATE INDEX idx_deal_notes_deal_id ON deal_notes(deal_id);
CREATE INDEX idx_deal_notes_created_by ON deal_notes(created_by);
CREATE INDEX idx_deal_notes_created_at ON deal_notes(created_at DESC);
CREATE INDEX idx_deal_notes_is_pinned ON deal_notes(is_pinned) WHERE is_pinned = true;
CREATE INDEX idx_deal_notes_tags ON deal_notes USING GIN(tags);

-- Composite indexes for common queries
CREATE INDEX idx_deal_notes_deal_pinned ON deal_notes(deal_id, is_pinned DESC, created_at DESC);
CREATE INDEX idx_deal_notes_deal_created ON deal_notes(deal_id, created_at DESC);

-- Create updated_at trigger
CREATE TRIGGER update_deal_notes_updated_at
    BEFORE UPDATE ON deal_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE deal_notes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can view notes for deals they have access to
CREATE POLICY "Users can view deal notes they have access to" ON deal_notes
    FOR SELECT USING (
        deal_id IN (
            SELECT id FROM deals
            WHERE user_id = auth.uid()
        )
    );

-- Users can create notes for deals they have access to
CREATE POLICY "Users can create deal notes for accessible deals" ON deal_notes
    FOR INSERT WITH CHECK (
        created_by = auth.uid()
        AND deal_id IN (
            SELECT id FROM deals
            WHERE user_id = auth.uid()
        )
    );

-- Users can update their own notes for deals they have access to
CREATE POLICY "Users can update their own deal notes" ON deal_notes
    FOR UPDATE USING (
        created_by = auth.uid()
        AND deal_id IN (
            SELECT id FROM deals
            WHERE user_id = auth.uid()
        )
    ) WITH CHECK (
        created_by = auth.uid()
        AND deal_id IN (
            SELECT id FROM deals
            WHERE user_id = auth.uid()
        )
    );

-- Users can delete their own notes for deals they have access to
CREATE POLICY "Users can delete their own deal notes" ON deal_notes
    FOR DELETE USING (
        created_by = auth.uid()
        AND deal_id IN (
            SELECT id FROM deals
            WHERE user_id = auth.uid()
        )
    );

-- Function to get note statistics for a deal
CREATE OR REPLACE FUNCTION get_deal_note_stats(target_deal_id UUID)
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
    FROM deal_notes
    WHERE deal_id = target_deal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_deal_note_stats(UUID) TO authenticated;

COMMENT ON TABLE deal_notes IS 'Stores notes and annotations related to deals for team collaboration';
COMMENT ON COLUMN deal_notes.deal_id IS 'Reference to the deal this note belongs to';
COMMENT ON COLUMN deal_notes.title IS 'Short descriptive title for the note';
COMMENT ON COLUMN deal_notes.content IS 'Main content of the note (supports rich text)';
COMMENT ON COLUMN deal_notes.created_by IS 'User who created this note';
COMMENT ON COLUMN deal_notes.is_pinned IS 'Whether this note is pinned for quick access';
COMMENT ON COLUMN deal_notes.tags IS 'Array of tags for categorizing notes';
