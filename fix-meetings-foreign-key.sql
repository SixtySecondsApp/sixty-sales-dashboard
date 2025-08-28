-- Fix meetings table foreign key constraints for PostgREST relationships

-- Check current foreign keys on meetings table
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='meetings';

-- Add missing foreign key constraints
ALTER TABLE meetings 
ADD CONSTRAINT fk_meetings_created_by 
FOREIGN KEY (created_by) REFERENCES profiles(id);

ALTER TABLE meetings 
ADD CONSTRAINT fk_meetings_deal_id 
FOREIGN KEY (deal_id) REFERENCES deals(id);

ALTER TABLE meetings 
ADD CONSTRAINT fk_meetings_company_id 
FOREIGN KEY (company_id) REFERENCES companies(id);

ALTER TABLE meetings 
ADD CONSTRAINT fk_meetings_contact_id 
FOREIGN KEY (contact_id) REFERENCES contacts(id);

-- Verify the constraints were added
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='meetings';