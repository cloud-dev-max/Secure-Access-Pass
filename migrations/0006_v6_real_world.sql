-- =====================================================
-- V6: Real World Logic Migration
-- PostgreSQL Compatible (Supabase)
-- =====================================================

-- 1. Add personal guest limit to profiles
-- Default: NULL (falls back to property setting)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS personal_guest_limit INTEGER DEFAULT NULL;

-- 2. Add active guests counter (current group size - 1)
-- Default: 0 (no guests currently with resident)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS active_guests INTEGER DEFAULT 0;

-- 3. Add index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_active_guests 
ON profiles(active_guests);

-- 4. Rename guest_passes to visitor_passes (terminology change)
-- NOTE: Only run if guest_passes exists and visitor_passes doesn't
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'guest_passes') 
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'visitor_passes') THEN
    ALTER TABLE guest_passes RENAME TO visitor_passes;
  END IF;
END $$;

-- 5. Update visitor_passes to require contact info
-- Add NOT NULL constraints (will fail if existing NULL values - clean data first)
-- NOTE: Comment out if you have existing NULL values
-- ALTER TABLE visitor_passes 
-- ALTER COLUMN guest_name SET NOT NULL,
-- ALTER COLUMN guest_email SET NOT NULL,
-- ALTER COLUMN guest_phone SET NOT NULL;

-- 6. Add broadcast_alerts table for health/safety announcements
CREATE TABLE IF NOT EXISTS broadcast_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  target_location TEXT DEFAULT 'INSIDE', -- Target users who are INSIDE
  recipients_count INTEGER DEFAULT 0 -- Count of users notified
);

-- 7. Create index for broadcast alerts
CREATE INDEX IF NOT EXISTS idx_broadcast_alerts_property_id 
ON broadcast_alerts(property_id);

CREATE INDEX IF NOT EXISTS idx_broadcast_alerts_created_at 
ON broadcast_alerts(created_at DESC);

-- 8. Add guest_count column to access_logs for group tracking
ALTER TABLE access_logs 
ADD COLUMN IF NOT EXISTS guest_count INTEGER DEFAULT 0;

-- 9. Add broadcast_type to access_logs for special events
ALTER TABLE access_logs 
ADD COLUMN IF NOT EXISTS event_type TEXT DEFAULT 'SCAN';
-- Values: 'SCAN', 'FORCE_EXIT', 'BROADCAST', 'GROUP_ENTRY', 'GROUP_EXIT'

-- 10. Update existing data: Set active_guests to 0 for all residents
UPDATE profiles 
SET active_guests = 0 
WHERE active_guests IS NULL;

-- 11. Comments for documentation
COMMENT ON COLUMN profiles.personal_guest_limit IS 'Personal accompanying guest limit (overrides property default if set)';
COMMENT ON COLUMN profiles.active_guests IS 'Current number of guests with this resident (0 = resident only)';
COMMENT ON COLUMN access_logs.guest_count IS 'Number of guests in this access event (for group entry/exit)';
COMMENT ON COLUMN access_logs.event_type IS 'Type of access event: SCAN, FORCE_EXIT, BROADCAST, GROUP_ENTRY, GROUP_EXIT';
COMMENT ON TABLE broadcast_alerts IS 'Health and safety alerts broadcast to residents currently inside the facility';

-- =====================================================
-- Migration Complete
-- =====================================================
