-- Create proposal_templates table
CREATE TABLE IF NOT EXISTS proposal_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    type text NOT NULL CHECK (type IN ('goals', 'sow', 'proposal', 'design_system')),
    content text NOT NULL,
    is_default boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    user_id uuid REFERENCES auth.users(id)
);

-- Create proposals table
CREATE TABLE IF NOT EXISTS proposals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id uuid REFERENCES meetings(id),
    contact_id uuid REFERENCES contacts(id),
    type text NOT NULL CHECK (type IN ('goals', 'sow', 'proposal')),
    status text CHECK (status IN ('draft', 'generated', 'approved', 'sent')) DEFAULT 'draft',
    content text NOT NULL,
    title text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    user_id uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE proposal_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for proposal_templates
-- Everyone can view templates
CREATE POLICY "Everyone can view proposal_templates" ON proposal_templates
    FOR SELECT USING (true);

-- Only admins can insert/update/delete templates (or maybe allowed users)
-- For now, allowing authenticated users to manage templates as per requirement to edit in settings
CREATE POLICY "Authenticated users can manage proposal_templates" ON proposal_templates
    FOR ALL USING (auth.role() = 'authenticated');

-- RLS Policies for proposals
-- Users can view their own proposals or proposals linked to records they have access to
-- Simplified to owner-based for now, similar to other tables
CREATE POLICY "Users can manage their own proposals" ON proposals
    FOR ALL USING (auth.uid() = user_id);

-- Seed Data - Note: Full content will be loaded from proposal-feature folder examples
-- Users can edit these templates in Settings > Proposal Templates
INSERT INTO proposal_templates (name, type, content, is_default) VALUES
('Anuncia Goals Example', 'goals', 'See proposal-feature/goals.md for full example. This template will be used as a reference for generating goals documents from call transcripts.', true),

('Anuncia SOW Example', 'sow', 'See proposal-feature/Anuncia-proposal.md for full example. This template will be used as a reference for generating Statement of Work documents.', true),

('Lima Proposal HTML Example', 'proposal', 'See /Users/andrewbryce/Documents/Proposals/Lima Consulting/lima_presentation.html for full example. This template will be used as a reference for generating HTML proposal presentations.', true),

('Design System Reference', 'design_system', 'See /Users/andrewbryce/Documents/Proposals/design_system.md for full example. This template provides design system guidelines for HTML proposals.', true);
