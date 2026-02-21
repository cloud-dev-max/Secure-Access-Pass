-- Migration 0007: V7.1 Personal Guest Limits & Visitor Pass Settings
-- Date: 2026-02-19
-- Description: Add personal guest limit override per resident and max visitor passes setting

-- ============================================================================
-- 1. ADD PERSONAL_GUEST_LIMIT TO PROFILES TABLE
-- ============================================================================

-- Add personal_guest_limit column (NULL = use global default)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS personal_guest_limit INTEGER;

-- Add comment explaining the column
COMMENT ON COLUMN profiles.personal_guest_limit IS 'Per-resident override for max accompanying guests. NULL uses global max_guests_per_resident setting from properties table.';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_personal_guest_limit ON profiles(personal_guest_limit);

-- ============================================================================
-- 2. ADD MAX_VISITOR_PASSES TO PROPERTIES TABLE
-- ============================================================================

-- Add max_visitor_passes column
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS max_visitor_passes INTEGER DEFAULT 100;

-- Add comment
COMMENT ON COLUMN properties.max_visitor_passes IS 'Maximum number of active visitor passes allowed at property at one time. Prevents unlimited pass creation.';

-- ============================================================================
-- 3. ADD LAST_SCAN_AT TO PROFILES (if not exists)
-- ============================================================================

-- Track last scan time for analytics
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_scan_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN profiles.last_scan_at IS 'Timestamp of last successful scan (entry or exit). Used for analytics and recent activity tracking.';

-- Create index for recent activity queries
CREATE INDEX IF NOT EXISTS idx_profiles_last_scan_at ON profiles(last_scan_at DESC);

-- ============================================================================
-- 4. UPDATE EXISTING RECORDS (OPTIONAL DEFAULTS)
-- ============================================================================

-- Set default personal_guest_limit to NULL (uses global setting)
-- No action needed - column defaults to NULL

-- Set reasonable default for max_visitor_passes if needed
UPDATE properties 
SET max_visitor_passes = 100 
WHERE max_visitor_passes IS NULL;

-- ============================================================================
-- 5. VERIFICATION QUERIES
-- ============================================================================

-- Verify columns were added
SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles' 
  AND column_name IN ('personal_guest_limit', 'last_scan_at')
ORDER BY column_name;

SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'properties' 
  AND column_name = 'max_visitor_passes';

-- ============================================================================
-- 6. EXAMPLE USAGE
-- ============================================================================

-- Set a resident to allow 8 guests (family of 8)
-- UPDATE profiles 
-- SET personal_guest_limit = 8 
-- WHERE email = 'resident@example.com';

-- Set property max visitor passes to 50
-- UPDATE properties 
-- SET max_visitor_passes = 50 
-- WHERE id = '00000000-0000-0000-0000-000000000001';

-- Query residents with custom limits
-- SELECT name, email, personal_guest_limit, 
--        COALESCE(personal_guest_limit, p.max_guests_per_resident) as effective_limit
-- FROM profiles pr
-- LEFT JOIN properties p ON pr.property_id = p.id
-- WHERE pr.role = 'resident';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
