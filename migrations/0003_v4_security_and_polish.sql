-- Migration 0003: V4 Security & Polish Update
-- Date: 2024-01-15
-- Description: Add PIN authentication and guest limits

-- ========================================================================
-- 1. Add access_pin column to profiles
-- ========================================================================
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS access_pin TEXT;

-- Add index for PIN lookups
CREATE INDEX IF NOT EXISTS idx_profiles_access_pin ON profiles(access_pin);

-- ========================================================================
-- 2. Add max_guests_per_resident to properties
-- ========================================================================
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS max_guests_per_resident INTEGER DEFAULT 3;

-- ========================================================================
-- 3. Update existing residents with random PINs
-- ========================================================================
-- Note: This generates random 4-digit PINs for existing residents
-- In production, you may want to notify residents of their new PIN

-- Generate random 4-digit PINs for all residents without one
UPDATE profiles
SET access_pin = CAST(1000 + ABS(RANDOM() % 9000) AS TEXT)
WHERE role = 'resident' 
  AND (access_pin IS NULL OR access_pin = '');

-- ========================================================================
-- 4. Add constraint to ensure PINs are exactly 4 digits
-- ========================================================================
-- Note: SQLite doesn't support CHECK constraints on existing tables easily
-- We'll handle validation in the application layer

-- ========================================================================
-- VERIFICATION QUERIES
-- ========================================================================
-- Check that all residents have PINs
-- SELECT COUNT(*) as residents_without_pin 
-- FROM profiles 
-- WHERE role = 'resident' 
--   AND (access_pin IS NULL OR access_pin = '');

-- Check max_guests setting
-- SELECT id, name, max_guests_per_resident 
-- FROM properties;

-- Sample resident with PIN
-- SELECT name, email, unit, access_pin 
-- FROM profiles 
-- WHERE role = 'resident' 
-- LIMIT 1;
