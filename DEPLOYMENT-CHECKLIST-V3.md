# Deployment Checklist - Secure Access Pass v3.0

## Pre-Deployment

### ✅ Database Migration
- [ ] **Copy migration file content**: `migrations/0002_facility_settings_and_guest_passes.sql`
- [ ] **Open Supabase Dashboard** → SQL Editor
- [ ] **Paste and run migration**
- [ ] **Verify success**: Check for completion messages
- [ ] **Test queries**:
  ```sql
  -- Verify properties columns
  SELECT operating_hours_start, max_capacity, guest_pass_price 
  FROM properties LIMIT 1;
  
  -- Verify guest_passes table
  SELECT COUNT(*) FROM guest_passes;
  ```

### ✅ Environment Variables
- [ ] **Confirm `.env.local` has required keys**:
  ```bash
  NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
  SUPABASE_SERVICE_ROLE_KEY=eyJ... # REQUIRED for new features
  NEXT_PUBLIC_DEFAULT_PROPERTY_ID=00000000-0000-0000-0000-000000000001
  ```
- [ ] **Never commit `.env.local` to git**
- [ ] **Verify service role key has full permissions**

### ✅ Code Review
- [ ] **Pull latest from git**: `git pull origin main`
- [ ] **Check commit**: `cf4956c - Major Expansion`
- [ ] **Verify files exist**:
  - `app/dashboard/settings/page.tsx`
  - `app/resident/page.tsx`
  - `app/guest-pass/[id]/page.tsx`
  - `app/api/settings/route.ts`
  - `app/api/guest-passes/route.ts`
  - `migrations/0002_facility_settings_and_guest_passes.sql`

---

## Local Testing

### ✅ Build Test
```bash
cd /home/user/webapp
npm run build
```
- [ ] **Build succeeds** (no TypeScript errors)
- [ ] **No missing module errors**
- [ ] **Check for warnings** (acceptable if minor)

### ✅ Dev Server Test
```bash
npm run dev
```
- [ ] **Server starts on port 3000**
- [ ] **No console errors**
- [ ] **Hot reload works**

### ✅ Feature Testing

#### 1. Manager Settings
- [ ] Navigate to: `http://localhost:3000/dashboard`
- [ ] Click **Settings** tab
- [ ] Click **"Manage Facility Settings"** button
- [ ] URL changes to: `/dashboard/settings`
- [ ] Form loads with current values
- [ ] Change operating hours
- [ ] Change max capacity
- [ ] Change guest pass price
- [ ] Toggle maintenance mode ON
- [ ] Enter maintenance reason
- [ ] Click **"Save Settings"**
- [ ] See green success message
- [ ] Refresh page → settings persist

#### 2. Resident Portal
- [ ] Navigate to: `http://localhost:3000/resident`
- [ ] See login form
- [ ] Enter valid resident email (from database)
- [ ] Click **"Access Portal"**
- [ ] Verify:
  - [ ] Facility status shows (OPEN or CLOSED)
  - [ ] Occupancy count displays
  - [ ] QR code renders correctly
  - [ ] Operating hours visible
- [ ] Click **"Save to Photos"**
- [ ] QR code downloads as PNG
- [ ] Refresh page → still logged in (localStorage)
- [ ] Click **"Logout"** → returns to login

#### 3. Guest Pass System
- [ ] Login to Resident Portal
- [ ] Click **"Buy Guest Pass"** button
- [ ] See guest pass form
- [ ] Enter guest name (optional)
- [ ] Enter guest email (optional)
- [ ] Click **"Create Pass"**
- [ ] Guest pass appears in list (green = active)
- [ ] Click **"Share"** button
- [ ] On mobile: Native share menu opens
- [ ] On desktop: "Link copied" alert
- [ ] Copy guest pass link
- [ ] Open link in **incognito/private window**
- [ ] Verify:
  - [ ] Guest pass page loads
  - [ ] QR code displays
  - [ ] Status shows "Valid Pass" (green)
  - [ ] Expiry time shown
- [ ] Click **"Save QR Code"**
- [ ] QR downloads as PNG

#### 4. Smart Scanner
- [ ] Navigate to: `http://localhost:3000/scanner`

**Test A: Maintenance Mode**
- [ ] Enable maintenance in settings
- [ ] Enter reason: "Pool cleaning"
- [ ] Start scanner
- [ ] Scan resident QR code
- [ ] Verify: **Denied** with reason "Pool cleaning"

**Test B: Operating Hours**
- [ ] Disable maintenance mode
- [ ] Set hours: `08:00:00` to `20:00:00`
- [ ] If outside hours: Scan QR → **Denied** (hours message)
- [ ] If inside hours: Continue to next test

**Test C: Max Capacity**
- [ ] Set max capacity to `1`
- [ ] Scan first resident QR → **Granted**
- [ ] Scan second resident QR → **Denied** (capacity message)
- [ ] Scan EXIT for first resident
- [ ] Scan second resident again → **Granted**

**Test D: Guest Pass (One-Time Use)**
- [ ] Create guest pass via Resident Portal
- [ ] Copy guest pass QR code (screenshot or download)
- [ ] Scan guest QR → **Granted** (first time)
- [ ] Scan same guest QR → **Denied** ("already used")

**Test E: Expired Guest Pass**
- [ ] Option 1: Wait 24 hours (not practical)
- [ ] Option 2: Manually expire in database:
  ```sql
  UPDATE guest_passes 
  SET expires_at = NOW() - INTERVAL '1 hour'
  WHERE qr_code = 'GUEST-...'
  ```
- [ ] Scan expired guest QR → **Denied** ("expired")

**Test F: Regular Resident Access**
- [ ] Reset capacity to `50`
- [ ] Ensure within operating hours
- [ ] Disable maintenance mode
- [ ] Scan resident QR → **Granted**
- [ ] Check access logs in dashboard

---

## Production Deployment

### ✅ Vercel Deployment
```bash
# Ensure you're on main branch
git branch --show-current  # Should show: main

# Push to GitHub (if not already)
git push origin main

# Deploy to Vercel (if using Vercel GitHub integration)
# Vercel will auto-deploy on push
```

#### Manual Vercel Deploy
```bash
# Login to Vercel
npx vercel login

# Deploy production
npx vercel --prod

# Follow prompts to configure:
# - Link to existing project or create new
# - Set environment variables
```

### ✅ Environment Variables on Vercel
Navigate to: **Vercel Dashboard → Settings → Environment Variables**

Add these variables:
- `NEXT_PUBLIC_SUPABASE_URL` = `https://your-project.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `eyJ...` (public anon key)
- `SUPABASE_SERVICE_ROLE_KEY` = `eyJ...` (service role key - ⚠️ SECRET)
- `NEXT_PUBLIC_DEFAULT_PROPERTY_ID` = `00000000-0000-0000-0000-000000000001`

**Important**:
- [ ] Mark `SUPABASE_SERVICE_ROLE_KEY` as **secret** (hide value)
- [ ] Apply to **Production** environment
- [ ] Redeploy after adding env vars

### ✅ Post-Deployment Verification

#### 1. Check Deployment Status
- [ ] Visit Vercel deployment URL
- [ ] Homepage loads without errors
- [ ] Check browser console (F12) → no errors

#### 2. Test Manager Dashboard
- [ ] Navigate to: `https://your-app.vercel.app/dashboard`
- [ ] Click Settings tab
- [ ] Open Facility Settings
- [ ] Change a setting
- [ ] Save successfully

#### 3. Test Resident Portal
- [ ] Navigate to: `https://your-app.vercel.app/resident`
- [ ] Login with resident email
- [ ] Verify facility status loads
- [ ] QR code displays
- [ ] Buy a guest pass
- [ ] Share guest pass link
- [ ] Open shared link → guest pass loads

#### 4. Test Scanner
- [ ] Navigate to: `https://your-app.vercel.app/scanner`
- [ ] Click "Start Scanner"
- [ ] Grant camera permissions
- [ ] Scan a QR code
- [ ] Verify access granted/denied correctly

---

## Post-Deployment Tasks

### ✅ Database Maintenance

#### Setup Cron Job to Expire Guest Passes
```sql
-- Option A: Supabase Database Webhooks (requires Supabase Pro)
-- Navigate to: Supabase Dashboard → Database → Webhooks
-- Create webhook to call: SELECT expire_old_guest_passes();
-- Schedule: Daily at midnight

-- Option B: Manual SQL Query (run daily)
SELECT expire_old_guest_passes();
-- Returns count of expired passes

-- Option C: Vercel Cron Job (add to vercel.json)
{
  "crons": [{
    "path": "/api/cron/expire-passes",
    "schedule": "0 0 * * *"
  }]
}
```

### ✅ User Training

#### For Managers
- [ ] **How to configure facility settings**
  - Operating hours
  - Capacity limits
  - Guest pass pricing
  - Maintenance mode
- [ ] **How to add residents**
  - Add Resident form
  - CSV bulk import
- [ ] **How to manage access rules**
  - Create rules
  - Toggle rules per resident

#### For Residents
- [ ] **How to access the portal**
  - Visit `/resident`
  - Enter email
- [ ] **How to download QR code**
  - "Save to Photos" button
  - Keep offline copy
- [ ] **How to buy guest passes**
  - Click "Buy Guest Pass"
  - Optional guest info
  - Share with guest
- [ ] **How to share guest passes**
  - Click "Share" button
  - Use native share or copy link

#### For Scanner Operators
- [ ] **How to use scanner**
  - Open `/scanner` on tablet
  - Toggle ENTRY/EXIT mode
  - Grant camera permissions
  - Point at QR code
- [ ] **What each result means**
  - Green = Access Granted
  - Red = Access Denied (read reason)
- [ ] **How to handle denials**
  - Maintenance mode: Explain closure
  - Outside hours: Show operating hours
  - Capacity full: Ask to wait
  - Guest pass used: Explain one-time use

---

## Rollback Plan

### If Issues Occur

#### Option 1: Revert Database Migration
```sql
-- Remove guest_passes table
DROP TABLE IF EXISTS guest_passes CASCADE;

-- Remove new columns from properties
ALTER TABLE properties 
  DROP COLUMN IF EXISTS operating_hours_start,
  DROP COLUMN IF EXISTS operating_hours_end,
  DROP COLUMN IF EXISTS max_capacity,
  DROP COLUMN IF EXISTS guest_pass_price,
  DROP COLUMN IF EXISTS is_maintenance_mode,
  DROP COLUMN IF EXISTS maintenance_reason;

-- Drop helper functions
DROP FUNCTION IF EXISTS get_current_occupancy(UUID);
DROP FUNCTION IF EXISTS is_facility_open(UUID);
DROP FUNCTION IF EXISTS expire_old_guest_passes();
```

#### Option 2: Revert Git Commit
```bash
# Revert to previous commit
git revert cf4956c

# Push revert
git push origin main

# Vercel will auto-deploy old version
```

#### Option 3: Disable Features
```sql
-- Disable maintenance mode (if causing issues)
UPDATE properties SET is_maintenance_mode = FALSE;

-- Set capacity to high value (effectively disable)
UPDATE properties SET max_capacity = 9999;

-- Set hours to 24/7
UPDATE properties SET 
  operating_hours_start = '00:00:00',
  operating_hours_end = '23:59:59';
```

---

## Monitoring & Metrics

### ✅ Key Metrics to Track

#### Daily
- [ ] **Guest passes created**: `SELECT COUNT(*) FROM guest_passes WHERE DATE(created_at) = CURRENT_DATE`
- [ ] **Guest passes used**: `SELECT COUNT(*) FROM guest_passes WHERE DATE(used_at) = CURRENT_DATE`
- [ ] **Revenue**: `SELECT SUM(price_paid) FROM guest_passes WHERE DATE(created_at) = CURRENT_DATE`
- [ ] **Access denials**: `SELECT COUNT(*) FROM access_logs WHERE result = 'DENIED' AND DATE(scanned_at) = CURRENT_DATE`

#### Weekly
- [ ] **Top denial reasons**: `SELECT denial_reason, COUNT(*) FROM access_logs WHERE result = 'DENIED' GROUP BY denial_reason`
- [ ] **Peak capacity times**: Check occupancy logs
- [ ] **Guest pass conversion rate**: (used / created) * 100

#### Monthly
- [ ] **Total guest pass revenue**
- [ ] **Average facility occupancy**
- [ ] **Resident engagement** (portal logins)

---

## Success Criteria

### ✅ Deployment is Successful When:
- [ ] All 3 new pages load without errors
- [ ] Manager can configure settings and they persist
- [ ] Residents can log in and see their QR code
- [ ] Guest passes can be created and shared
- [ ] Scanner enforces all global rules correctly
- [ ] No console errors in production
- [ ] Database queries execute quickly (< 100ms)
- [ ] Mobile experience is smooth (no lag)

---

## Support Contacts

### Technical Issues
- **Database**: Check Supabase Dashboard → Logs
- **Deployment**: Check Vercel Dashboard → Deployments → Logs
- **Code**: Review commit `cf4956c` and this checklist

### Documentation
- `MAJOR-EXPANSION-GUIDE.md` - Complete feature guide
- `TESTING-GUIDE.md` - Testing procedures
- `README.md` - Project overview

---

**Last Updated**: 2024-01-15  
**Version**: 3.0  
**Status**: ✅ Ready for Deployment  
**Estimated Time**: 2-3 hours for full deployment and testing
