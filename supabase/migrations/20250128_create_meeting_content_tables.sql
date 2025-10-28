-- Migration: Create Meeting Content Tables
-- Purpose: Store AI-extracted topics and generated marketing content from meeting transcripts
-- Features: Caching, versioning, cost tracking, soft delete, RLS
-- Created: 2025-01-28

-- ============================================================================
-- TABLE: meeting_content_topics
-- Purpose: Store AI-extracted topics from meeting transcripts with caching
-- ============================================================================

CREATE TABLE meeting_content_topics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relationships
    meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Topic Data
    -- JSONB array format: [{title, description, timestamp, fathom_url}, ...]
    -- Expected 5-10 topics per extraction
    topics jsonb NOT NULL,

    -- AI Cost Tracking
    model_used text NOT NULL, -- e.g., "gpt-4-turbo-preview", "claude-3-opus"
    tokens_used integer NOT NULL CHECK (tokens_used > 0),
    cost_cents integer NOT NULL CHECK (cost_cents >= 0), -- Cost in cents to avoid float precision issues

    -- Cache Management
    extraction_version integer NOT NULL DEFAULT 1, -- Increment on re-extraction

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz, -- Soft delete

    -- Constraints
    CONSTRAINT topics_is_array CHECK (jsonb_typeof(topics) = 'array'),
    CONSTRAINT topics_not_empty CHECK (jsonb_array_length(topics) > 0)
);

-- Indexes for performance
CREATE INDEX idx_meeting_content_topics_meeting_id ON meeting_content_topics(meeting_id);
CREATE INDEX idx_meeting_content_topics_user_id ON meeting_content_topics(user_id);
CREATE INDEX idx_meeting_content_topics_meeting_deleted ON meeting_content_topics(meeting_id, deleted_at);
CREATE INDEX idx_meeting_content_topics_created ON meeting_content_topics(created_at DESC);

-- Comments
COMMENT ON TABLE meeting_content_topics IS 'AI-extracted topics from meeting transcripts with caching support';
COMMENT ON COLUMN meeting_content_topics.topics IS 'JSONB array of topic objects: [{title, description, timestamp, fathom_url}]';
COMMENT ON COLUMN meeting_content_topics.extraction_version IS 'Increments on re-extraction to track cache updates';
COMMENT ON COLUMN meeting_content_topics.cost_cents IS 'AI API cost in cents (multiply by 0.01 for dollars)';

-- ============================================================================
-- TABLE: meeting_generated_content
-- Purpose: Store AI-generated marketing content with versioning support
-- ============================================================================

CREATE TABLE meeting_generated_content (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relationships
    meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Content Details
    content_type text NOT NULL CHECK (content_type IN ('social', 'blog', 'video', 'email')),
    content_markdown text NOT NULL, -- Generated content in markdown format

    -- AI Cost Tracking
    model_used text NOT NULL,
    tokens_used integer NOT NULL CHECK (tokens_used > 0),
    cost_cents integer NOT NULL CHECK (cost_cents >= 0),

    -- Version Management
    version integer NOT NULL DEFAULT 1,
    parent_version_id uuid REFERENCES meeting_generated_content(id) ON DELETE SET NULL,

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz, -- Soft delete

    -- Constraints
    CONSTRAINT content_not_empty CHECK (length(trim(content_markdown)) > 0)
);

-- Indexes for performance
CREATE INDEX idx_meeting_generated_content_meeting_id ON meeting_generated_content(meeting_id);
CREATE INDEX idx_meeting_generated_content_user_id ON meeting_generated_content(user_id);
CREATE INDEX idx_meeting_generated_content_meeting_deleted ON meeting_generated_content(meeting_id, deleted_at);

-- Partial index for active content filtered by type (reduces index size)
CREATE INDEX idx_meeting_generated_content_type ON meeting_generated_content(content_type)
    WHERE deleted_at IS NULL;

-- Composite index for "get latest version" queries
CREATE INDEX idx_meeting_generated_content_version ON meeting_generated_content(meeting_id, content_type, version DESC);

-- Comments
COMMENT ON TABLE meeting_generated_content IS 'AI-generated marketing content from meeting transcripts with version history';
COMMENT ON COLUMN meeting_generated_content.content_type IS 'Type of marketing content: social, blog, video, email';
COMMENT ON COLUMN meeting_generated_content.version IS 'Content version number (increments on regeneration)';
COMMENT ON COLUMN meeting_generated_content.parent_version_id IS 'Links to previous version for version history chain';

-- ============================================================================
-- TABLE: content_topic_links
-- Purpose: Junction table linking generated content to selected topics
-- ============================================================================

CREATE TABLE content_topic_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relationships
    content_id uuid NOT NULL REFERENCES meeting_generated_content(id) ON DELETE CASCADE,
    topic_extraction_id uuid NOT NULL REFERENCES meeting_content_topics(id) ON DELETE CASCADE,
    topic_index integer NOT NULL CHECK (topic_index >= 0), -- Index into topics JSONB array

    -- Timestamp
    created_at timestamptz NOT NULL DEFAULT now(),

    -- Prevent duplicate links
    UNIQUE(content_id, topic_extraction_id, topic_index)
);

-- Indexes for join performance
CREATE INDEX idx_content_topic_links_content_id ON content_topic_links(content_id);
CREATE INDEX idx_content_topic_links_topic_id ON content_topic_links(topic_extraction_id);

-- Comments
COMMENT ON TABLE content_topic_links IS 'Many-to-many relationship between generated content and selected topics';
COMMENT ON COLUMN content_topic_links.topic_index IS 'Index position of topic in meeting_content_topics.topics JSONB array';

-- ============================================================================
-- TRIGGERS: Automatic updated_at timestamp management
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_meeting_content_topics_updated_at
    BEFORE UPDATE ON meeting_content_topics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meeting_generated_content_updated_at
    BEFORE UPDATE ON meeting_generated_content
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE meeting_content_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_generated_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_topic_links ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- RLS Policies: meeting_content_topics
-- ----------------------------------------------------------------------------

-- SELECT: Users can view topics for meetings they own
CREATE POLICY select_meeting_content_topics ON meeting_content_topics
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM meetings
            WHERE meetings.id = meeting_content_topics.meeting_id
            AND meetings.owner_user_id = auth.uid()
        )
        AND deleted_at IS NULL
    );

-- INSERT: Users can create topics for their meetings
CREATE POLICY insert_meeting_content_topics ON meeting_content_topics
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM meetings
            WHERE meetings.id = meeting_content_topics.meeting_id
            AND meetings.owner_user_id = auth.uid()
        )
        AND user_id = auth.uid()
    );

-- UPDATE: Users can update topics for their meetings (re-extraction)
CREATE POLICY update_meeting_content_topics ON meeting_content_topics
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM meetings
            WHERE meetings.id = meeting_content_topics.meeting_id
            AND meetings.owner_user_id = auth.uid()
        )
        AND user_id = auth.uid()
        AND deleted_at IS NULL
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM meetings
            WHERE meetings.id = meeting_content_topics.meeting_id
            AND meetings.owner_user_id = auth.uid()
        )
        AND user_id = auth.uid()
    );

-- DELETE: Users can soft delete their topics (UPDATE for soft delete)
-- Note: Soft delete is handled via UPDATE policy above

-- ----------------------------------------------------------------------------
-- RLS Policies: meeting_generated_content
-- ----------------------------------------------------------------------------

-- SELECT: Users can view content for meetings they own
CREATE POLICY select_meeting_generated_content ON meeting_generated_content
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM meetings
            WHERE meetings.id = meeting_generated_content.meeting_id
            AND meetings.owner_user_id = auth.uid()
        )
        AND deleted_at IS NULL
    );

-- INSERT: Users can create content for their meetings
CREATE POLICY insert_meeting_generated_content ON meeting_generated_content
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM meetings
            WHERE meetings.id = meeting_generated_content.meeting_id
            AND meetings.owner_user_id = auth.uid()
        )
        AND user_id = auth.uid()
    );

-- UPDATE: Users can update their content (for versioning)
CREATE POLICY update_meeting_generated_content ON meeting_generated_content
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM meetings
            WHERE meetings.id = meeting_generated_content.meeting_id
            AND meetings.owner_user_id = auth.uid()
        )
        AND user_id = auth.uid()
        AND deleted_at IS NULL
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM meetings
            WHERE meetings.id = meeting_generated_content.meeting_id
            AND meetings.owner_user_id = auth.uid()
        )
        AND user_id = auth.uid()
    );

-- ----------------------------------------------------------------------------
-- RLS Policies: content_topic_links
-- ----------------------------------------------------------------------------

-- SELECT: Users can view links for content they own
CREATE POLICY select_content_topic_links ON content_topic_links
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM meeting_generated_content mgc
            JOIN meetings m ON mgc.meeting_id = m.id
            WHERE mgc.id = content_topic_links.content_id
            AND m.owner_user_id = auth.uid()
            AND mgc.deleted_at IS NULL
        )
    );

-- INSERT: Users can create links for their content
CREATE POLICY insert_content_topic_links ON content_topic_links
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM meeting_generated_content mgc
            JOIN meetings m ON mgc.meeting_id = m.id
            WHERE mgc.id = content_topic_links.content_id
            AND m.owner_user_id = auth.uid()
        )
        AND EXISTS (
            SELECT 1 FROM meeting_content_topics mct
            JOIN meetings m ON mct.meeting_id = m.id
            WHERE mct.id = content_topic_links.topic_extraction_id
            AND m.owner_user_id = auth.uid()
        )
    );

-- DELETE: Cascade handles cleanup, but add policy for explicit deletes
CREATE POLICY delete_content_topic_links ON content_topic_links
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM meeting_generated_content mgc
            JOIN meetings m ON mgc.meeting_id = m.id
            WHERE mgc.id = content_topic_links.content_id
            AND m.owner_user_id = auth.uid()
        )
    );

-- ============================================================================
-- HELPER FUNCTIONS (Optional but useful for common queries)
-- ============================================================================

-- Get latest topic extraction for a meeting
CREATE OR REPLACE FUNCTION get_latest_topics(p_meeting_id uuid)
RETURNS meeting_content_topics AS $$
    SELECT * FROM meeting_content_topics
    WHERE meeting_id = p_meeting_id
    AND deleted_at IS NULL
    ORDER BY extraction_version DESC, created_at DESC
    LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Get latest version of generated content by type
CREATE OR REPLACE FUNCTION get_latest_content(p_meeting_id uuid, p_content_type text)
RETURNS meeting_generated_content AS $$
    SELECT * FROM meeting_generated_content
    WHERE meeting_id = p_meeting_id
    AND content_type = p_content_type
    AND deleted_at IS NULL
    ORDER BY version DESC, created_at DESC
    LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Calculate total AI costs for a meeting
CREATE OR REPLACE FUNCTION get_meeting_ai_costs(p_meeting_id uuid)
RETURNS TABLE(
    total_cost_cents integer,
    total_tokens integer,
    topic_cost_cents integer,
    content_cost_cents integer
) AS $$
    SELECT
        COALESCE(SUM(mct.cost_cents), 0)::integer + COALESCE(SUM(mgc.cost_cents), 0)::integer AS total_cost_cents,
        COALESCE(SUM(mct.tokens_used), 0)::integer + COALESCE(SUM(mgc.tokens_used), 0)::integer AS total_tokens,
        COALESCE(SUM(mct.cost_cents), 0)::integer AS topic_cost_cents,
        COALESCE(SUM(mgc.cost_cents), 0)::integer AS content_cost_cents
    FROM meetings m
    LEFT JOIN meeting_content_topics mct ON m.id = mct.meeting_id AND mct.deleted_at IS NULL
    LEFT JOIN meeting_generated_content mgc ON m.id = mgc.meeting_id AND mgc.deleted_at IS NULL
    WHERE m.id = p_meeting_id
    GROUP BY m.id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_latest_topics IS 'Retrieve the most recent topic extraction for a meeting';
COMMENT ON FUNCTION get_latest_content IS 'Retrieve the latest version of generated content by type';
COMMENT ON FUNCTION get_meeting_ai_costs IS 'Calculate total AI API costs for a meeting (topics + content)';

-- ============================================================================
-- GRANTS (if needed for service role or other roles)
-- ============================================================================

-- Grant usage to authenticated users (handled by RLS policies)
-- Additional grants can be added here if needed for service role operations

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
