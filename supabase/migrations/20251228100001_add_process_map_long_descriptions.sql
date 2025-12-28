-- Add long description column for expandable "View More" content on process maps
-- This enables a short description for cards and a detailed description for expansion

ALTER TABLE public.process_maps
ADD COLUMN IF NOT EXISTS description_long TEXT;

COMMENT ON COLUMN public.process_maps.description_long IS
  'Extended description with full workflow details, shown via View More expansion. Supports markdown.';
