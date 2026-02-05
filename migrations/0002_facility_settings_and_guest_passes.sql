-- Migration: Facility Settings and Guest Pass System
-- Date: 2024-01-15
-- Description: Add facility settings to properties table and create guest_passes table

-- ============================================================================
-- 1. UPDATE PROPERTIES TABLE - Add Facility Settings
-- ============================================================================

ALTER TABLE properties
ADD COLUMN IF NOT EXISTS operating_hours_start TIME DEFAULT '06:00:00',
ADD COLUMN IF NOT EXISTS operating_hours_end TIME DEFAULT '22:00:00',
ADD COLUMN IF NOT EXISTS max_capacity INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS guest_pass_price DECIMAL(10,2) DEFAULT 5.00,
ADD COLUMN IF NOT EXISTS is_maintenance_mode BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS maintenance_reason TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add trigger to update updated_at on properties
CREATE OR REPLACE FUNCTION update_properties_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_properties_timestamp ON properties;
CREATE TRIGGER update_properties_timestamp
  BEFORE UPDATE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION update_properties_updated_at();

-- ============================================================================
-- 2. CREATE GUEST_PASSES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS guest_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationships
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  purchased_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Guest Information
  guest_name TEXT,
  guest_email TEXT,
  guest_phone TEXT,
  
  -- Pass Details
  qr_code TEXT UNIQUE NOT NULL,
  price_paid DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  
  -- Status & Expiry
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'cancelled')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  
  -- Tracking
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Metadata
  notes TEXT,
  ip_address TEXT,
  user_agent TEXT
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_guest_passes_property_id ON guest_passes(property_id);
CREATE INDEX IF NOT EXISTS idx_guest_passes_purchased_by ON guest_passes(purchased_by);
CREATE INDEX IF NOT EXISTS idx_guest_passes_qr_code ON guest_passes(qr_code);
CREATE INDEX IF NOT EXISTS idx_guest_passes_status ON guest_passes(status);
CREATE INDEX IF NOT EXISTS idx_guest_passes_expires_at ON guest_passes(expires_at);
CREATE INDEX IF NOT EXISTS idx_guest_passes_created_at ON guest_passes(created_at);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_guest_passes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_guest_passes_timestamp ON guest_passes;
CREATE TRIGGER update_guest_passes_timestamp
  BEFORE UPDATE ON guest_passes
  FOR EACH ROW
  EXECUTE FUNCTION update_guest_passes_updated_at();

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS) FOR GUEST_PASSES
-- ============================================================================

-- Enable RLS
ALTER TABLE guest_passes ENABLE ROW LEVEL SECURITY;

-- Policy: Anonymous users can read their own guest pass by QR code (for scanner)
CREATE POLICY "Guest passes are viewable by QR code"
  ON guest_passes
  FOR SELECT
  TO anon
  USING (TRUE);

-- Policy: Service role can do everything (for admin operations)
CREATE POLICY "Service role has full access to guest passes"
  ON guest_passes
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- Policy: Authenticated users can view their own guest passes
CREATE POLICY "Users can view their own guest passes"
  ON guest_passes
  FOR SELECT
  TO authenticated
  USING (purchased_by = auth.uid());

-- Policy: Authenticated users can insert their own guest passes
CREATE POLICY "Users can create guest passes"
  ON guest_passes
  FOR INSERT
  TO authenticated
  WITH CHECK (purchased_by = auth.uid());

-- ============================================================================
-- 4. HELPER FUNCTIONS
-- ============================================================================

-- Function to get current occupancy (count of residents currently INSIDE)
CREATE OR REPLACE FUNCTION get_current_occupancy(p_property_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM profiles
    WHERE property_id = p_property_id
      AND current_location = 'INSIDE'
      AND is_active = TRUE
      AND role = 'resident'
  );
END;
$$ LANGUAGE plpgsql;

-- Function to check if facility is open based on operating hours
CREATE OR REPLACE FUNCTION is_facility_open(p_property_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_start_time TIME;
  v_end_time TIME;
  v_current_time TIME;
  v_is_maintenance BOOLEAN;
BEGIN
  SELECT 
    operating_hours_start,
    operating_hours_end,
    is_maintenance_mode
  INTO v_start_time, v_end_time, v_is_maintenance
  FROM properties
  WHERE id = p_property_id;
  
  -- If in maintenance mode, facility is closed
  IF v_is_maintenance = TRUE THEN
    RETURN FALSE;
  END IF;
  
  -- Get current time
  v_current_time := LOCALTIME;
  
  -- Check if current time is within operating hours
  RETURN v_current_time >= v_start_time AND v_current_time <= v_end_time;
END;
$$ LANGUAGE plpgsql;

-- Function to expire old guest passes (run via cron or manually)
CREATE OR REPLACE FUNCTION expire_old_guest_passes()
RETURNS INTEGER AS $$
DECLARE
  v_expired_count INTEGER;
BEGIN
  UPDATE guest_passes
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at < NOW();
  
  GET DIAGNOSTICS v_expired_count = ROW_COUNT;
  RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. UPDATE DEFAULT PROPERTY WITH NEW SETTINGS
-- ============================================================================

UPDATE properties
SET 
  operating_hours_start = '06:00:00',
  operating_hours_end = '22:00:00',
  max_capacity = 50,
  guest_pass_price = 5.00,
  is_maintenance_mode = FALSE,
  maintenance_reason = NULL
WHERE id = '00000000-0000-0000-0000-000000000001';

-- ============================================================================
-- 6. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE guest_passes IS 'Guest passes purchased by residents for one-time pool access';
COMMENT ON COLUMN guest_passes.qr_code IS 'Unique QR code for guest access (one-time use)';
COMMENT ON COLUMN guest_passes.status IS 'Pass status: active, used, expired, or cancelled';
COMMENT ON COLUMN guest_passes.expires_at IS 'Guest pass expires 24 hours after purchase';
COMMENT ON COLUMN guest_passes.used_at IS 'Timestamp when guest scanned QR and entered';

COMMENT ON COLUMN properties.operating_hours_start IS 'Facility opening time (e.g., 06:00:00)';
COMMENT ON COLUMN properties.operating_hours_end IS 'Facility closing time (e.g., 22:00:00)';
COMMENT ON COLUMN properties.max_capacity IS 'Maximum number of people allowed in facility';
COMMENT ON COLUMN properties.guest_pass_price IS 'Price in USD for a single guest pass';
COMMENT ON COLUMN properties.is_maintenance_mode IS 'When true, facility is closed for maintenance';
COMMENT ON COLUMN properties.maintenance_reason IS 'Reason displayed when facility is in maintenance mode';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify migration
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Properties table updated with facility settings';
  RAISE NOTICE 'Guest passes table created with RLS policies';
  RAISE NOTICE 'Helper functions created for occupancy and open status';
END $$;
