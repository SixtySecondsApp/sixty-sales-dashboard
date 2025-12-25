-- Add horizontal and vertical Mermaid code columns to process_maps
-- This allows storing both views for each process map:
-- - Horizontal (LR) for card thumbnails
-- - Vertical (TB) for modal/detail view

-- Add new columns for dual view support
ALTER TABLE public.process_maps
ADD COLUMN IF NOT EXISTS mermaid_code_horizontal TEXT,
ADD COLUMN IF NOT EXISTS mermaid_code_vertical TEXT,
ADD COLUMN IF NOT EXISTS generation_status TEXT DEFAULT 'complete';

-- Migrate existing mermaid_code to mermaid_code_vertical (as that was the common default)
UPDATE public.process_maps
SET mermaid_code_vertical = mermaid_code
WHERE mermaid_code IS NOT NULL
  AND mermaid_code_vertical IS NULL;

-- Add comment for new columns
COMMENT ON COLUMN public.process_maps.mermaid_code_horizontal IS 'Mermaid code with LR (left-right) flow direction for card thumbnails';
COMMENT ON COLUMN public.process_maps.mermaid_code_vertical IS 'Mermaid code with TB (top-bottom) flow direction for modal/detail view';
COMMENT ON COLUMN public.process_maps.generation_status IS 'Status of generation: pending, partial (one view ready), complete (both views ready)';
