/*
  # Add contact identifier fields to activities and deals tables

  1. Changes
    - Add contact_identifier column to activities table
    - Add contact_identifier_type column to activities table
    - Add contact_identifier column to deals table
    - Add contact_identifier_type column to deals table

  2. Purpose
    - Enable unified tracking of contacts across different entity types
    - Support email, phone number, or LinkedIn URL as identifiers
    - Allow correlation between activities, deals, contacts, and companies
*/

-- Add contact identifier fields to activities table
ALTER TABLE activities 
ADD COLUMN contact_identifier text,
ADD COLUMN contact_identifier_type text;

-- Add contact identifier fields to deals table
ALTER TABLE deals
ADD COLUMN contact_identifier text,
ADD COLUMN contact_identifier_type text;

-- Add index for faster lookups
CREATE INDEX idx_activities_contact_identifier ON activities(contact_identifier);
CREATE INDEX idx_deals_contact_identifier ON deals(contact_identifier); 