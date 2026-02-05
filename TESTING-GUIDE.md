# Testing Guide - Bug Fixes Round 2

## Quick Start Testing

### Prerequisites
```bash
# Ensure environment is configured
cat .env.local | grep -E "(SUPABASE_URL|SUPABASE_ANON_KEY|SERVICE_ROLE_KEY)"

# Start dev server
npm run dev
```

---

## Test Scenario 1: Toggle Switch Functionality ✅

### Setup
1. Open dashboard: `http://localhost:3000/dashboard`
2. Navigate to **Residents** tab
3. Ensure you have at least 1 resident with 1 rule

### Expected UI (Before Click)
```
┌─────────────────────────────────────┐
│ Resident: Alice Johnson             │
│ Unit: 101                            │
│ Location: OUTSIDE                    │
│                                      │
│ Rent Paid Rule:                      │
│  ┌──────────────┐                   │
│  │ ○────────────│  (Gray, Left)     │
│  │     ✗        │                    │
│  └──────────────┘                   │
│  Status: FAILED                      │
└─────────────────────────────────────┘
```

### Action
Click the toggle switch

### Expected UI (After Click)
```
┌─────────────────────────────────────┐
│ Resident: Alice Johnson             │
│ Unit: 101                            │
│ Location: OUTSIDE                    │
│                                      │
│ Rent Paid Rule:                      │
│  ┌──────────────┐                   │
│  │────────────○ │  (Green, Right)   │
│  │     ✓        │                    │
│  └──────────────┘                   │
│  Status: PASSED                      │
└─────────────────────────────────────┘
```

### Verification Checklist
- [ ] Toggle animates smoothly (200ms transition)
- [ ] Background changes: Gray → Green (or vice versa)
- [ ] Circle slides: Left → Right (or vice versa)
- [ ] Icon changes: ✗ → ✓ (or vice versa)
- [ ] No console errors
- [ ] Database updates (check Network tab → toggle-rule API call returns 200)
- [ ] Status persists after page refresh

---

## Test Scenario 2: Scanner Access Check 🎯

### Setup
1. Add a test resident:
   - Name: Test User
   - Email: test@example.com
   - Unit: 999
   - Phone: (555) 123-4567

2. Create 2 rules:
   - Rent Paid
   - Gym Waiver Signed

3. Set rule states for Test User:
   - Rent Paid: ✅ TRUE (toggle to green)
   - Gym Waiver: ❌ FALSE (toggle to gray)

4. Download QR code for Test User

### Test 2A: All Rules Pass ✅
**Scenario**: Both rules enabled (green toggles)

1. Set both rules to TRUE (green)
2. Open scanner: `http://localhost:3000/scanner`
3. Mode: **ENTRY**
4. Click **Start Scanner**
5. Scan the QR code

**Expected Result**:
```
┌───────────────────────────────────┐
│  ✓  Access Granted - Welcome!     │
│                                    │
│  Test User                         │
│                                    │
│  [Full Screen Green]               │
└───────────────────────────────────┘
```

**Console (No Errors)**:
```
✅ Scanner started successfully
✅ QR code scanned: [qr-code-value]
✅ API call to /api/check-access
✅ Response: { can_access: true, user_name: "Test User" }
```

### Test 2B: One Rule Fails ❌
**Scenario**: Gym Waiver rule is FALSE (gray toggle)

1. Set Gym Waiver to FALSE (gray toggle)
2. Open scanner: `http://localhost:3000/scanner`
3. Mode: **ENTRY**
4. Scan the QR code

**Expected Result**:
```
┌───────────────────────────────────┐
│  ✗  Access Denied                 │
│                                    │
│  Test User                         │
│                                    │
│  Gym Waiver Signed is False       │
│                                    │
│  [Full Screen Red]                 │
└───────────────────────────────────┘
```

**Console (No "Unknown" errors)**:
```
✅ Scanner started successfully
✅ QR code scanned: [qr-code-value]
✅ API call to /api/check-access
✅ Response: { 
     can_access: false, 
     user_name: "Test User",
     denial_reason: "Gym Waiver Signed is False"
   }
```

### Test 2C: Anti-Passback 🔒
**Scenario**: User already inside

1. Scan QR code (ENTRY mode) → Access Granted
2. Immediately scan again (ENTRY mode)

**Expected Result**:
```
┌───────────────────────────────────┐
│  ✗  Access Denied                 │
│                                    │
│  Test User                         │
│                                    │
│  Pass already in use              │
│  (User is already INSIDE)          │
│                                    │
│  [Full Screen Red]                 │
└───────────────────────────────────┘
```

### Test 2D: Exit Mode 🚪
**Scenario**: User exits

1. Ensure user is INSIDE
2. Switch to **EXIT** mode
3. Scan QR code

**Expected Result**:
```
┌───────────────────────────────────┐
│  ✓  Exit Recorded                 │
│                                    │
│  Test User                         │
│                                    │
│  Have a great day!                 │
│                                    │
│  [Full Screen Green]               │
└───────────────────────────────────┘
```

**Database Check**:
```sql
SELECT name, current_location FROM profiles WHERE name = 'Test User';
-- Expected: current_location = 'OUTSIDE'
```

---

## Test Scenario 3: Visual Polish 🎨

### Color States Verification

#### State Table
| Toggle Position | Background Color | Icon | Status | Database Value |
|----------------|------------------|------|--------|----------------|
| Left | Gray (`bg-gray-300`) | ✗ Gray | FAILED | `status = false` |
| Right | Green (`bg-green-500`) | ✓ Green | PASSED | `status = true` |

### Visual Inspection Checklist
1. **Dashboard → Residents Tab**
   - [ ] All green toggles have circles on the RIGHT
   - [ ] All gray toggles have circles on the LEFT
   - [ ] Green toggles show green checkmark icon
   - [ ] Gray toggles show gray X icon

2. **Hover States**
   - [ ] Green toggle → Darker green on hover (`bg-green-600`)
   - [ ] Gray toggle → Darker gray on hover (`bg-gray-400`)
   - [ ] Cursor changes to pointer
   - [ ] Smooth color transition (200ms)

3. **Focus States**
   - [ ] Tab navigation reaches toggles
   - [ ] Focus ring appears (teal ring)
   - [ ] Enter/Space keys toggle state
   - [ ] Accessible to screen readers (`role="switch"`, `aria-checked`)

### Cross-Browser Testing
Test in:
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (if available)

Expected: All browsers show smooth toggle animations and color transitions

---

## Database Verification Queries

### Check Current State
```sql
-- View all residents with their rule statuses
SELECT 
  p.name AS resident,
  p.unit,
  p.current_location,
  ar.rule_name,
  urs.status AS rule_status,
  CASE 
    WHEN urs.status = true THEN '✅ PASS (Green)'
    ELSE '❌ FAIL (Gray)'
  END AS ui_display
FROM profiles p
LEFT JOIN user_rule_status urs ON p.id = urs.user_id
LEFT JOIN access_rules ar ON urs.rule_id = ar.id
WHERE p.role = 'resident'
ORDER BY p.name, ar.rule_name;
```

### Check Access Logs
```sql
-- View recent access attempts
SELECT 
  al.scanned_at,
  p.name AS resident,
  al.scan_type,
  al.result,
  al.denial_reason,
  al.location_before,
  al.location_after
FROM access_logs al
JOIN profiles p ON al.user_id = p.id
ORDER BY al.scanned_at DESC
LIMIT 10;
```

### Verify Toggle Updates
```sql
-- Monitor toggle changes (run before and after toggling)
SELECT 
  p.name AS resident,
  ar.rule_name,
  urs.status,
  urs.updated_at
FROM user_rule_status urs
JOIN profiles p ON urs.user_id = p.id
JOIN access_rules ar ON urs.rule_id = ar.id
WHERE p.name = 'Test User'
ORDER BY urs.updated_at DESC;
```

---

## Network Debugging

### Chrome DevTools Network Tab
1. Open DevTools (F12)
2. Go to **Network** tab
3. Filter: `Fetch/XHR`

### Expected API Calls

#### Toggle Rule
```
Request:
  PATCH /api/toggle-rule
  Body: { "user_id": "uuid", "rule_id": "uuid", "status": true }

Response (200):
  { "id": "uuid", "user_id": "uuid", "rule_id": "uuid", "status": true, "updated_at": "2024-01-15T14:30:00Z" }
```

#### Check Access (Scanner)
```
Request:
  POST /api/check-access
  Body: { "qr_code": "qr-code-value", "scan_type": "ENTRY" }

Response (200) - Access Granted:
  {
    "can_access": true,
    "user_name": "Test User",
    "user_id": "uuid",
    "current_location": "OUTSIDE",
    "denial_reason": null
  }

Response (200) - Access Denied:
  {
    "can_access": false,
    "user_name": "Test User",
    "user_id": "uuid",
    "current_location": "INSIDE",
    "denial_reason": "Pass already in use"
  }
```

---

## Common Issues & Solutions

### Issue 1: Toggle doesn't update
**Symptom**: Click toggle, but state doesn't change

**Debug Steps**:
1. Check console for errors
2. Check Network tab → `/api/toggle-rule` response
3. Verify `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.local`

**Solution**:
```bash
# Restart dev server after adding env vars
npm run dev
```

### Issue 2: Scanner shows "Unknown"
**Symptom**: Scanner displays "Access Denied: Unknown"

**Root Cause**: RLS blocking database access

**Verify Fix**:
```bash
# Check if admin client is being used
cat app/api/check-access/route.ts | grep createAdminClient
# Expected output: import { createAdminClient } from '@/lib/supabase/admin'
```

**Solution**: Bug Fix #2 already applied ✅

### Issue 3: Toggle looks wrong (no colors)
**Symptom**: Toggle is just an icon, no switch background

**Verify Fix**:
```bash
# Check dashboard code for Switch component
cat app/dashboard/page.tsx | grep -A 10 "role=\"switch\""
# Should see: bg-green-500 / bg-gray-300
```

**Solution**: Bug Fix #1 & #3 already applied ✅

---

## Performance Testing

### Toggle Response Time
- [ ] Toggle click → Visual update: < 100ms
- [ ] Toggle click → Database update: < 500ms
- [ ] Page refresh → Data loads: < 2 seconds

### Scanner Performance
- [ ] Camera starts: < 2 seconds
- [ ] QR detection: < 500ms
- [ ] API response: < 1 second
- [ ] Result display: Immediate

---

## Regression Testing

### Features to Verify Still Work
- [ ] Add Resident form submits
- [ ] Add Rule form submits
- [ ] CSV Bulk Import works
- [ ] Overview tab shows correct stats
- [ ] Recent Activity updates
- [ ] QR code download works
- [ ] Multiple residents can be toggled independently

---

## Success Criteria

### All Tests Pass When:
1. ✅ Toggle switches are interactive with smooth animations
2. ✅ Scanner shows resident names (not "Unknown")
3. ✅ Green toggles = PASS, Gray toggles = FAIL
4. ✅ No console errors during normal operations
5. ✅ Database updates reflect UI changes
6. ✅ Anti-passback works correctly
7. ✅ Exit mode updates location to OUTSIDE

---

## Final Checklist

### Pre-Deployment
- [ ] All 3 bugs fixed and tested
- [ ] No console errors in browser
- [ ] No SQL errors in Supabase logs
- [ ] Git commits clean and descriptive
- [ ] Documentation updated (BUG-FIXES-ROUND-2.md)
- [ ] Environment variables configured

### Ready for Production
- [ ] Test on staging Supabase instance
- [ ] Deploy to Vercel
- [ ] Verify production environment variables
- [ ] Test with real hardware (tablet/phone camera)
- [ ] Train staff on new toggle UI

---

**Status**: ✅ Ready for Testing  
**Version**: v2.1  
**Date**: 2024-01-15  
**Project**: Secure Access Pass
