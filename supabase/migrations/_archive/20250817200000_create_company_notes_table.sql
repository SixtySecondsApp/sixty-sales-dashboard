-- Create company_notes table for storing notes related to companies
CREATE TABLE IF NOT EXISTS company_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
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
CREATE INDEX idx_company_notes_company_id ON company_notes(company_id);
CREATE INDEX idx_company_notes_created_by ON company_notes(created_by);
CREATE INDEX idx_company_notes_created_at ON company_notes(created_at DESC);
CREATE INDEX idx_company_notes_is_pinned ON company_notes(is_pinned) WHERE is_pinned = true;
CREATE INDEX idx_company_notes_tags ON company_notes USING GIN(tags);

-- Composite indexes for common queries
CREATE INDEX idx_company_notes_company_pinned ON company_notes(company_id, is_pinned DESC, created_at DESC);
CREATE INDEX idx_company_notes_company_created ON company_notes(company_id, created_at DESC);

-- Create updated_at trigger
CREATE TRIGGER update_company_notes_updated_at 
    BEFORE UPDATE ON company_notes 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE company_notes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see notes for companies they have access to
CREATE POLICY "Users can view company notes they have access to" ON company_notes
    FOR SELECT USING (
        company_id IN (
            SELECT id FROM companies 
            WHERE owner_id = auth.uid() 
            OR assigned_to = auth.uid()
        )
    );

-- Users can create notes for companies they have access to
CREATE POLICY "Users can create company notes for accessible companies" ON company_notes
    FOR INSERT WITH CHECK (
        created_by = auth.uid() 
        AND company_id IN (
            SELECT id FROM companies 
            WHERE owner_id = auth.uid() 
            OR assigned_to = auth.uid()
        )
    );

-- Users can update their own notes for companies they have access to
CREATE POLICY "Users can update their own company notes" ON company_notes
    FOR UPDATE USING (
        created_by = auth.uid() 
        AND company_id IN (
            SELECT id FROM companies 
            WHERE owner_id = auth.uid() 
            OR assigned_to = auth.uid()
        )
    ) WITH CHECK (
        created_by = auth.uid() 
        AND company_id IN (
            SELECT id FROM companies 
            WHERE owner_id = auth.uid() 
            OR assigned_to = auth.uid()
        )
    );

-- Users can delete their own notes for companies they have access to
CREATE POLICY "Users can delete their own company notes" ON company_notes
    FOR DELETE USING (
        created_by = auth.uid() 
        AND company_id IN (
            SELECT id FROM companies 
            WHERE owner_id = auth.uid() 
            OR assigned_to = auth.uid()
        )
    );

-- Function to get note statistics for a company
CREATE OR REPLACE FUNCTION get_company_note_stats(target_company_id UUID)
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
    FROM company_notes 
    WHERE company_id = target_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_company_note_stats(UUID) TO authenticated;

COMMENT ON TABLE company_notes IS 'Stores notes and annotations related to companies for team collaboration';
COMMENT ON COLUMN company_notes.company_id IS 'Reference to the company this note belongs to';
COMMENT ON COLUMN company_notes.title IS 'Short descriptive title for the note';
COMMENT ON COLUMN company_notes.content IS 'Main content of the note (supports rich text)';
COMMENT ON COLUMN company_notes.created_by IS 'User who created this note';
COMMENT ON COLUMN company_notes.is_pinned IS 'Whether this note is pinned for quick access';
COMMENT ON COLUMN company_notes.tags IS 'Array of tags for categorizing notes';