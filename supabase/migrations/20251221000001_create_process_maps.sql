-- Create process_maps table to store AI-generated process visualization charts
-- These charts are generated from integration/workflow analysis and rendered using Mermaid

CREATE TABLE IF NOT EXISTS public.process_maps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Organization scope
    clerk_org_id TEXT NOT NULL,

    -- Process identification
    process_type TEXT NOT NULL, -- e.g., 'integration', 'workflow', 'meeting_intelligence', 'task_extraction'
    process_name TEXT NOT NULL, -- e.g., 'hubspot', 'google', 'fathom', 'task_automation'

    -- Mermaid chart content
    title TEXT NOT NULL,
    description TEXT,
    mermaid_code TEXT NOT NULL,

    -- Metadata
    generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    version INTEGER NOT NULL DEFAULT 1,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_process_maps_org_id ON public.process_maps(clerk_org_id);
CREATE INDEX IF NOT EXISTS idx_process_maps_process_type ON public.process_maps(process_type);
CREATE INDEX IF NOT EXISTS idx_process_maps_process_name ON public.process_maps(process_name);
CREATE INDEX IF NOT EXISTS idx_process_maps_org_type_name ON public.process_maps(clerk_org_id, process_type, process_name);

-- Enable RLS
ALTER TABLE public.process_maps ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only view/manage process maps for their organization
CREATE POLICY "Users can view process maps in their org" ON public.process_maps
    FOR SELECT
    USING (
        clerk_org_id IN (
            SELECT om.clerk_org_id
            FROM public.org_memberships om
            WHERE om.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can insert process maps in their org" ON public.process_maps
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.org_memberships om
            JOIN public.profiles p ON p.id = om.user_id
            WHERE om.user_id = auth.uid()
            AND om.clerk_org_id = clerk_org_id
            AND (p.is_admin = true OR om.role IN ('admin', 'owner'))
        )
    );

CREATE POLICY "Admins can update process maps in their org" ON public.process_maps
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.org_memberships om
            JOIN public.profiles p ON p.id = om.user_id
            WHERE om.user_id = auth.uid()
            AND om.clerk_org_id = process_maps.clerk_org_id
            AND (p.is_admin = true OR om.role IN ('admin', 'owner'))
        )
    );

CREATE POLICY "Admins can delete process maps in their org" ON public.process_maps
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.org_memberships om
            JOIN public.profiles p ON p.id = om.user_id
            WHERE om.user_id = auth.uid()
            AND om.clerk_org_id = process_maps.clerk_org_id
            AND (p.is_admin = true OR om.role IN ('admin', 'owner'))
        )
    );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.update_process_maps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_process_maps_updated_at
    BEFORE UPDATE ON public.process_maps
    FOR EACH ROW
    EXECUTE FUNCTION public.update_process_maps_updated_at();

-- Add comment
COMMENT ON TABLE public.process_maps IS 'Stores AI-generated Mermaid process visualization charts for integrations and workflows';
