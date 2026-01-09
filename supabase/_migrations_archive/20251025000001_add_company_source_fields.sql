-- Add source tracking to companies table
-- Tracks where company was discovered (manual, fathom_meeting, enrichment, etc.)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- Track when company was first seen
ALTER TABLE companies ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT NOW();

-- Add case-insensitive index for faster domain lookups
CREATE INDEX IF NOT EXISTS idx_companies_domain_lower ON companies (LOWER(domain));

-- Add comment for documentation
COMMENT ON COLUMN companies.source IS 'Source of company discovery: manual, fathom_meeting, enrichment, import, etc.';
COMMENT ON COLUMN companies.first_seen_at IS 'Timestamp when company was first discovered in the system';
