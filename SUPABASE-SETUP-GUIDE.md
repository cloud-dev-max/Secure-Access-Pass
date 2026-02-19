# 🗄️ Supabase Setup Guide

## Quick Fix for "Failed to load data" Error

### **Step 1: Get Your Supabase Credentials** ⚙️

1. Go to https://supabase.com/dashboard
2. Select your project (or create new if needed)
3. Click **Settings** (gear icon) → **API**
4. Copy these 3 values:

```
Project URL: https://xxxxx.supabase.co
anon public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### **Step 2: Update .env.local File** 📝

**On your local computer, edit `.env.local` in the project root:**

```bash
# Replace these with YOUR actual values from Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-actual-key...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-actual-key...
NEXT_PUBLIC_DEFAULT_PROPERTY_ID=00000000-0000-0000-0000-000000000001
```

**⚠️ Important:** 
- Do NOT commit `.env.local` to git
- Keep service_role key secret (it bypasses all security)

---

### **Step 3: Setup Database Schema** 🗄️

**Option A: First Time Setup (New Project)**

1. Go to **Supabase SQL Editor:** https://supabase.com/dashboard/project/YOUR-PROJECT/sql/new
2. Copy the entire content of `supabase-schema.sql`
3. Paste into SQL Editor
4. Click **Run** button
5. Wait for "Success" message

**Option B: Run Migrations (Existing Database)**

Run each migration file in order in the SQL Editor:

1. **Migration 0002:** `migrations/0002_facility_settings_and_guest_passes.sql`
2. **Migration 0003:** `migrations/0003_v4_security_and_polish.sql`
3. **Migration 0005:** `migrations/0005_v5_saas_update.sql`
4. **Migration 0006:** `migrations/0006_v6_real_world.sql`

---

### **Step 4: Verify Database Setup** ✅

Go to **Supabase → Table Editor** and verify these tables exist:

- ✅ `profiles` - Resident accounts
- ✅ `properties` - Facility info
- ✅ `access_rules` - Custom rules
- ✅ `user_rule_status` - Rule assignments
- ✅ `access_logs` - Audit trail
- ✅ `guest_passes` - Visitor passes

---

### **Step 5: Create Default Property** 🏢

Run this SQL in Supabase SQL Editor:

```sql
-- Create default property
INSERT INTO properties (
  id,
  name,
  property_name,
  address,
  city,
  state,
  zip_code
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Default Property',
  'My Pool',
  '123 Main St',
  'Anytown',
  'CA',
  '90001'
) ON CONFLICT (id) DO NOTHING;

-- Verify it was created
SELECT * FROM properties;
```

---

### **Step 6: Restart Development Server** 🔄

```bash
# Stop current server (Ctrl+C)

# Restart
npm run dev
```

Now go to http://localhost:3000 and it should work!

---

## 🧪 **Testing Checklist**

After setup, verify these work:

1. **Dashboard loads:** http://localhost:3000/dashboard
   - Should show empty residents table
   - No error messages

2. **Add a test resident:**
   - Click "Add Resident" form
   - Fill in name, email, unit
   - Submit
   - Should see resident appear in table

3. **Scanner loads:** http://localhost:3000/scanner
   - Should request camera permission
   - QR scanning box should appear

4. **Resident portal:** http://localhost:3000/resident
   - Should show login form
   - No database errors

---

## 🐛 **Troubleshooting**

### Error: "Failed to load data"
**Cause:** Wrong Supabase credentials or database not set up

**Fix:**
1. Double-check `.env.local` has correct values
2. Verify database tables exist in Supabase
3. Run `supabase-schema.sql` if tables missing

---

### Error: "Invalid API key"
**Cause:** Wrong SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY

**Fix:**
1. Go to Supabase → Settings → API
2. Copy keys again (they're VERY long, ~300+ characters)
3. Make sure no extra spaces or line breaks

---

### Error: "Property not found"
**Cause:** Missing default property in database

**Fix:**
Run the INSERT query from Step 5 above

---

### Error: "RLS policy violation"
**Cause:** Service role key not set correctly

**Fix:**
1. Check `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`
2. Make sure it's the **service_role** key, NOT the anon key
3. Restart dev server after changing

---

## 🚀 **Quick Test Commands**

Test if Supabase is connected:

```bash
# Test from terminal
curl http://localhost:3000/api/residents

# Should return: [] (empty array, not error)
```

Test if property exists:

```bash
curl http://localhost:3000/api/settings

# Should return property settings JSON
```

---

## 📋 **Environment Variables Explained**

```bash
# Public URL - used by frontend (safe to expose)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co

# Public anon key - used by frontend (safe to expose, has RLS restrictions)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...

# SECRET service role key - used by backend API routes (NEVER expose to frontend)
# This key bypasses Row Level Security (RLS) - keep it secret!
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Default property ID - matches the property in your database
NEXT_PUBLIC_DEFAULT_PROPERTY_ID=00000000-0000-0000-0000-000000000001
```

---

## 🔒 **Security Notes**

1. **Never commit `.env.local`** to git
   - It's already in `.gitignore`
   - Contains secret keys

2. **Service Role Key is POWERFUL**
   - Bypasses all Row Level Security
   - Only use in API routes (server-side)
   - Never send to frontend

3. **Anon Key is Safe**
   - Can be exposed in frontend
   - Protected by RLS policies
   - Users can only access their own data

---

## ✅ **Success Indicators**

You'll know it's working when:

✅ Dashboard loads without errors  
✅ Can add residents  
✅ Scanner opens camera  
✅ No "Failed to load data" messages  
✅ API routes return data (not errors)

---

## 🆘 **Still Having Issues?**

Check these common mistakes:

1. **Forgot to restart server** after changing `.env.local`
2. **Copied wrong key** (anon vs service_role)
3. **Missing migrations** - run all SQL files in order
4. **Wrong URL format** - should be `https://xxxxx.supabase.co` (no trailing slash)
5. **Keys truncated** - they should be 200-400 characters long

---

## 📞 **Getting Help**

If stuck, check:

1. **Supabase logs:** https://supabase.com/dashboard/project/YOUR-PROJECT/logs
2. **Browser console:** Press F12, check for errors
3. **Terminal output:** Look for red error messages
4. **Database tables:** Verify they exist in Table Editor

---

**Version:** 1.0  
**Last Updated:** 2026-02-19  
**Status:** Production Ready

Good luck! 🚀
