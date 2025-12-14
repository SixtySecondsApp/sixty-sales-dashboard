-- Add missing foreign key constraints to meetings table for PostgREST relationships

-- Add foreign key constraint for created_by -> profiles
ALTER TABLE meetings 
ADD CONSTRAINT IF NOT EXISTS fk_meetings_created_by 
FOREIGN KEY (created_by) REFERENCES profiles(id);

-- Add foreign key constraint for deal_id -> deals  
ALTER TABLE meetings 
ADD CONSTRAINT IF NOT EXISTS fk_meetings_deal_id 
FOREIGN KEY (deal_id) REFERENCES deals(id);

-- Add foreign key constraint for company_id -> companies
ALTER TABLE meetings 
ADD CONSTRAINT IF NOT EXISTS fk_meetings_company_id 
FOREIGN KEY (company_id) REFERENCES companies(id);

-- Add foreign key constraint for contact_id -> contacts
ALTER TABLE meetings 
ADD CONSTRAINT IF NOT EXISTS fk_meetings_contact_id 
FOREIGN KEY (contact_id) REFERENCES contacts(id);\n
