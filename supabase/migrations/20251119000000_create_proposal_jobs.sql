-- Create proposal_jobs table for async proposal generation
CREATE TABLE IF NOT EXISTS proposal_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action text NOT NULL CHECK (action IN ('generate_goals', 'generate_sow', 'generate_proposal')),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    
    -- Input parameters (stored as JSONB for flexibility)
    input_data jsonb NOT NULL,
    
    -- Output (stored when completed)
    output_content text,
    output_usage jsonb, -- { input_tokens, output_tokens, total_tokens }
    error_message text,
    
    -- Metadata
    created_at timestamptz DEFAULT now(),
    started_at timestamptz,
    completed_at timestamptz,
    retry_count integer DEFAULT 0,
    max_retries integer DEFAULT 3
);

-- Indexes for efficient querying
CREATE INDEX idx_proposal_jobs_user_status ON proposal_jobs(user_id, status);
CREATE INDEX idx_proposal_jobs_status_created ON proposal_jobs(status, created_at);
CREATE INDEX idx_proposal_jobs_pending ON proposal_jobs(status) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE proposal_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own proposal_jobs" ON proposal_jobs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own proposal_jobs" ON proposal_jobs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own proposal_jobs" ON proposal_jobs
    FOR UPDATE USING (auth.uid() = user_id);

-- Function to get next pending job (for worker)
CREATE OR REPLACE FUNCTION get_next_proposal_job()
RETURNS proposal_jobs AS $$
DECLARE
    job proposal_jobs;
BEGIN
    SELECT * INTO job
    FROM proposal_jobs
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
    
    RETURN job;
END;
$$ LANGUAGE plpgsql;

