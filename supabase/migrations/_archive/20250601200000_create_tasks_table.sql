/*
  # Create Tasks Table for CRM Integration

  1. New Table
    - tasks: Advanced task management with CRM integration
    - Connects to users (sales reps), deals, companies, and contacts
    - Supports priority levels, status tracking, and task types
    - Includes proper RLS policies for security

  2. Features
    - Task assignment to sales reps
    - Integration with companies, contacts, and deals
    - Due date tracking with automatic overdue detection
    - Priority and status management
    - Notes and description fields
    - Completion tracking
    - Legacy contact fields for backward compatibility

  3. CRM Integration
    - Links to companies table for organization context
    - Links to contacts table for person context
    - Links to deals table for sales context
    - Maintains legacy fields for existing data compatibility
*/

-- Create tasks table with enhanced CRM integration
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  notes TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'overdue')),
  task_type TEXT DEFAULT 'general' CHECK (task_type IN ('call', 'email', 'meeting', 'follow_up', 'proposal', 'demo', 'general')),
  
  -- User relationships
  assigned_to UUID REFERENCES auth.users(id) NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  
  -- CRM relationships (new)
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  
  -- Legacy contact fields for backward compatibility
  contact_email TEXT,
  contact_name TEXT,
  company TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CHECK (due_date IS NULL OR due_date > created_at),
  
  -- At least one contact method should be specified
  CHECK (
    company_id IS NOT NULL OR 
    contact_id IS NOT NULL OR 
    contact_email IS NOT NULL OR 
    deal_id IS NOT NULL
  )
);

-- Create indexes for better performance
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_created_by ON tasks(created_by);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_task_type ON tasks(task_type);
CREATE INDEX idx_tasks_completed ON tasks(completed);

-- CRM relationship indexes
CREATE INDEX idx_tasks_deal_id ON tasks(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX idx_tasks_company_id ON tasks(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_tasks_contact_id ON tasks(contact_id) WHERE contact_id IS NOT NULL;

-- Legacy field indexes
CREATE INDEX idx_tasks_contact_email ON tasks(contact_email) WHERE contact_email IS NOT NULL;
CREATE INDEX idx_tasks_created_at ON tasks(created_at);

-- Composite indexes for common queries
CREATE INDEX idx_tasks_assigned_status ON tasks(assigned_to, status) WHERE status != 'completed';
CREATE INDEX idx_tasks_due_date_status ON tasks(due_date, status) WHERE status NOT IN ('completed', 'cancelled');

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Apply trigger to tasks table
CREATE TRIGGER update_tasks_updated_at 
    BEFORE UPDATE ON tasks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically update overdue tasks
CREATE OR REPLACE FUNCTION update_overdue_tasks()
RETURNS void AS $$
BEGIN
    UPDATE tasks 
    SET status = 'overdue'
    WHERE due_date < NOW() 
      AND status NOT IN ('completed', 'cancelled')
      AND completed = false;
END;
$$ LANGUAGE 'plpgsql';

-- Function to auto-populate contact/company info from relationships
CREATE OR REPLACE FUNCTION sync_task_contact_info()
RETURNS TRIGGER AS $$
BEGIN
    -- If company_id is set, populate company name
    IF NEW.company_id IS NOT NULL AND (NEW.company IS NULL OR NEW.company = '') THEN
        SELECT name INTO NEW.company 
        FROM companies 
        WHERE id = NEW.company_id;
    END IF;
    
    -- If contact_id is set, populate contact info
    IF NEW.contact_id IS NOT NULL THEN
        SELECT 
            COALESCE(full_name, CONCAT(first_name, ' ', last_name), email),
            email,
            companies.name
        INTO NEW.contact_name, NEW.contact_email, NEW.company
        FROM contacts 
        LEFT JOIN companies ON contacts.company_id = companies.id
        WHERE contacts.id = NEW.contact_id;
    END IF;
    
    -- If deal_id is set, populate from deal info
    IF NEW.deal_id IS NOT NULL AND (NEW.company IS NULL OR NEW.contact_email IS NULL) THEN
        SELECT 
            COALESCE(NEW.company, deals.company),
            COALESCE(NEW.contact_email, deals.contact_email),
            COALESCE(NEW.contact_name, deals.contact_name)
        INTO NEW.company, NEW.contact_email, NEW.contact_name
        FROM deals 
        WHERE deals.id = NEW.deal_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Apply sync trigger
CREATE TRIGGER sync_task_contact_info_trigger
    BEFORE INSERT OR UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION sync_task_contact_info();

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view tasks assigned to them, created by them, or related to their deals
CREATE POLICY "Users can view their tasks" ON tasks 
FOR SELECT USING (
  assigned_to = auth.uid() OR 
  created_by = auth.uid() OR
  deal_id IN (SELECT id FROM deals WHERE owner_id = auth.uid())
);

-- Users can insert tasks they create
CREATE POLICY "Users can create tasks" ON tasks 
FOR INSERT WITH CHECK (
  created_by = auth.uid() AND 
  (
    assigned_to = auth.uid() OR 
    assigned_to IN (SELECT id FROM auth.users WHERE id = assigned_to) OR
    deal_id IN (SELECT id FROM deals WHERE owner_id = auth.uid())
  )
);

-- Users can update tasks assigned to them, created by them, or related to their deals
CREATE POLICY "Users can update their tasks" ON tasks 
FOR UPDATE USING (
  assigned_to = auth.uid() OR 
  created_by = auth.uid() OR
  deal_id IN (SELECT id FROM deals WHERE owner_id = auth.uid())
);

-- Users can delete tasks they created or are assigned to
CREATE POLICY "Users can delete their tasks" ON tasks 
FOR DELETE USING (
  created_by = auth.uid() OR 
  assigned_to = auth.uid()
);

-- Create a view for tasks with joined data
CREATE OR REPLACE VIEW tasks_with_relations AS
SELECT 
  t.*,
  -- Assignee info
  assignee.first_name as assignee_first_name,
  assignee.last_name as assignee_last_name,
  assignee.email as assignee_email,
  assignee.avatar_url as assignee_avatar_url,
  
  -- Creator info  
  creator.first_name as creator_first_name,
  creator.last_name as creator_last_name,
  creator.email as creator_email,
  
  -- Company info
  comp.name as company_name,
  comp.domain as company_domain,
  comp.industry as company_industry,
  
  -- Contact info
  cont.first_name as contact_first_name,
  cont.last_name as contact_last_name,
  cont.email as contact_email_verified,
  cont.phone as contact_phone,
  cont.title as contact_title,
  
  -- Deal info
  deal.name as deal_name,
  deal.value as deal_value,
  deal.stage_id as deal_stage_id,
  stage.name as deal_stage_name
  
FROM tasks t
LEFT JOIN profiles assignee ON t.assigned_to = assignee.id
LEFT JOIN profiles creator ON t.created_by = creator.id
LEFT JOIN companies comp ON t.company_id = comp.id
LEFT JOIN contacts cont ON t.contact_id = cont.id
LEFT JOIN deals deal ON t.deal_id = deal.id
LEFT JOIN deal_stages stage ON deal.stage_id = stage.id;

-- Grant permissions on the view
GRANT SELECT ON tasks_with_relations TO authenticated;

-- Insert sample data for demonstration
DO $$
DECLARE
    sample_user_id UUID;
    sample_company_id UUID;
    sample_contact_id UUID;
    sample_deal_id UUID;
BEGIN
    -- Get a sample user ID
    SELECT id INTO sample_user_id FROM auth.users LIMIT 1;
    
    -- Get sample company, contact, and deal IDs if they exist
    SELECT id INTO sample_company_id FROM companies LIMIT 1;
    SELECT id INTO sample_contact_id FROM contacts LIMIT 1;
    SELECT id INTO sample_deal_id FROM deals LIMIT 1;
    
    -- Only insert if we have a user
    IF sample_user_id IS NOT NULL THEN
        INSERT INTO tasks (
            title, 
            description, 
            due_date, 
            priority, 
            status, 
            task_type, 
            assigned_to, 
            created_by, 
            company_id,
            contact_id,
            deal_id,
            contact_email, 
            contact_name, 
            company
        ) VALUES 
        (
            'Follow up with discovery call', 
            'Schedule follow-up meeting to discuss their requirements in detail',
            NOW() + INTERVAL '2 days',
            'high',
            'pending',
            'follow_up',
            sample_user_id,
            sample_user_id,
            sample_company_id,
            sample_contact_id,
            sample_deal_id,
            'john@example.com',
            'John Smith',
            'Example Corp'
        ),
        (
            'Send proposal document',
            'Prepare and send the customized proposal based on discovery call notes',
            NOW() + INTERVAL '5 days',
            'high',
            'pending',
            'proposal',
            sample_user_id,
            sample_user_id,
            sample_company_id,
            NULL,
            sample_deal_id,
            'sarah@techflow.com',
            'Sarah Johnson',
            'TechFlow Solutions'
        ),
        (
            'Product demo scheduled',
            'Demonstrate key features that align with their use case',
            NOW() + INTERVAL '1 day',
            'medium',
            'in_progress',
            'demo',
            sample_user_id,
            sample_user_id,
            NULL,
            sample_contact_id,
            NULL,
            'mike@industry.com',
            'Mike Davis',
            'Industry Inc'
        )
        ON CONFLICT DO NOTHING;
    END IF;
END $$;