-- Migration: Create Copilot Conversation Tables
-- Description: Creates tables for storing CoPilot conversation history
-- Required by: useConversationHistory.ts, CopilotContext.tsx

-- =====================================================
-- copilot_conversations - Stores conversation sessions
-- =====================================================
CREATE TABLE IF NOT EXISTS copilot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add org_id column if it doesn't exist (for existing tables)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'copilot_conversations' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE copilot_conversations
      ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_copilot_conversations_user_id
  ON copilot_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_copilot_conversations_org_id
  ON copilot_conversations(org_id);
CREATE INDEX IF NOT EXISTS idx_copilot_conversations_updated_at
  ON copilot_conversations(updated_at DESC);

-- Enable RLS
ALTER TABLE copilot_conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own conversations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'copilot_conversations' AND policyname = 'Users can view own conversations') THEN
    CREATE POLICY "Users can view own conversations"
      ON copilot_conversations FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'copilot_conversations' AND policyname = 'Users can create own conversations') THEN
    CREATE POLICY "Users can create own conversations"
      ON copilot_conversations FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'copilot_conversations' AND policyname = 'Users can update own conversations') THEN
    CREATE POLICY "Users can update own conversations"
      ON copilot_conversations FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'copilot_conversations' AND policyname = 'Users can delete own conversations') THEN
    CREATE POLICY "Users can delete own conversations"
      ON copilot_conversations FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- =====================================================
-- copilot_messages - Stores individual messages
-- =====================================================
CREATE TABLE IF NOT EXISTS copilot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES copilot_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_copilot_messages_conversation_id
  ON copilot_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_copilot_messages_created_at
  ON copilot_messages(conversation_id, created_at ASC);

-- Enable RLS
ALTER TABLE copilot_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access messages in their own conversations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'copilot_messages' AND policyname = 'Users can view messages in own conversations') THEN
    CREATE POLICY "Users can view messages in own conversations"
      ON copilot_messages FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM copilot_conversations
          WHERE id = copilot_messages.conversation_id
          AND user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'copilot_messages' AND policyname = 'Users can create messages in own conversations') THEN
    CREATE POLICY "Users can create messages in own conversations"
      ON copilot_messages FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM copilot_conversations
          WHERE id = copilot_messages.conversation_id
          AND user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'copilot_messages' AND policyname = 'Users can delete messages in own conversations') THEN
    CREATE POLICY "Users can delete messages in own conversations"
      ON copilot_messages FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM copilot_conversations
          WHERE id = copilot_messages.conversation_id
          AND user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- =====================================================
-- Trigger: Auto-update updated_at on conversations
-- =====================================================
CREATE OR REPLACE FUNCTION update_copilot_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE copilot_conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_update_conversation_on_message ON copilot_messages;
CREATE TRIGGER trigger_update_conversation_on_message
  AFTER INSERT ON copilot_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_copilot_conversation_updated_at();

-- =====================================================
-- Comments for documentation
-- =====================================================
COMMENT ON TABLE copilot_conversations IS 'Stores CoPilot conversation sessions for each user';
COMMENT ON TABLE copilot_messages IS 'Stores individual messages within CoPilot conversations';
COMMENT ON COLUMN copilot_conversations.title IS 'Auto-generated or user-defined title for the conversation';
COMMENT ON COLUMN copilot_messages.role IS 'Message sender: user or assistant';
COMMENT ON COLUMN copilot_messages.metadata IS 'Additional data like response type, action data, etc.';
