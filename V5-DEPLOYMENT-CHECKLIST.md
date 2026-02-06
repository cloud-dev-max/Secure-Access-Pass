# V5 Deployment Checklist

**Version**: 5.0.0  
**Date**: 2024-01-15

---

## 📋 Pre-Deployment Checklist

### 1. Code Review
- [x] All code committed to git
- [x] Commits: 8537a70 (Part 1), ef34ca2 (Part 2)
- [x] No uncommitted changes
- [x] Documentation updated

### 2. Environment Variables
Check that all required environment variables are set:

```bash
# Required for all environments
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
NEXT_PUBLIC_DEFAULT_PROPERTY_ID=00000000-0000-0000-0000-000000000001

# Optional (for custom domains)
CLOUDFLARE_API_TOKEN=your-token
```

**Verify**:
```bash
# Local (.env.local)
cat .env.local

# Production (Cloudflare Pages secrets)
npx wrangler pages secret list --project-name webapp
```

### 3. Database Migration
Apply the V5 migration to add multi-property columns:

**Local Testing**:
```bash
npx wrangler d1 migrations apply webapp-production --local --file=migrations/0005_v5_saas_update.sql
```

**Production** (after testing):
```bash
npx wrangler d1 migrations apply webapp-production --file=migrations/0005_v5_saas_update.sql
```

**Verify**:
```bash
# Check columns exist
npx wrangler d1 execute webapp-production --local --command="
  SELECT 
    column_name, 
    data_type 
  FROM information_schema.columns 
  WHERE table_name = 'properties' 
    AND column_name IN ('owner_id', 'property_name')
"
```

---

## 🚀 Deployment Steps

### Step 1: Build Project
```bash
cd /home/user/webapp

# Clean previous build
rm -rf .next dist

# Install dependencies (if needed)
npm install

# Build for production
npm run build

# Verify dist/ directory created
ls -la dist/
```

**Expected output**:
- `dist/_worker.js` (main application)
- `dist/_routes.json` (routing config)
- `dist/static/` (public assets)

### Step 2: Test Locally
```bash
# Start local development server
npm run dev

# In another terminal, test endpoints
curl http://localhost:3000/api/settings
curl http://localhost:3000/api/properties
curl -X POST http://localhost:3000/api/check-access \
  -H "Content-Type: application/json" \
  -d '{"qr_code":"SAP-123","scan_type":"ENTRY"}'
```

### Step 3: Deploy to Production
```bash
# Deploy to Cloudflare Pages
npm run deploy:prod

# Alternative: manual deploy
npx wrangler pages deploy dist --project-name webapp
```

**Expected output**:
```
✨ Success! Uploaded 15 files (2.34 sec)

✨ Deployment complete! Take a peek over at
  https://abc123.webapp.pages.dev
```

### Step 4: Verify Deployment
```bash
# Test production endpoints
SITE_URL="https://your-site.pages.dev"

# Test settings API
curl $SITE_URL/api/settings

# Test properties API
curl $SITE_URL/api/properties

# Test scanner API
curl -X POST $SITE_URL/api/check-access \
  -H "Content-Type: application/json" \
  -d '{"qr_code":"TEST-123","scan_type":"ENTRY"}'
```

---

## ✅ Post-Deployment Testing

### 1. Dashboard Tests
- [ ] Open: `https://your-site.pages.dev/dashboard`
- [ ] Login as manager
- [ ] **Property Switcher**: Verify dropdown appears in header
- [ ] **Pool Status Toggle**: Test OPEN/CLOSED toggle
- [ ] **Resident Rules**: Verify YES/NO toggles work
- [ ] **Settings Page**: Edit property name and save
- [ ] **Occupancy Modal**: Click occupancy card, see "Who is Inside?"
- [ ] **Force Checkout**: Test "Check Out" button in modal

### 2. Settings Tests
- [ ] Open: Dashboard → Settings
- [ ] **Property Name**: Edit and save (e.g., "Sunrise Pool")
- [ ] **Accompanying Guest Limit**: Change value (e.g., 5)
- [ ] **Guest Pass Price**: Update price (e.g., $7.50)
- [ ] **Maintenance Mode**: Toggle on/off with reason
- [ ] **Save**: Verify success message

### 3. Resident Portal Tests
- [ ] Open: `https://your-site.pages.dev/resident`
- [ ] **Login**: Use email + 4-digit PIN
- [ ] **Header**: Verify NO Activity icon
- [ ] **Time Format**: See 12-hour format (e.g., "9:00 AM")
- [ ] **Occupancy**: See bold "X People Currently in Pool"
- [ ] **Guest Pass**: Click "Buy Guest Pass"
- [ ] **Price Display**: Verify shows latest price ($7.50)
- [ ] **Digital ID**: Download and check property name
- [ ] **Change PIN**: Scroll to bottom, verify section exists

### 4. Scanner Tests
- [ ] Open: `https://your-site.pages.dev/scanner`
- [ ] **Resident QR**: Scan a resident QR code
- [ ] **Guest Pass QR**: Scan a guest pass QR code
- [ ] **First Scan**: Should grant access
- [ ] **Second Scan**: Should deny (one-time use)
- [ ] **Expired Pass**: Scan expired pass, verify denial
- [ ] **Maintenance Mode**: Enable in settings, test denial

### 5. Database Verification
```bash
# Check properties table
npx wrangler d1 execute webapp-production --command="
  SELECT id, name, property_name, owner_id 
  FROM properties 
  LIMIT 5
"

# Check access_logs for FORCE_EXIT
npx wrangler d1 execute webapp-production --command="
  SELECT * FROM access_logs 
  WHERE scan_type = 'FORCE_EXIT' 
  ORDER BY created_at DESC 
  LIMIT 10
"

# Check guest_passes
npx wrangler d1 execute webapp-production --command="
  SELECT id, qr_code, status, guest_name, expires_at 
  FROM guest_passes 
  ORDER BY created_at DESC 
  LIMIT 10
"
```

---

## 🔧 Rollback Plan

If issues arise, rollback to V4:

### Option 1: Revert Git Commits
```bash
# Revert to V4 (before V5 commits)
git revert ef34ca2  # Revert Part 2
git revert 8537a70  # Revert Part 1

# Rebuild and redeploy
npm run build
npm run deploy:prod
```

### Option 2: Deploy Previous Build
```bash
# Check Cloudflare Pages deployments
npx wrangler pages deployment list --project-name webapp

# Rollback to specific deployment
npx wrangler pages deployment rollback <DEPLOYMENT_ID> --project-name webapp
```

### Option 3: Database Rollback
```sql
-- Remove new columns (if needed)
ALTER TABLE properties DROP COLUMN IF EXISTS owner_id;
ALTER TABLE properties DROP COLUMN IF EXISTS property_name;

-- Revert will not affect existing data in other tables
```

---

## 📊 Monitoring

### Key Metrics to Watch
1. **Error Rate**: Check Cloudflare Pages analytics
2. **API Response Times**: Monitor `/api/*` endpoints
3. **User Activity**: Track access_logs table
4. **Guest Pass Usage**: Monitor guest_passes status
5. **Force Exits**: Track FORCE_EXIT logs

### Dashboard Queries
```bash
# Recent access logs
npx wrangler d1 execute webapp-production --command="
  SELECT scan_type, result, COUNT(*) as count 
  FROM access_logs 
  WHERE created_at > datetime('now', '-24 hours') 
  GROUP BY scan_type, result
"

# Active residents inside
npx wrangler d1 execute webapp-production --command="
  SELECT COUNT(*) as inside_count 
  FROM profiles 
  WHERE current_location = 'INSIDE' 
    AND is_active = true
"

# Guest pass statistics
npx wrangler d1 execute webapp-production --command="
  SELECT status, COUNT(*) as count 
  FROM guest_passes 
  WHERE created_at > datetime('now', '-7 days') 
  GROUP BY status
"
```

---

## 🎯 Success Criteria

### Critical Features
- [x] Property switcher functional
- [x] Toggles display correctly (OPEN/CLOSED, YES/NO)
- [x] Property name editable in settings
- [x] Property name shows on digital ID
- [x] Guest limit renamed to "Accompanying Guest Limit"
- [x] Resident portal layout improved
- [x] 12-hour time format working
- [x] Guest pass price syncs correctly
- [x] Force exit logging operational
- [x] Guest passes work in scanner

### Performance Targets
- [ ] Page load time < 2 seconds
- [ ] API response time < 500ms
- [ ] Scanner QR processing < 1 second
- [ ] No console errors in browser
- [ ] Mobile responsive (all screen sizes)

### Data Integrity
- [ ] All properties have property_name
- [ ] No orphaned records
- [ ] Access logs complete
- [ ] Guest passes tracked correctly
- [ ] Resident locations accurate

---

## 📞 Support

### Common Issues

**Issue 1: Property Switcher Not Showing**
```bash
# Check properties API
curl https://your-site.pages.dev/api/properties

# Expected: Array of properties
# If empty, create a property in database
```

**Issue 2: Settings Not Saving**
```bash
# Check environment variables
npx wrangler pages secret list --project-name webapp

# Ensure SUPABASE_SERVICE_ROLE_KEY is set
```

**Issue 3: Scanner Not Working**
```bash
# Check access logs
npx wrangler d1 execute webapp-production --command="
  SELECT * FROM access_logs 
  ORDER BY created_at DESC 
  LIMIT 5
"

# If no logs, check scanner API manually
curl -X POST https://your-site.pages.dev/api/check-access \
  -H "Content-Type: application/json" \
  -d '{"qr_code":"SAP-123","scan_type":"ENTRY"}'
```

### Contact
- **Project**: Secure Access Pass
- **Version**: 5.0.0
- **Location**: /home/user/webapp
- **Docs**: V5-PROFESSIONAL-SAAS-UPDATE.md

---

**Deployment Checklist Complete** ✅
