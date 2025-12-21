-- Create process_maps table to store AI-generated process visualization charts
-- These charts are generated from integration/workflow analysis and rendered using Mermaid

CREATE TABLE IF NOT EXISTS public.process_maps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Organization scope (using org_id to match organization_memberships)
    org_id UUID NOT NULL,

    -- Process identification
    process_type TEXT NOT NULL, -- e.g., 'integration', 'workflow'
    process_name TEXT NOT NULL, -- e.g., 'hubspot', 'google', 'fathom', 'meeting_intelligence'

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
CREATE INDEX IF NOT EXISTS idx_process_maps_org_id ON public.process_maps(org_id);
CREATE INDEX IF NOT EXISTS idx_process_maps_process_type ON public.process_maps(process_type);
CREATE INDEX IF NOT EXISTS idx_process_maps_process_name ON public.process_maps(process_name);
CREATE INDEX IF NOT EXISTS idx_process_maps_org_type_name ON public.process_maps(org_id, process_type, process_name);

-- Enable RLS
ALTER TABLE public.process_maps ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only view/manage process maps for their organization
DROP POLICY IF EXISTS "org_members_view_process_maps" ON public.process_maps;
CREATE POLICY "org_members_view_process_maps" ON public.process_maps
    FOR SELECT
    TO authenticated
    USING (
        org_id IN (
            SELECT om.org_id FROM organization_memberships om WHERE om.user_id = auth.uid()
        )
        OR auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS "org_admins_insert_process_maps" ON public.process_maps;
CREATE POLICY "org_admins_insert_process_maps" ON public.process_maps
    FOR INSERT
    TO authenticated
    WITH CHECK (
        org_id IN (
            SELECT om.org_id FROM organization_memberships om
            WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
        )
        OR auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS "org_admins_update_process_maps" ON public.process_maps;
CREATE POLICY "org_admins_update_process_maps" ON public.process_maps
    FOR UPDATE
    TO authenticated
    USING (
        org_id IN (
            SELECT om.org_id FROM organization_memberships om
            WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
        )
        OR auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS "org_admins_delete_process_maps" ON public.process_maps;
CREATE POLICY "org_admins_delete_process_maps" ON public.process_maps
    FOR DELETE
    TO authenticated
    USING (
        org_id IN (
            SELECT om.org_id FROM organization_memberships om
            WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
        )
        OR auth.role() = 'service_role'
    );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.update_process_maps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_process_maps_updated_at ON public.process_maps;
CREATE TRIGGER trigger_update_process_maps_updated_at
    BEFORE UPDATE ON public.process_maps
    FOR EACH ROW
    EXECUTE FUNCTION public.update_process_maps_updated_at();

-- Add comment
COMMENT ON TABLE public.process_maps IS 'Stores AI-generated Mermaid process visualization charts for integrations and workflows';
