-- Migration 0005: V5 Professional & SaaS Update
-- Date: 2024-01-15
-- Description: Multi-property architecture, UI polish, and guest logic overhaul

-- ========================================================================
-- 1. Add SaaS columns to properties table
-- ========================================================================

-- Add owner_id for multi-tenant support
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS owner_id UUID;

-- Add property_name for customizable pool names
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS property_name TEXT DEFAULT 'Pool Access System';

-- Create index for owner lookups
CREATE INDEX IF NOT EXISTS idx_properties_owner_id ON properties(owner_id);

-- ========================================================================
-- 2. Update existing properties with default values
-- ========================================================================

-- Set default owner_id for existing properties (can be updated by managers)
UPDATE properties
SET owner_id = '00000000-0000-0000-0000-000000000000'
WHERE owner_id IS NULL;

-- Set property_name from existing name column if available
UPDATE properties
SET property_name = COALESCE(name, 'Pool Access System')
WHERE property_name = 'Pool Access System';

-- ========================================================================
-- 3. Rename max_guests_per_resident column for clarity
-- ========================================================================

-- Note: SQLite doesn't support column rename easily, so we keep the column name
-- but update the UI terminology to "Accompanying Guest Limit"
-- The column max_guests_per_resident remains but represents accompanying guests

-- ========================================================================
-- 4. Ensure guest_passes table exists (may have been created in V3)
-- ========================================================================

CREATE TABLE IF NOT EXISTS guest_passes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  purchased_by TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  guest_name TEXT,
  guest_email TEXT,
  guest_phone TEXT,
  qr_code TEXT UNIQUE NOT NULL,
  price_paid REAL DEFAULT 5.00,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired')),
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  notes TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_guest_passes_qr_code ON guest_passes(qr_code);
CREATE INDEX IF NOT EXISTS idx_guest_passes_property_id ON guest_passes(property_id);
CREATE INDEX IF NOT EXISTS idx_guest_passes_purchased_by ON guest_passes(purchased_by);
CREATE INDEX IF NOT EXISTS idx_guest_passes_status ON guest_passes(status);

-- ========================================================================
-- 5. Add scan_type for force exit logging
-- ========================================================================

-- Ensure access_logs can track FORCE_EXIT events
-- The scan_type column should allow 'ENTRY', 'EXIT', 'FORCE_EXIT'
-- No schema change needed - we'll just use the existing scan_type column

-- ========================================================================
-- VERIFICATION QUERIES
-- ========================================================================

-- Check properties have owner_id and property_name
-- SELECT id, name, property_name, owner_id FROM properties;

-- Check guest_passes table structure
-- SELECT * FROM sqlite_master WHERE type='table' AND name='guest_passes';

-- Verify indexes
-- SELECT name FROM sqlite_master WHERE type='index' AND tbl_name IN ('properties', 'guest_passes');
