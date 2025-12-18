-- Allow org members to view/queue call indexing
-- Needed for Conversation Intelligence (calls + meetings) UI to show progress and trigger indexing.

ALTER TABLE call_index_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_file_search_index ENABLE ROW LEVEL SECURITY;

-- call_index_queue
DROP POLICY IF EXISTS "org_select_call_index_queue" ON call_index_queue;
CREATE POLICY "org_select_call_index_queue" ON call_index_queue FOR SELECT
  USING (
    public.is_service_role()
    OR can_access_org_data(org_id)
  );

DROP POLICY IF EXISTS "org_insert_call_index_queue" ON call_index_queue;
CREATE POLICY "org_insert_call_index_queue" ON call_index_queue FOR INSERT
  WITH CHECK (
    public.is_service_role()
    OR (can_access_org_data(org_id) AND (owner_user_id = (SELECT auth.uid()) OR owner_user_id IS NULL))
  );

DROP POLICY IF EXISTS "org_update_call_index_queue" ON call_index_queue;
CREATE POLICY "org_update_call_index_queue" ON call_index_queue FOR UPDATE
  USING (
    public.is_service_role()
    OR can_access_org_data(org_id)
  )
  WITH CHECK (
    public.is_service_role()
    OR can_access_org_data(org_id)
  );

DROP POLICY IF EXISTS "org_delete_call_index_queue" ON call_index_queue;
CREATE POLICY "org_delete_call_index_queue" ON call_index_queue FOR DELETE
  USING (
    public.is_service_role()
    OR can_access_org_data(org_id)
  );

-- call_file_search_index
DROP POLICY IF EXISTS "org_select_call_file_search_index" ON call_file_search_index;
CREATE POLICY "org_select_call_file_search_index" ON call_file_search_index FOR SELECT
  USING (
    public.is_service_role()
    OR can_access_org_data(org_id)
  );

DROP POLICY IF EXISTS "service_role_manage_call_file_search_index" ON call_file_search_index;
CREATE POLICY "service_role_manage_call_file_search_index" ON call_file_search_index FOR ALL
  USING (public.is_service_role())
  WITH CHECK (public.is_service_role());






