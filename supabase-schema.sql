-- ============================================================
-- SECURE ACCESS PASS - SUPABASE DATABASE SCHEMA
-- ============================================================
-- This schema implements a dynamic rule-based access control system
-- for apartment complex swimming pool access management.
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PROFILES TABLE
-- ============================================================
-- Stores resident information and their current location status
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  unit TEXT NOT NULL,
  phone TEXT,
  current_location TEXT NOT NULL DEFAULT 'OUTSIDE' CHECK (current_location IN ('INSIDE', 'OUTSIDE')),
  qr_code TEXT UNIQUE NOT NULL, -- Unique QR code identifier for this resident
  property_id UUID NOT NULL, -- Links to a property (for multi-property support)
  role TEXT NOT NULL DEFAULT 'resident' CHECK (role IN ('manager', 'resident', 'scanner')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_scan_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX idx_profiles_qr_code ON profiles(qr_code);
CREATE INDEX idx_profiles_property_id ON profiles(property_id);
CREATE INDEX idx_profiles_auth_user_id ON profiles(auth_user_id);
CREATE INDEX idx_profiles_email ON profiles(email);

-- ============================================================
-- 2. PROPERTIES TABLE
-- ============================================================
-- Multi-property support for property management companies
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add foreign key constraint to profiles
ALTER TABLE profiles 
  ADD CONSTRAINT fk_profiles_property 
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;

-- ============================================================
-- 3. ACCESS_RULES TABLE
-- ============================================================
-- Stores the DEFINITIONS of access rules (created by managers)
-- Examples: "Rent Paid", "Lease Compliant", "Gym Waiver Signed", "Pet Deposit"
CREATE TABLE access_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true, -- Managers can disable rules globally
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(property_id, rule_name) -- Prevent duplicate rule names per property
);

-- Indexes for performance
CREATE INDEX idx_access_rules_property_id ON access_rules(property_id);
CREATE INDEX idx_access_rules_is_active ON access_rules(is_active);

-- ============================================================
-- 4. USER_RULE_STATUS TABLE
-- ============================================================
-- Links a USER to a RULE with their current status (Pass/Fail)
-- This is the "toggle system" that managers control
CREATE TABLE user_rule_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES access_rules(id) ON DELETE CASCADE,
  status BOOLEAN NOT NULL DEFAULT false, -- true = PASS, false = FAIL
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, rule_id) -- Each user has ONE status per rule
);

-- Indexes for performance
CREATE INDEX idx_user_rule_status_user_id ON user_rule_status(user_id);
CREATE INDEX idx_user_rule_status_rule_id ON user_rule_status(rule_id);
CREATE INDEX idx_user_rule_status_status ON user_rule_status(status);

-- ============================================================
-- 5. ACCESS_LOGS TABLE
-- ============================================================
-- Audit trail of all access attempts (for compliance and analytics)
CREATE TABLE access_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  qr_code TEXT NOT NULL,
  scan_type TEXT NOT NULL CHECK (scan_type IN ('ENTRY', 'EXIT')),
  result TEXT NOT NULL CHECK (result IN ('GRANTED', 'DENIED')),
  denial_reason TEXT, -- Stores the specific rule name that failed
  location_before TEXT,
  location_after TEXT,
  scanned_by UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Scanner device/user
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

-- Indexes for performance and analytics
CREATE INDEX idx_access_logs_user_id ON access_logs(user_id);
CREATE INDEX idx_access_logs_property_id ON access_logs(property_id);
CREATE INDEX idx_access_logs_scanned_at ON access_logs(scanned_at DESC);
CREATE INDEX idx_access_logs_result ON access_logs(result);
CREATE INDEX idx_access_logs_scan_type ON access_logs(scan_type);

-- ============================================================
-- 6. TRIGGERS FOR UPDATED_AT
-- ============================================================
-- Automatically update the updated_at timestamp

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_access_rules_updated_at BEFORE UPDATE ON access_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_rule_status_updated_at BEFORE UPDATE ON user_rule_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_rule_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read their own profile, managers can read all in their property
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = auth_user_id);

CREATE POLICY "Managers can view all profiles in their property"
  ON profiles FOR SELECT
  USING (
    role = 'manager' AND property_id IN (
      SELECT property_id FROM profiles WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Managers can update profiles in their property"
  ON profiles FOR UPDATE
  USING (
    property_id IN (
      SELECT property_id FROM profiles 
      WHERE auth_user_id = auth.uid() AND role = 'manager'
    )
  );

CREATE POLICY "Managers can insert profiles in their property"
  ON profiles FOR INSERT
  WITH CHECK (
    property_id IN (
      SELECT property_id FROM profiles 
      WHERE auth_user_id = auth.uid() AND role = 'manager'
    )
  );

-- Properties: Users can view their own property
CREATE POLICY "Users can view their property"
  ON properties FOR SELECT
  USING (
    id IN (SELECT property_id FROM profiles WHERE auth_user_id = auth.uid())
  );

-- Access Rules: Users can view rules for their property
CREATE POLICY "Users can view access rules for their property"
  ON access_rules FOR SELECT
  USING (
    property_id IN (SELECT property_id FROM profiles WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Managers can manage access rules for their property"
  ON access_rules FOR ALL
  USING (
    property_id IN (
      SELECT property_id FROM profiles 
      WHERE auth_user_id = auth.uid() AND role = 'manager'
    )
  );

-- User Rule Status: Users can view their own status, managers can manage all
CREATE POLICY "Users can view their own rule status"
  ON user_rule_status FOR SELECT
  USING (
    user_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Managers can manage rule status for their property"
  ON user_rule_status FOR ALL
  USING (
    user_id IN (
      SELECT p.id FROM profiles p
      INNER JOIN profiles m ON m.property_id = p.property_id
      WHERE m.auth_user_id = auth.uid() AND m.role = 'manager'
    )
  );

-- Access Logs: Users can view their own logs, managers can view all
CREATE POLICY "Users can view their own access logs"
  ON access_logs FOR SELECT
  USING (
    user_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Managers can view all logs for their property"
  ON access_logs FOR SELECT
  USING (
    property_id IN (
      SELECT property_id FROM profiles 
      WHERE auth_user_id = auth.uid() AND role = 'manager'
    )
  );

CREATE POLICY "Scanner can insert access logs"
  ON access_logs FOR INSERT
  WITH CHECK (true); -- Allow all authenticated users to log scans

-- ============================================================
-- 8. SEED DATA (OPTIONAL - FOR TESTING)
-- ============================================================
-- Create a default property
INSERT INTO properties (id, name, address, city, state, zip_code)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Seaside Luxury Apartments',
  '123 Ocean Boulevard',
  'Miami Beach',
  'FL',
  '33139'
) ON CONFLICT DO NOTHING;

-- Create default access rules
INSERT INTO access_rules (property_id, rule_name, description, is_active)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Rent Paid', 'Resident has paid current month rent', true),
  ('00000000-0000-0000-0000-000000000001', 'Lease Compliant', 'Resident is in good standing with lease terms', true),
  ('00000000-0000-0000-0000-000000000001', 'Pool Rules Acknowledged', 'Resident has signed pool safety rules', true)
ON CONFLICT (property_id, rule_name) DO NOTHING;

-- ============================================================
-- 9. HELPER FUNCTIONS
-- ============================================================

-- Function to check if a user can access the facility
CREATE OR REPLACE FUNCTION check_user_access(
  p_qr_code TEXT,
  p_scan_type TEXT
)
RETURNS TABLE (
  can_access BOOLEAN,
  denial_reason TEXT,
  user_name TEXT,
  user_id UUID,
  current_location TEXT
) AS $$
DECLARE
  v_user_id UUID;
  v_user_name TEXT;
  v_user_location TEXT;
  v_property_id UUID;
  v_failed_rule TEXT;
BEGIN
  -- Get user details
  SELECT id, name, current_location, property_id
  INTO v_user_id, v_user_name, v_user_location, v_property_id
  FROM profiles
  WHERE qr_code = p_qr_code AND is_active = true;

  -- Check if user exists
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'Invalid QR Code'::TEXT, NULL::TEXT, NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;

  -- If EXIT mode, always allow (just update location)
  IF p_scan_type = 'EXIT' THEN
    RETURN QUERY SELECT true, NULL::TEXT, v_user_name, v_user_id, v_user_location;
    RETURN;
  END IF;

  -- ENTRY MODE: Check all active rules
  SELECT ar.rule_name INTO v_failed_rule
  FROM access_rules ar
  LEFT JOIN user_rule_status urs ON urs.rule_id = ar.id AND urs.user_id = v_user_id
  WHERE ar.property_id = v_property_id 
    AND ar.is_active = true
    AND (urs.status IS NULL OR urs.status = false)
  LIMIT 1;

  -- If any rule failed, deny access
  IF v_failed_rule IS NOT NULL THEN
    RETURN QUERY SELECT 
      false, 
      'Access Denied: ' || v_failed_rule || ' is False'::TEXT,
      v_user_name,
      v_user_id,
      v_user_location;
    RETURN;
  END IF;

  -- Check anti-passback
  IF v_user_location = 'INSIDE' THEN
    RETURN QUERY SELECT 
      false, 
      'Pass already in use'::TEXT,
      v_user_name,
      v_user_id,
      v_user_location;
    RETURN;
  END IF;

  -- All checks passed
  RETURN QUERY SELECT true, NULL::TEXT, v_user_name, v_user_id, v_user_location;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- END OF SCHEMA
-- ============================================================
