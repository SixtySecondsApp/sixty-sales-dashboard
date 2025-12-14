-- Migration: Create Copilot Analytics Table
-- Description: Track Copilot usage, performance, and costs
-- Date: 2025-11-14

-- ============================================================================
-- Copilot Analytics Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS copilot_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  conversation_id UUID REFERENCES copilot_conversations(id) ON DELETE SET NULL,
  
  -- Request metrics
  request_type TEXT NOT NULL CHECK (request_type IN ('chat', 'draft_email', 'get_conversation')),
  message_length INTEGER DEFAULT 0,
  response_length INTEGER DEFAULT 0,
  
  -- Performance metrics
  response_time_ms INTEGER DEFAULT 0,
  claude_api_time_ms INTEGER DEFAULT 0,
  tool_execution_time_ms INTEGER DEFAULT 0,
  tool_iterations INTEGER DEFAULT 0,
  
  -- Tool usage tracking
  tools_used JSONB DEFAULT '[]'::jsonb, -- Array of tool names used: ["meetings_read", "pipeline_create"]
  tools_success_count INTEGER DEFAULT 0,
  tools_error_count INTEGER DEFAULT 0,
  
  -- Cost tracking (in cents)
  estimated_cost_cents NUMERIC(10, 4) DEFAULT 0,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  
  -- Status and errors
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'timeout', 'rate_limited')) DEFAULT 'success',
  error_type TEXT,
  error_message TEXT,
  
  -- Context metadata
  has_context BOOLEAN DEFAULT false,
  context_type TEXT, -- 'contact', 'deal', 'dashboard', null
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'copilot_analytics_user_id_fkey'
  ) THEN
    ALTER TABLE copilot_analytics
      ADD CONSTRAINT copilot_analytics_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_copilot_analytics_user_id ON copilot_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_copilot_analytics_created_at ON copilot_analytics(created_at DESC);
-- Composite index for user + date queries (using timestamp directly, not date cast)
CREATE INDEX IF NOT EXISTS idx_copilot_analytics_user_created ON copilot_analytics(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_copilot_analytics_status ON copilot_analytics(status);
CREATE INDEX IF NOT EXISTS idx_copilot_analytics_request_type ON copilot_analytics(request_type);
CREATE INDEX IF NOT EXISTS idx_copilot_analytics_conversation_id ON copilot_analytics(conversation_id) WHERE conversation_id IS NOT NULL;

-- GIN index for tools_used JSONB queries
CREATE INDEX IF NOT EXISTS idx_copilot_analytics_tools_used ON copilot_analytics USING GIN(tools_used);

-- Enable Row Level Security
ALTER TABLE copilot_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
  -- Users can only see their own analytics
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'copilot_analytics' 
    AND policyname = 'Users can view their own analytics'
  ) THEN
    CREATE POLICY "Users can view their own analytics"
      ON copilot_analytics
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  -- Service role can insert (for Edge Function)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'copilot_analytics' 
    AND policyname = 'Service role can insert analytics'
  ) THEN
    CREATE POLICY "Service role can insert analytics"
      ON copilot_analytics
      FOR INSERT
      WITH CHECK (true); -- Service role bypasses RLS
  END IF;
END $$;

-- Updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_copilot_analytics_updated_at'
  ) THEN
    CREATE TRIGGER update_copilot_analytics_updated_at
      BEFORE UPDATE ON copilot_analytics
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

