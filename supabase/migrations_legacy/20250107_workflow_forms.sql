-- Create workflow_forms table to store form configurations
CREATE TABLE IF NOT EXISTS public.workflow_forms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    form_id TEXT UNIQUE NOT NULL,
    workflow_id TEXT,
    config JSONB NOT NULL,
    is_test BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_workflow_forms_form_id ON public.workflow_forms(form_id);
CREATE INDEX IF NOT EXISTS idx_workflow_forms_workflow_id ON public.workflow_forms(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_forms_created_by ON public.workflow_forms(created_by);

-- Enable Row Level Security (RLS)
ALTER TABLE public.workflow_forms ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Policy: Users can view all forms (for now - you may want to restrict this)
CREATE POLICY "Users can view forms" ON public.workflow_forms
    FOR SELECT
    USING (true);

-- Policy: Authenticated users can create forms
CREATE POLICY "Authenticated users can create forms" ON public.workflow_forms
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Users can update their own forms
CREATE POLICY "Users can update own forms" ON public.workflow_forms
    FOR UPDATE
    USING (created_by = auth.uid() OR auth.uid() IS NOT NULL);

-- Policy: Users can delete their own forms
CREATE POLICY "Users can delete own forms" ON public.workflow_forms
    FOR DELETE
    USING (created_by = auth.uid() OR auth.uid() IS NOT NULL);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workflow_forms_updated_at
    BEFORE UPDATE ON public.workflow_forms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();