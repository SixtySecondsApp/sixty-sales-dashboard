-- Add missing columns to user_automation_rules table
ALTER TABLE public.user_automation_rules 
ADD COLUMN IF NOT EXISTS test_scenarios JSONB DEFAULT '[]'::jsonb;

-- Add workflow_executions table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.workflow_executions (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    workflow_name TEXT,
    triggered_by TEXT NOT NULL,
    trigger_data JSONB,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL,
    node_executions JSONB,
    final_output JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON public.workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON public.workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_created_by ON public.workflow_executions(created_by);

-- Enable Row Level Security (RLS)
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for workflow_executions
-- Policy: Users can view their own executions
CREATE POLICY "Users can view own executions" ON public.workflow_executions
    FOR SELECT
    USING (created_by = auth.uid() OR auth.uid() IS NOT NULL);

-- Policy: Authenticated users can create executions
CREATE POLICY "Authenticated users can create executions" ON public.workflow_executions
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Users can update their own executions
CREATE POLICY "Users can update own executions" ON public.workflow_executions
    FOR UPDATE
    USING (created_by = auth.uid());

-- Policy: Users can delete their own executions
CREATE POLICY "Users can delete own executions" ON public.workflow_executions
    FOR DELETE
    USING (created_by = auth.uid());