-- Create meetings table
CREATE TABLE IF NOT EXISTS meetings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fathom_recording_id TEXT UNIQUE NOT NULL,
  title TEXT,
  share_url TEXT,
  calls_url TEXT,
  meeting_start TIMESTAMPTZ,
  meeting_end TIMESTAMPTZ,
  duration_minutes NUMERIC,
  owner_user_id UUID REFERENCES auth.users(id),
  owner_email TEXT,
  team_name TEXT,
  company_id UUID REFERENCES companies(id),
  primary_contact_id UUID REFERENCES contacts(id),
  summary TEXT,
  transcript_doc_url TEXT,
  sentiment_score NUMERIC CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
  coach_rating NUMERIC CHECK (coach_rating >= 0 AND coach_rating <= 100),
  coach_summary TEXT,
  talk_time_rep_pct NUMERIC,
  talk_time_customer_pct NUMERIC,
  talk_time_judgement TEXT CHECK (talk_time_judgement IN ('good', 'high', 'low')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create meeting_attendees table
CREATE TABLE IF NOT EXISTS meeting_attendees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  is_external BOOLEAN DEFAULT false,
  role TEXT
);

-- Create meeting_action_items table
CREATE TABLE IF NOT EXISTS meeting_action_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  title TEXT,
  assignee_name TEXT,
  assignee_email TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category TEXT,
  deadline_at TIMESTAMPTZ,
  completed BOOLEAN DEFAULT false,
  ai_generated BOOLEAN DEFAULT false,
  timestamp_seconds NUMERIC,
  playback_url TEXT,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL, -- Optional link to tasks table
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create meeting_topics table (optional for search)
CREATE TABLE IF NOT EXISTS meeting_topics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  label TEXT
);

-- Create meeting_metrics table (optional if transcript available)
CREATE TABLE IF NOT EXISTS meeting_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  words_spoken_rep INTEGER,
  words_spoken_customer INTEGER,
  avg_response_latency_ms INTEGER,
  interruption_count INTEGER
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_meetings_owner_user_id ON meetings(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_meeting_start ON meetings(meeting_start DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_attendees_email ON meeting_attendees(email);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_assignee_email ON meeting_action_items(assignee_email);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_completed ON meeting_action_items(completed);

-- Enable RLS
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_metrics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Meetings policies
CREATE POLICY "Users can view their own meetings" ON meetings
  FOR SELECT USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can view team meetings" ON meetings
  FOR SELECT USING (
    team_name IN (
      SELECT team_name FROM meetings WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own meetings" ON meetings
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update their own meetings" ON meetings
  FOR UPDATE USING (auth.uid() = owner_user_id);

-- Meeting attendees policies
CREATE POLICY "View attendees for accessible meetings" ON meeting_attendees
  FOR SELECT USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE 
        owner_user_id = auth.uid() OR
        team_name IN (
          SELECT team_name FROM meetings WHERE owner_user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Manage attendees for own meetings" ON meeting_attendees
  FOR ALL USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE owner_user_id = auth.uid()
    )
  );

-- Meeting action items policies
CREATE POLICY "View action items for accessible meetings" ON meeting_action_items
  FOR SELECT USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE 
        owner_user_id = auth.uid() OR
        team_name IN (
          SELECT team_name FROM meetings WHERE owner_user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Manage action items for own meetings" ON meeting_action_items
  FOR ALL USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE owner_user_id = auth.uid()
    )
  );

-- Meeting topics policies
CREATE POLICY "View topics for accessible meetings" ON meeting_topics
  FOR SELECT USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE 
        owner_user_id = auth.uid() OR
        team_name IN (
          SELECT team_name FROM meetings WHERE owner_user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Manage topics for own meetings" ON meeting_topics
  FOR ALL USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE owner_user_id = auth.uid()
    )
  );

-- Meeting metrics policies
CREATE POLICY "View metrics for accessible meetings" ON meeting_metrics
  FOR SELECT USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE 
        owner_user_id = auth.uid() OR
        team_name IN (
          SELECT team_name FROM meetings WHERE owner_user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Manage metrics for own meetings" ON meeting_metrics
  FOR ALL USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE owner_user_id = auth.uid()
    )
  );