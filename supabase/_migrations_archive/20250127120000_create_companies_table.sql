/*
  # Create Companies Table
  
  1. New Tables
    - `companies` table with domain-based auto-matching
    
  2. Updates
    - Works with existing `profiles` table instead of auth.users
    - Designed to integrate with existing 348 contacts
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create companies table (this doesn't exist yet)
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT UNIQUE, -- For auto-matching emails like @company.com
  industry TEXT,
  size TEXT CHECK (size IN ('startup', 'small', 'medium', 'large', 'enterprise')),
  website TEXT,
  address TEXT,
  phone TEXT,
  description TEXT,
  linkedin_url TEXT,
  owner_id UUID REFERENCES profiles(id) NOT NULL, -- Use profiles instead of auth.users
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_companies_domain ON companies(domain);
CREATE INDEX idx_companies_owner_id ON companies(owner_id);
CREATE INDEX idx_companies_name ON companies(name);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for companies
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Note: No RLS policies needed since we're using profiles table
-- and assuming existing RLS setup will handle authorization 