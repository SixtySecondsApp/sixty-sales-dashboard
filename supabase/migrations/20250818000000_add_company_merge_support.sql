-- Add company merge support
-- This migration adds the necessary tables and fields to support merging duplicate companies

-- Create company_merges audit table to track merge history
CREATE TABLE IF NOT EXISTS company_merges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  target_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  merged_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  merge_data JSONB DEFAULT '{}', -- Store details about what was merged
  is_rollback BOOLEAN DEFAULT false, -- Track if this is a rollback operation
  original_merge_id UUID REFERENCES company_merges(id), -- Reference to original merge if this is a rollback
  rollback_reason TEXT, -- Reason for rollback if applicable
  
  -- Constraints
  CHECK (source_company_id != target_company_id), -- Can't merge company into itself
  CHECK (merged_at <= NOW()), -- Merge date must be in the past or present
  CHECK (is_rollback = false OR (is_rollback = true AND original_merge_id IS NOT NULL))
);

-- Add merge-related fields to companies table
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS merged_into_id UUID REFERENCES companies(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS merge_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_merged BOOLEAN DEFAULT false;

-- Create indexes for performance
CREATE INDEX idx_company_merges_source_company ON company_merges(source_company_id);
CREATE INDEX idx_company_merges_target_company ON company_merges(target_company_id);
CREATE INDEX idx_company_merges_merged_by ON company_merges(merged_by);
CREATE INDEX idx_company_merges_merged_at ON company_merges(merged_at DESC);
CREATE INDEX idx_companies_merged_into ON companies(merged_into_id) WHERE merged_into_id IS NOT NULL;
CREATE INDEX idx_companies_is_merged ON companies(is_merged) WHERE is_merged = true;

-- Create constraints on companies table
ALTER TABLE companies 
ADD CONSTRAINT check_merge_consistency 
CHECK (
  (is_merged = true AND merged_into_id IS NOT NULL AND merge_date IS NOT NULL) OR 
  (is_merged = false AND merged_into_id IS NULL AND merge_date IS NULL)
);

-- Add updated_at trigger for company_merges
CREATE TRIGGER update_company_merges_updated_at 
    BEFORE UPDATE ON company_merges 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) for company_merges
ALTER TABLE company_merges ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for company_merges
-- Users can only see merges for companies they have access to
CREATE POLICY "Users can view company merges they have access to" ON company_merges
    FOR SELECT USING (
        source_company_id IN (
            SELECT id FROM companies 
            WHERE owner_id = auth.uid() 
            OR assigned_to = auth.uid()
        )
        OR target_company_id IN (
            SELECT id FROM companies 
            WHERE owner_id = auth.uid() 
            OR assigned_to = auth.uid()
        )
    );

-- Users can create merge records for companies they have access to
CREATE POLICY "Users can create company merges for accessible companies" ON company_merges
    FOR INSERT WITH CHECK (
        merged_by = auth.uid() 
        AND source_company_id IN (
            SELECT id FROM companies 
            WHERE owner_id = auth.uid() 
            OR assigned_to = auth.uid()
        )
        AND target_company_id IN (
            SELECT id FROM companies 
            WHERE owner_id = auth.uid() 
            OR assigned_to = auth.uid()
        )
    );

-- Function to get merge preview data
CREATE OR REPLACE FUNCTION get_company_merge_preview(
    source_company_ids UUID[],
    target_company_id UUID
)
RETURNS JSONB AS $$
DECLARE
    preview_data JSONB := '{}';
    deal_count INTEGER;
    contact_count INTEGER;
    activity_count INTEGER;
    task_count INTEGER;
    note_count INTEGER;
    client_count INTEGER;
    total_deal_value DECIMAL;
    total_mrr DECIMAL;
BEGIN
    -- Count deals to be transferred
    SELECT COUNT(*), COALESCE(SUM(value), 0), COALESCE(SUM(monthly_mrr), 0)
    INTO deal_count, total_deal_value, total_mrr
    FROM deals 
    WHERE company_id = ANY(source_company_ids) OR company = ANY(
        SELECT name FROM companies WHERE id = ANY(source_company_ids)
    );
    
    -- Count contacts to be transferred
    SELECT COUNT(*)
    INTO contact_count
    FROM contacts 
    WHERE company_id = ANY(source_company_ids) OR company_name = ANY(
        SELECT name FROM companies WHERE id = ANY(source_company_ids)
    );
    
    -- Count activities to be transferred  
    SELECT COUNT(*)
    INTO activity_count
    FROM activities 
    WHERE company_id = ANY(source_company_ids) OR client_name = ANY(
        SELECT name FROM companies WHERE id = ANY(source_company_ids)
    );
    
    -- Count tasks to be transferred
    SELECT COUNT(*)
    INTO task_count
    FROM tasks 
    WHERE company_id = ANY(source_company_ids) OR company = ANY(
        SELECT name FROM companies WHERE id = ANY(source_company_ids)
    );
    
    -- Count notes to be transferred
    SELECT COUNT(*)
    INTO note_count
    FROM company_notes 
    WHERE company_id = ANY(source_company_ids);
    
    -- Count client records to be transferred
    SELECT COUNT(*)
    INTO client_count
    FROM clients 
    WHERE deal_id IN (
        SELECT id FROM deals WHERE company_id = ANY(source_company_ids)
    ) OR company_name = ANY(
        SELECT name FROM companies WHERE id = ANY(source_company_ids)
    );
    
    -- Build preview JSON
    preview_data := jsonb_build_object(
        'deals', jsonb_build_object(
            'count', deal_count,
            'total_value', total_deal_value,
            'total_mrr', total_mrr
        ),
        'contacts', jsonb_build_object(
            'count', contact_count
        ),
        'activities', jsonb_build_object(
            'count', activity_count
        ),
        'tasks', jsonb_build_object(
            'count', task_count
        ),
        'notes', jsonb_build_object(
            'count', note_count
        ),
        'clients', jsonb_build_object(
            'count', client_count
        ),
        'source_companies', (
            SELECT jsonb_agg(jsonb_build_object(
                'id', id,
                'name', name,
                'status', status,
                'created_at', created_at
            ))
            FROM companies 
            WHERE id = ANY(source_company_ids)
        ),
        'target_company', (
            SELECT jsonb_build_object(
                'id', id,
                'name', name,
                'status', status,
                'created_at', created_at
            )
            FROM companies 
            WHERE id = target_company_id
        )
    );
    
    RETURN preview_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to execute company merge
CREATE OR REPLACE FUNCTION execute_company_merge(
    source_company_ids UUID[],
    target_company_id UUID,
    merge_data JSONB DEFAULT '{}'
)
RETURNS JSONB AS $$
DECLARE
    merge_record_id UUID;
    source_company_id UUID;
    target_company_name TEXT;
    transferred_data JSONB := '{}';
    deals_transferred INTEGER := 0;
    contacts_transferred INTEGER := 0;
    activities_transferred INTEGER := 0;
    tasks_transferred INTEGER := 0;
    notes_transferred INTEGER := 0;
    clients_transferred INTEGER := 0;
BEGIN
    -- Get target company name
    SELECT name INTO target_company_name 
    FROM companies 
    WHERE id = target_company_id;
    
    -- Validate that target company exists and is not merged
    IF target_company_name IS NULL OR EXISTS (
        SELECT 1 FROM companies WHERE id = target_company_id AND is_merged = true
    ) THEN
        RAISE EXCEPTION 'Target company not found or already merged';
    END IF;
    
    -- Begin merge process for each source company
    FOREACH source_company_id IN ARRAY source_company_ids LOOP
        -- Validate that source company exists and is not already merged
        IF NOT EXISTS (
            SELECT 1 FROM companies 
            WHERE id = source_company_id AND is_merged = false
        ) THEN
            RAISE EXCEPTION 'Source company % not found or already merged', source_company_id;
        END IF;
        
        -- Create merge audit record
        INSERT INTO company_merges (
            source_company_id, 
            target_company_id, 
            merged_by, 
            merge_data
        ) VALUES (
            source_company_id,
            target_company_id,
            auth.uid(),
            merge_data
        ) RETURNING id INTO merge_record_id;
        
        -- Transfer deals
        UPDATE deals 
        SET company_id = target_company_id,
            company = target_company_name,
            updated_at = NOW()
        WHERE company_id = source_company_id 
           OR (company_id IS NULL AND company = (
               SELECT name FROM companies WHERE id = source_company_id
           ));
        
        GET DIAGNOSTICS deals_transferred = ROW_COUNT;
        
        -- Transfer contacts
        UPDATE contacts 
        SET company_id = target_company_id,
            updated_at = NOW()
        WHERE company_id = source_company_id 
           OR (company_id IS NULL AND company_name = (
               SELECT name FROM companies WHERE id = source_company_id
           ));
        
        GET DIAGNOSTICS contacts_transferred = ROW_COUNT;
        
        -- Transfer activities
        UPDATE activities 
        SET company_id = target_company_id,
            client_name = target_company_name,
            updated_at = NOW()
        WHERE company_id = source_company_id 
           OR (company_id IS NULL AND client_name = (
               SELECT name FROM companies WHERE id = source_company_id
           ));
        
        GET DIAGNOSTICS activities_transferred = ROW_COUNT;
        
        -- Transfer tasks
        UPDATE tasks 
        SET company_id = target_company_id,
            company = target_company_name,
            updated_at = NOW()
        WHERE company_id = source_company_id 
           OR (company_id IS NULL AND company = (
               SELECT name FROM companies WHERE id = source_company_id
           ));
        
        GET DIAGNOSTICS tasks_transferred = ROW_COUNT;
        
        -- Transfer company notes
        UPDATE company_notes 
        SET company_id = target_company_id,
            updated_at = NOW()
        WHERE company_id = source_company_id;
        
        GET DIAGNOSTICS notes_transferred = ROW_COUNT;
        
        -- Update client records
        UPDATE clients 
        SET company_name = target_company_name,
            updated_at = NOW()
        WHERE company_name = (
            SELECT name FROM companies WHERE id = source_company_id
        );
        
        GET DIAGNOSTICS clients_transferred = ROW_COUNT;
        
        -- Mark source company as merged
        UPDATE companies 
        SET is_merged = true,
            merged_into_id = target_company_id,
            merge_date = NOW(),
            updated_at = NOW()
        WHERE id = source_company_id;
    END LOOP;
    
    -- Build transferred data summary
    transferred_data := jsonb_build_object(
        'merge_id', merge_record_id,
        'deals_transferred', deals_transferred,
        'contacts_transferred', contacts_transferred,
        'activities_transferred', activities_transferred,
        'tasks_transferred', tasks_transferred,
        'notes_transferred', notes_transferred,
        'clients_transferred', clients_transferred,
        'merged_at', NOW()
    );
    
    RETURN transferred_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get company deal statistics
CREATE OR REPLACE FUNCTION get_company_deal_stats(company_ids UUID[])
RETURNS TABLE(
    company_id UUID,
    deal_count INTEGER,
    total_value DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as company_id,
        COUNT(d.id)::INTEGER as deal_count,
        COALESCE(SUM(d.value), 0)::DECIMAL as total_value
    FROM unnest(company_ids) c(id)
    LEFT JOIN deals d ON (d.company_id = c.id OR d.company = (
        SELECT name FROM companies WHERE id = c.id
    ))
    GROUP BY c.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get company contact statistics
CREATE OR REPLACE FUNCTION get_company_contact_stats(company_ids UUID[])
RETURNS TABLE(
    company_id UUID,
    contact_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as company_id,
        COUNT(contacts.id)::INTEGER as contact_count
    FROM unnest(company_ids) c(id)
    LEFT JOIN contacts ON (contacts.company_id = c.id OR contacts.company_name = (
        SELECT name FROM companies WHERE id = c.id
    ))
    GROUP BY c.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_company_merge_preview(UUID[], UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION execute_company_merge(UUID[], UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION get_company_deal_stats(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_company_contact_stats(UUID[]) TO authenticated;

-- Comments for documentation
COMMENT ON TABLE company_merges IS 'Audit trail for company merge operations';
COMMENT ON COLUMN company_merges.source_company_id IS 'Company being merged (will be marked as merged)';
COMMENT ON COLUMN company_merges.target_company_id IS 'Company receiving the merged data';
COMMENT ON COLUMN company_merges.merge_data IS 'JSON data about merge preferences and metadata';
COMMENT ON FUNCTION get_company_merge_preview(UUID[], UUID) IS 'Preview what data will be transferred in a company merge';
COMMENT ON FUNCTION execute_company_merge(UUID[], UUID, JSONB) IS 'Execute a company merge operation with full audit trail';