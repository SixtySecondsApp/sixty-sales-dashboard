-- Migration: Create Copilot and AI Insights Tables
-- Description: Tables for AI Copilot conversations, AI insights, and enhanced contact/deal tracking
-- Date: 2025-11-14

-- ============================================================================
-- 1. Copilot Conversations Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS copilot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'copilot_conversations_user_id_fkey'
  ) THEN
    ALTER TABLE copilot_conversations
      ADD CONSTRAINT copilot_conversations_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 2. Copilot Messages Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS copilot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'copilot_messages_conversation_id_fkey'
  ) THEN
    ALTER TABLE copilot_messages
      ADD CONSTRAINT copilot_messages_conversation_id_fkey 
      FOREIGN KEY (conversation_id) REFERENCES copilot_conversations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 3. AI Insights Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID,
  deal_id UUID,
  user_id UUID NOT NULL,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('engagement', 'risk', 'opportunity', 'custom')),
  insight_text TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
  suggested_actions JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraints if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'ai_insights_contact_id_fkey'
  ) THEN
    ALTER TABLE ai_insights
      ADD CONSTRAINT ai_insights_contact_id_fkey 
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'ai_insights_deal_id_fkey'
  ) THEN
    ALTER TABLE ai_insights
      ADD CONSTRAINT ai_insights_deal_id_fkey 
      FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'ai_insights_user_id_fkey'
  ) THEN
    ALTER TABLE ai_insights
      ADD CONSTRAINT ai_insights_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'ai_insights_contact_or_deal'
  ) THEN
    ALTER TABLE ai_insights
      ADD CONSTRAINT ai_insights_contact_or_deal CHECK (
        (contact_id IS NOT NULL AND deal_id IS NULL) OR
        (contact_id IS NULL AND deal_id IS NOT NULL) OR
        (contact_id IS NOT NULL AND deal_id IS NOT NULL)
      );
  END IF;
END $$;

-- ============================================================================
-- 4. Action Items Table (if not exists as standalone)
-- ============================================================================

-- Check if action_items table exists, if not create it
-- Note: meeting_action_items already exists, this is for general action items
CREATE TABLE IF NOT EXISTS action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID,
  deal_id UUID,
  meeting_id UUID,
  user_id UUID NOT NULL,
  assignee_id UUID,
  text TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  due_date TIMESTAMP WITH TIME ZONE,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraints if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'action_items_contact_id_fkey'
  ) THEN
    ALTER TABLE action_items
      ADD CONSTRAINT action_items_contact_id_fkey 
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'action_items_deal_id_fkey'
  ) THEN
    ALTER TABLE action_items
      ADD CONSTRAINT action_items_deal_id_fkey 
      FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'action_items_meeting_id_fkey'
  ) THEN
    ALTER TABLE action_items
      ADD CONSTRAINT action_items_meeting_id_fkey 
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'action_items_user_id_fkey'
  ) THEN
    ALTER TABLE action_items
      ADD CONSTRAINT action_items_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'action_items_assignee_id_fkey'
  ) THEN
    ALTER TABLE action_items
      ADD CONSTRAINT action_items_assignee_id_fkey 
      FOREIGN KEY (assignee_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 5. Add Health Score Columns to Contacts
-- ============================================================================

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS health_score INTEGER CHECK (health_score >= 0 AND health_score <= 100),
  ADD COLUMN IF NOT EXISTS engagement_level TEXT CHECK (engagement_level IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS last_ai_analysis TIMESTAMP WITH TIME ZONE;

-- ============================================================================
-- 6. Add Health Score Columns to Deals
-- ============================================================================

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS health_score INTEGER CHECK (health_score >= 0 AND health_score <= 100),
  ADD COLUMN IF NOT EXISTS risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  ADD COLUMN IF NOT EXISTS momentum_score INTEGER CHECK (momentum_score >= 0 AND momentum_score <= 100);

-- ============================================================================
-- 7. Create Indexes
-- ============================================================================

-- Copilot conversations indexes
CREATE INDEX IF NOT EXISTS idx_copilot_conversations_user_id ON copilot_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_copilot_conversations_updated_at ON copilot_conversations(updated_at DESC);

-- Copilot messages indexes
CREATE INDEX IF NOT EXISTS idx_copilot_messages_conversation_id ON copilot_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_copilot_messages_created_at ON copilot_messages(created_at DESC);

-- AI insights indexes
CREATE INDEX IF NOT EXISTS idx_ai_insights_contact_id ON ai_insights(contact_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_deal_id ON ai_insights(deal_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_user_id ON ai_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_insight_type ON ai_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_ai_insights_priority ON ai_insights(priority);
CREATE INDEX IF NOT EXISTS idx_ai_insights_created_at ON ai_insights(created_at DESC);

-- Action items indexes
CREATE INDEX IF NOT EXISTS idx_action_items_contact_id ON action_items(contact_id);
CREATE INDEX IF NOT EXISTS idx_action_items_deal_id ON action_items(deal_id);
CREATE INDEX IF NOT EXISTS idx_action_items_meeting_id ON action_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_action_items_user_id ON action_items(user_id);
CREATE INDEX IF NOT EXISTS idx_action_items_assignee_id ON action_items(assignee_id);
CREATE INDEX IF NOT EXISTS idx_action_items_completed ON action_items(completed);
CREATE INDEX IF NOT EXISTS idx_action_items_due_date ON action_items(due_date);

-- Contact health indexes
CREATE INDEX IF NOT EXISTS idx_contacts_health_score ON contacts(health_score);
CREATE INDEX IF NOT EXISTS idx_contacts_engagement_level ON contacts(engagement_level);

-- Deal health indexes
CREATE INDEX IF NOT EXISTS idx_deals_health_score ON deals(health_score);
CREATE INDEX IF NOT EXISTS idx_deals_risk_level ON deals(risk_level);
CREATE INDEX IF NOT EXISTS idx_deals_momentum_score ON deals(momentum_score);

-- ============================================================================
-- 8. Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE copilot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE copilot_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;

-- Copilot conversations policies (drop if exists, then create)
DROP POLICY IF EXISTS "Users can view their own conversations" ON copilot_conversations;
CREATE POLICY "Users can view their own conversations"
  ON copilot_conversations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own conversations" ON copilot_conversations;
CREATE POLICY "Users can create their own conversations"
  ON copilot_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own conversations" ON copilot_conversations;
CREATE POLICY "Users can update their own conversations"
  ON copilot_conversations FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own conversations" ON copilot_conversations;
CREATE POLICY "Users can delete their own conversations"
  ON copilot_conversations FOR DELETE
  USING (auth.uid() = user_id);

-- Copilot messages policies
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON copilot_messages;
CREATE POLICY "Users can view messages in their conversations"
  ON copilot_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM copilot_conversations
      WHERE copilot_conversations.id = copilot_messages.conversation_id
      AND copilot_conversations.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create messages in their conversations" ON copilot_messages;
CREATE POLICY "Users can create messages in their conversations"
  ON copilot_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM copilot_conversations
      WHERE copilot_conversations.id = copilot_messages.conversation_id
      AND copilot_conversations.user_id = auth.uid()
    )
  );

-- AI insights policies
DROP POLICY IF EXISTS "Users can view their own insights" ON ai_insights;
CREATE POLICY "Users can view their own insights"
  ON ai_insights FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own insights" ON ai_insights;
CREATE POLICY "Users can create their own insights"
  ON ai_insights FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own insights" ON ai_insights;
CREATE POLICY "Users can update their own insights"
  ON ai_insights FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own insights" ON ai_insights;
CREATE POLICY "Users can delete their own insights"
  ON ai_insights FOR DELETE
  USING (auth.uid() = user_id);

-- Action items policies
DROP POLICY IF EXISTS "Users can view action items they own or are assigned to" ON action_items;
CREATE POLICY "Users can view action items they own or are assigned to"
  ON action_items FOR SELECT
  USING (
    auth.uid() = user_id OR
    auth.uid() = assignee_id OR
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = action_items.contact_id
      AND contacts.owner_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM deals
      WHERE deals.id = action_items.deal_id
      AND deals.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create action items for their contacts/deals" ON action_items;
CREATE POLICY "Users can create action items for their contacts/deals"
  ON action_items FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND (
      contact_id IS NULL OR EXISTS (
        SELECT 1 FROM contacts
        WHERE contacts.id = action_items.contact_id
        AND contacts.owner_id = auth.uid()
      )
    ) AND (
      deal_id IS NULL OR EXISTS (
        SELECT 1 FROM deals
        WHERE deals.id = action_items.deal_id
        AND deals.owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can update action items they own or are assigned to" ON action_items;
CREATE POLICY "Users can update action items they own or are assigned to"
  ON action_items FOR UPDATE
  USING (
    auth.uid() = user_id OR
    auth.uid() = assignee_id
  );

DROP POLICY IF EXISTS "Users can delete action items they own" ON action_items;
CREATE POLICY "Users can delete action items they own"
  ON action_items FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 9. Update Triggers
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop triggers if they exist, then create
DROP TRIGGER IF EXISTS update_copilot_conversations_updated_at ON copilot_conversations;
CREATE TRIGGER update_copilot_conversations_updated_at
  BEFORE UPDATE ON copilot_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_insights_updated_at ON ai_insights;
CREATE TRIGGER update_ai_insights_updated_at
  BEFORE UPDATE ON ai_insights
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_action_items_updated_at ON action_items;
CREATE TRIGGER update_action_items_updated_at
  BEFORE UPDATE ON action_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

