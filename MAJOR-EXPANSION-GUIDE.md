# Major Expansion Guide - Secure Access Pass v3.0

## 🎉 What's New

This major expansion transforms Secure Access Pass from a Manager-only dashboard into a complete facility management system with:

1. **Manager Settings Interface** - Configure facility operations
2. **Resident Portal** - Mobile-first interface for residents  
3. **Guest Pass System** - Purchase and share digital guest passes
4. **Smart Scanner** - Enforces global rules (hours, capacity, maintenance)

---

## 📦 Features Overview

### 1. Manager Settings (/dashboard/settings)

**Purpose**: Centralized facility configuration for property managers

**Settings Available**:
- **Operating Hours**: Set daily pool opening/closing times (e.g., 6:00 AM - 10:00 PM)
- **Max Capacity**: Maximum number of people allowed in facility
- **Guest Pass Price**: Price in USD for 24-hour guest passes
- **Maintenance Mode**: Close facility temporarily with custom reason message

**Access**: Navigate to Dashboard → Settings tab → "Manage Facility Settings" button

**UI Features**:
- Real-time form validation
- Toggle switch for maintenance mode
- Success/error message feedback
- Persists immediately to database

---

### 2. Resident Portal (/resident)

**Purpose**: Mobile-friendly interface for residents to access the pool

**Login Method**: Simple email lookup (no password required)
- Enter email address registered in system
- System looks up profile in `profiles` table
- Stores resident ID in localStorage for session persistence

**Dashboard Features**:

#### Live Facility Status
- Real-time OPEN/CLOSED indicator (green/red)
- Current occupancy count (e.g., "12 / 50 Residents")
- Operating hours display
- Maintenance reason (if facility closed)

#### My Pool Pass
- Large, scannable QR code display
- "Save to Photos" button for offline access
- QR code downloads as PNG image
- Name and unit displayed in header

#### Guest Pass Management
- "Buy Guest Pass" button
- Optional guest information form:
  - Guest Name
  - Guest Email
  - Guest Phone
- List of purchased passes with status:
  - ✅ **Active** (green) - Valid and unused
  - ✗ **Used** (gray) - Already scanned
  - ✗ **Expired** (red) - Past 24-hour window
- "Share" button for active passes

**Mobile Optimization**:
- Touch-friendly buttons
- Large QR code for easy scanning
- Responsive layout
- Native share menu integration

---

### 3. Guest Pass System

**Purchase Flow** (Resident's perspective):
1. Log into Resident Portal
2. Click "Buy Guest Pass"
3. Optionally enter guest details
4. System generates unique QR code
5. Pass expires in 24 hours
6. One-time use only

**Share Methods**:
1. **Mobile Share Menu** (if supported):
   - Uses `navigator.share()` API
   - Shares link via SMS, WhatsApp, Email, etc.
   
2. **Clipboard Fallback**:
   - Copies link to clipboard
   - User can paste into messaging app

**Guest's Experience** (/guest-pass/[id]):
1. Receive shareable link from resident
2. Open link on mobile device
3. See guest pass with QR code
4. View status (valid/used/expired)
5. Download QR code to phone
6. Show at pool entrance scanner

**Pass Status**:
- **Active**: Ready to use, shown in green
- **Used**: Already scanned once, shown in gray
- **Expired**: Past 24 hours, shown in red
- **Cancelled**: Manually cancelled by manager

**Database**:
```sql
guest_passes table:
  - id (UUID primary key)
  - property_id (FK to properties)
  - purchased_by (FK to profiles)
  - guest_name, guest_email, guest_phone (optional)
  - qr_code (unique identifier)
  - price_paid (copied from property settings)
  - status (active/used/expired/cancelled)
  - expires_at (created_at + 24 hours)
  - used_at (timestamp when scanned)
```

---

### 4. Smart Scanner with Global Rules

**Priority Order** (enforced in this sequence):

#### Step 1: Maintenance Mode Check
- **When**: ENTRY scans only
- **Rule**: If `is_maintenance_mode = TRUE` → DENY
- **Reason**: Displays `maintenance_reason` to user
- **Bypass**: None (absolute priority)

#### Step 2: Operating Hours Check
- **When**: ENTRY scans only
- **Rule**: Current time must be between `operating_hours_start` and `operating_hours_end`
- **Reason**: "Pool is closed. Operating hours: [start] - [end]"
- **Example**: If hours are 6:00-22:00 and user scans at 5:45 AM → DENY

#### Step 3: Maximum Capacity Check
- **When**: ENTRY scans only
- **Rule**: Current occupancy must be < `max_capacity`
- **Calculation**: Count profiles where `current_location = 'INSIDE'`
- **Reason**: "Facility is at maximum capacity (50 people)"

#### Step 4: Guest Pass Validation
- **Detection**: QR code matches `guest_passes.qr_code`
- **Checks**:
  1. Status must be 'active' (not 'used', 'expired', or 'cancelled')
  2. `expires_at` must be in the future
  3. One-time use only
- **Success**: Mark as used (`status = 'used'`, `used_at = NOW()`)
- **Failure Reasons**:
  - "This guest pass has already been used (one-time entry)"
  - "This guest pass has expired"
  - "This guest pass has been cancelled"

#### Step 5: Resident Access Check
- **Detection**: QR code matches `profiles.qr_code`
- **Checks**: Existing `check_user_access()` function:
  1. Valid QR code
  2. Active resident
  3. All access rules pass
  4. Anti-passback (not already INSIDE)
- **Success**: Update `current_location`, log access
- **Failure**: Log denial reason

**Scanner Output**:
```typescript
// Success
{
  can_access: true,
  user_name: "John Doe" | "Guest",
  denial_reason: null
}

// Failure
{
  can_access: false,
  user_name: "John Doe",
  denial_reason: "Pool is closed. Operating hours: 06:00:00 - 22:00:00"
}
```

---

## 🗄️ Database Migration

**File**: `migrations/0002_facility_settings_and_guest_passes.sql`

### New Columns in `properties` Table
```sql
ALTER TABLE properties ADD COLUMN
  operating_hours_start TIME DEFAULT '06:00:00',
  operating_hours_end TIME DEFAULT '22:00:00',
  max_capacity INTEGER DEFAULT 50,
  guest_pass_price DECIMAL(10,2) DEFAULT 5.00,
  is_maintenance_mode BOOLEAN DEFAULT FALSE,
  maintenance_reason TEXT;
```

### New `guest_passes` Table
```sql
CREATE TABLE guest_passes (
  id UUID PRIMARY KEY,
  property_id UUID REFERENCES properties(id),
  purchased_by UUID REFERENCES profiles(id),
  guest_name TEXT,
  guest_email TEXT,
  guest_phone TEXT,
  qr_code TEXT UNIQUE NOT NULL,
  price_paid DECIMAL(10,2) DEFAULT 0.00,
  status TEXT CHECK (status IN ('active', 'used', 'expired', 'cancelled')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- ... metadata fields
);
```

### Helper Functions
```sql
-- Get current occupancy
CREATE FUNCTION get_current_occupancy(p_property_id UUID) RETURNS INTEGER;

-- Check if facility is open
CREATE FUNCTION is_facility_open(p_property_id UUID) RETURNS BOOLEAN;

-- Expire old guest passes (cron job)
CREATE FUNCTION expire_old_guest_passes() RETURNS INTEGER;
```

### Row Level Security (RLS)
- Anonymous users can read guest passes by QR code (for scanner)
- Service role has full access (API routes use admin client)
- Authenticated users can view/create their own guest passes

---

## 🚀 Deployment Steps

### 1. Apply Database Migration
```bash
# Option A: Via Supabase Dashboard
# Copy contents of migrations/0002_facility_settings_and_guest_passes.sql
# Paste into SQL Editor and run

# Option B: Via Supabase CLI
npx supabase db push
```

### 2. Verify Migration Success
```sql
-- Check new columns in properties
SELECT 
  operating_hours_start, 
  operating_hours_end, 
  max_capacity, 
  guest_pass_price,
  is_maintenance_mode,
  maintenance_reason
FROM properties 
LIMIT 1;

-- Check guest_passes table exists
SELECT COUNT(*) FROM guest_passes;
```

### 3. Update Environment Variables
No new environment variables required. Existing `.env.local` is sufficient:
```bash
NEXT_PUBLIC_SUPABASE_URL=your-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_DEFAULT_PROPERTY_ID=00000000-0000-0000-0000-000000000001
```

### 4. Restart Development Server
```bash
npm run dev
```

### 5. Test Each Interface

#### Test Manager Settings
```bash
1. Navigate to http://localhost:3000/dashboard
2. Click Settings tab
3. Click "Manage Facility Settings"
4. Modify operating hours (e.g., 08:00 - 20:00)
5. Set max capacity (e.g., 30)
6. Set guest pass price (e.g., 10.00)
7. Toggle maintenance mode ON
8. Enter maintenance reason
9. Click "Save Settings"
10. Verify success message
```

#### Test Resident Portal
```bash
1. Navigate to http://localhost:3000/resident
2. Enter resident email (from existing profiles)
3. Click "Access Portal"
4. Verify:
   - Facility status shows (OPEN/CLOSED)
   - Occupancy count displays
   - QR code appears
   - Operating hours shown
5. Click "Save to Photos" → QR downloads
6. Logout and re-login to test persistence
```

#### Test Guest Pass System
```bash
1. Log into Resident Portal
2. Click "Buy Guest Pass"
3. Enter guest details (optional)
4. Click "Create Pass"
5. Verify guest pass appears in list
6. Click "Share" button
7. On mobile: Share menu opens
8. On desktop: Link copied to clipboard
9. Open shared link in incognito/new tab
10. Verify guest pass displays with QR code
11. Download QR code
```

#### Test Smart Scanner
```bash
# Scenario 1: Maintenance Mode
1. Enable maintenance mode in settings
2. Try scanning resident QR → Denied (maintenance reason shown)

# Scenario 2: Outside Hours
1. Set operating hours to future time
2. Try scanning resident QR → Denied (hours message shown)

# Scenario 3: Max Capacity
1. Set max capacity to 1
2. Scan one resident QR → Granted
3. Scan another resident QR → Denied (capacity message)

# Scenario 4: Guest Pass
1. Create guest pass
2. Scan guest QR → Granted (first time)
3. Scan same guest QR → Denied (already used)

# Scenario 5: Expired Guest Pass
1. Create guest pass
2. In database: UPDATE guest_passes SET expires_at = NOW() - INTERVAL '1 hour'
3. Scan guest QR → Denied (expired message)
```

---

## 📱 Mobile Testing Recommendations

### Resident Portal
- **Test Devices**: iPhone Safari, Android Chrome
- **Key Features**:
  - Email login form input
  - QR code legibility (should be scannable)
  - "Save to Photos" downloads PNG
  - Guest pass share menu (native on mobile)
  - Logout button accessible

### Guest Pass Page
- **Test Devices**: iPhone Safari, Android Chrome
- **Key Features**:
  - QR code displays full size
  - Status colors visible (green/gray/red)
  - Expiry timestamp formatted correctly
  - "Save QR Code" downloads image
  - No horizontal scrolling

### Scanner
- **Test Devices**: Tablet (iPad/Android)
- **Key Features**:
  - Camera initializes quickly
  - Scans QR codes reliably
  - Full-screen result overlay
  - Denial reasons readable
  - Easy to restart after scan

---

## 🔒 Security Considerations

### 1. Resident "Authentication"
- **Method**: Email lookup only (no password)
- **Storage**: Resident ID stored in localStorage
- **Security**: Low-security by design (suitable for pool access, not sensitive data)
- **Improvement**: For production, consider:
  - SMS-based OTP verification
  - Magic link via email
  - Supabase Auth integration

### 2. Guest Pass Sharing
- **Link Format**: `/guest-pass/[UUID]`
- **Security**: UUID is cryptographically random (hard to guess)
- **Public Access**: Anyone with link can view (by design)
- **Mitigation**: 24-hour expiry and one-time use

### 3. Admin API Routes
- **All management routes use Admin Client** (Service Role Key)
- **No client-side auth checks** (simulated auth for demo)
- **Production**: Add proper authentication middleware

### 4. Scanner Permissions
- **Camera access**: Required for QR scanning
- **No data collection**: QR code processed locally
- **Privacy**: No photos/videos stored

---

## 🐛 Troubleshooting

### Issue: Settings Not Saving
**Symptom**: Click "Save Settings", but changes don't persist

**Solution**:
1. Check browser console for errors
2. Verify API call to `/api/settings` succeeds (Network tab)
3. Check Supabase logs for RLS errors
4. Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.local`
5. Restart dev server after adding env vars

### Issue: Resident Login Fails
**Symptom**: "Resident not found" error even with valid email

**Solution**:
1. Check email spelling (case-insensitive, but whitespace matters)
2. Verify resident exists: `SELECT * FROM profiles WHERE email = 'test@example.com' AND role = 'resident'`
3. Ensure `is_active = TRUE`
4. Check API route logs for database errors

### Issue: Guest Pass Link Not Working
**Symptom**: 404 error when opening `/guest-pass/[id]`

**Solution**:
1. Verify Next.js dynamic route: `app/guest-pass/[id]/page.tsx` exists
2. Restart dev server to register new route
3. Check guest pass ID format (should be UUID)
4. Verify guest pass exists in database: `SELECT * FROM guest_passes WHERE id = 'uuid'`

### Issue: Scanner Not Enforcing Rules
**Symptom**: Access granted even when pool should be closed

**Solution**:
1. Check `check-access` route uses **Admin Client** (not regular client)
2. Verify properties table has new columns populated
3. Test with `curl`:
   ```bash
   curl -X POST http://localhost:3000/api/check-access \
     -H "Content-Type: application/json" \
     -d '{"qr_code": "test-qr", "scan_type": "ENTRY"}'
   ```
4. Check server logs for detailed rule evaluation

### Issue: QR Code Not Downloading
**Symptom**: Click "Save to Photos", nothing happens

**Solution**:
1. Check browser console for canvas errors
2. Verify QR canvas has correct ID (`resident-qr-canvas` or `guest-qr-canvas`)
3. Test in different browser (some block auto-downloads)
4. On mobile: Check storage permissions

---

## 📊 Database Queries for Monitoring

### Current Facility Status
```sql
SELECT 
  operating_hours_start,
  operating_hours_end,
  max_capacity,
  guest_pass_price,
  is_maintenance_mode,
  maintenance_reason,
  (SELECT COUNT(*) FROM profiles WHERE current_location = 'INSIDE' AND is_active = TRUE) AS current_occupancy
FROM properties
WHERE id = '00000000-0000-0000-0000-000000000001';
```

### Active Guest Passes
```sql
SELECT 
  gp.id,
  gp.qr_code,
  gp.guest_name,
  gp.status,
  gp.expires_at,
  gp.used_at,
  p.name AS purchased_by_name,
  p.unit AS purchased_by_unit
FROM guest_passes gp
JOIN profiles p ON gp.purchased_by = p.id
WHERE gp.status = 'active' AND gp.expires_at > NOW()
ORDER BY gp.created_at DESC;
```

### Guest Pass Usage Report
```sql
SELECT 
  DATE(gp.created_at) AS purchase_date,
  COUNT(*) AS total_passes,
  SUM(CASE WHEN gp.status = 'used' THEN 1 ELSE 0 END) AS used_passes,
  SUM(CASE WHEN gp.status = 'expired' THEN 1 ELSE 0 END) AS expired_passes,
  SUM(gp.price_paid) AS total_revenue
FROM guest_passes gp
GROUP BY DATE(gp.created_at)
ORDER BY purchase_date DESC
LIMIT 30;
```

### Recent Access Attempts (with denial reasons)
```sql
SELECT 
  al.scanned_at,
  p.name AS resident_name,
  al.scan_type,
  al.result,
  al.denial_reason
FROM access_logs al
LEFT JOIN profiles p ON al.user_id = p.id
ORDER BY al.scanned_at DESC
LIMIT 50;
```

---

## 🎯 Next Steps / Future Enhancements

### Short Term (Easy Wins)
- [ ] Add email notifications when guest pass is created
- [ ] Allow managers to cancel guest passes manually
- [ ] Add "Forgot Email" link to resident login
- [ ] Show guest pass expiry countdown timer

### Medium Term (Feature Additions)
- [ ] Multi-property support (select property at login)
- [ ] Guest pass bundles (buy 5 for $20)
- [ ] Resident access history page
- [ ] Manager analytics dashboard

### Long Term (Advanced Features)
- [ ] Payment integration (Stripe) for guest passes
- [ ] Real Supabase Auth for residents
- [ ] Push notifications for capacity alerts
- [ ] Admin mobile app for scanning

---

## 📞 Support & Resources

### Documentation Files
- `README.md` - Project overview
- `DEPLOYMENT.md` - Vercel deployment guide
- `QUICK-START.md` - 15-minute setup
- `BUG-FIXES-ROUND-2.md` - Recent bug fixes
- `TESTING-GUIDE.md` - Comprehensive testing steps
- `MAJOR-EXPANSION-GUIDE.md` - This file

### Database Schema
- `supabase-schema.sql` - Initial schema
- `migrations/0002_facility_settings_and_guest_passes.sql` - This migration

### Key Files
- `lib/types/database.ts` - TypeScript types
- `lib/supabase/admin.ts` - Admin client
- `app/api/check-access/route.ts` - Smart scanner logic

---

**Version**: 3.0  
**Date**: 2024-01-15  
**Project**: Secure Access Pass  
**Status**: ✅ Complete and Ready for Testing
