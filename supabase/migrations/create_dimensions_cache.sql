-- Create table to track last export state for each item
-- This allows us to only export items that have changed since last export
CREATE TABLE IF NOT EXISTS public.dimensions_export_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  variation_id TEXT DEFAULT '',
  last_exported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  checksum TEXT NOT NULL, -- Hash of key fields to detect changes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(store_id, item_id, variation_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_dimensions_cache_store_item
  ON public.dimensions_export_cache(store_id, item_id);

CREATE INDEX IF NOT EXISTS idx_dimensions_cache_updated
  ON public.dimensions_export_cache(last_updated_at);

-- Add comment
COMMENT ON TABLE public.dimensions_export_cache IS 'Cache table to track last export state and avoid unnecessary API calls';
