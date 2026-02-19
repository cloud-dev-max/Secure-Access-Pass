# 🔧 Quick Fix for Broadcast Error

## Problem
The broadcast function is failing because it's not sending the `target_filter` parameter to the API.

## Solution: Manual Code Update

### **File:** `app/dashboard/page.tsx`

---

## Fix #1: Add State Variable (Around Line 76-79)

**Find this section:**
```typescript
  // V6: Broadcast Alert Modal
  const [showBroadcastModal, setShowBroadcastModal] = useState(false)
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [sendingBroadcast, setSendingBroadcast] = useState(false)
```

**Change to:**
```typescript
  // V6: Broadcast Alert Modal
  const [showBroadcastModal, setShowBroadcastModal] = useState(false)
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [sendingBroadcast, setSendingBroadcast] = useState(false)
  const [broadcastTargetFilter, setBroadcastTargetFilter] = useState<'INSIDE' | 'ALL' | 'RECENT'>('INSIDE')
```

---

## Fix #2: Update sendBroadcastAlert Function (Around Line 252-282)

**Find this function:**
```typescript
  const sendBroadcastAlert = async () => {
    if (!broadcastMessage || broadcastMessage.trim() === '') {
      alert('Please enter a message')
      return
    }

    setSendingBroadcast(true)
    try {
      const response = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: broadcastMessage.trim()
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send broadcast')
      }

      const data = await response.json()
      alert(`Alert sent to ${data.recipients_count} resident(s) currently inside`)
      setBroadcastMessage('')
      setShowBroadcastModal(false)
    } catch (error) {
      console.error('Error sending broadcast:', error)
      alert('Failed to send broadcast alert')
    } finally {
      setSendingBroadcast(false)
    }
  }
```

**Replace with:**
```typescript
  const sendBroadcastAlert = async () => {
    if (!broadcastMessage || broadcastMessage.trim() === '') {
      alert('Please enter a message')
      return
    }

    setSendingBroadcast(true)
    try {
      const response = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: broadcastMessage.trim(),
          target_filter: broadcastTargetFilter
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send broadcast')
      }

      const data = await response.json()
      const targetDesc = broadcastTargetFilter === 'INSIDE' ? 'currently inside' : 
                        broadcastTargetFilter === 'RECENT' ? 'who visited recently (last 4 hours)' : 'active residents'
      alert(`Alert sent to ${data.recipients_count} resident(s) ${targetDesc}`)
      setBroadcastMessage('')
      setBroadcastTargetFilter('INSIDE')
      setShowBroadcastModal(false)
    } catch (error) {
      console.error('Error sending broadcast:', error)
      alert('Failed to send broadcast alert')
    } finally {
      setSendingBroadcast(false)
    }
  }
```

---

## Fix #3: Update Broadcast Modal (Around Line 1100-1150)

**Find the broadcast modal section that looks like:**
```tsx
      {/* V6: Broadcast Alert Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold text-navy-900 mb-2 flex items-center gap-2">
              <AlertCircle className="w-7 h-7 text-red-600" />
              Broadcast Health Alert
            </h2>
            <p className="text-navy-600 mb-6">
              This message will be sent to all residents currently inside the facility
            </p>
            
            <textarea
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              ...
            />
```

**Add this BEFORE the textarea:**
```tsx
            <p className="text-navy-600 mb-4">
              Send emergency or informational messages to residents
            </p>
            
            {/* Target Filter Dropdown */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-navy-900 mb-2">
                Target Audience
              </label>
              <select
                value={broadcastTargetFilter}
                onChange={(e) => setBroadcastTargetFilter(e.target.value as 'INSIDE' | 'ALL' | 'RECENT')}
                className="w-full px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="INSIDE">Currently Inside Only</option>
                <option value="RECENT">Visited in Last 4 Hours</option>
                <option value="ALL">All Active Residents</option>
              </select>
              <p className="text-xs text-navy-500 mt-1">
                {broadcastTargetFilter === 'INSIDE' && 'Send to residents currently at the facility'}
                {broadcastTargetFilter === 'RECENT' && 'Send to residents who visited within the last 4 hours'}
                {broadcastTargetFilter === 'ALL' && 'Send to all active residents regardless of location'}
              </p>
            </div>
            
            <textarea
```

**Also update the Cancel button to reset the filter:**

**Find:**
```tsx
              <button
                onClick={() => {
                  setShowBroadcastModal(false)
                  setBroadcastMessage('')
                }}
```

**Change to:**
```tsx
              <button
                onClick={() => {
                  setShowBroadcastModal(false)
                  setBroadcastMessage('')
                  setBroadcastTargetFilter('INSIDE')
                }}
```

---

## Testing After Fix

1. **Restart dev server:**
   ```bash
   npm run dev
   ```

2. **Test broadcast:**
   - Go to dashboard
   - Click "Broadcast Alert"
   - Select "All Active Residents" from dropdown
   - Enter message
   - Click "Send Alert"
   - Should succeed now!

3. **Verify in console:**
   - Open browser DevTools (F12)
   - Check Console tab - should see no errors

---

## Alternative: Use API Directly

If manual editing is difficult, you can test the broadcast API directly:

```bash
# Test with curl
curl -X POST http://localhost:3000/api/broadcast \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Test broadcast message",
    "target_filter": "ALL"
  }'
```

This should return:
```json
{
  "success": true,
  "recipients_count": 8,
  "message": "Test broadcast message",
  "target_filter": "ALL"
}
```

---

## Quick Summary of Changes

✅ **Line ~79:** Add `broadcastTargetFilter` state  
✅ **Line ~264:** Add `target_filter` to API request  
✅ **Line ~273:** Update success message to show target description  
✅ **Line ~275:** Reset filter on close  
✅ **Line ~1118:** Add dropdown UI in modal  

---

## Why This Fix Works

**Before:**
```javascript
// Missing target_filter parameter
body: JSON.stringify({
  message: broadcastMessage.trim()
})
```

**After:**
```javascript
// Includes target_filter parameter
body: JSON.stringify({
  message: broadcastMessage.trim(),
  target_filter: broadcastTargetFilter  // ✅ Added
})
```

The API expects `target_filter` but wasn't receiving it, causing the error.

---

## Need Help?

If manual editing is tricky, I can:
1. Create a complete new dashboard file
2. Provide a git patch file
3. Guide you through VS Code find/replace

Let me know! 🚀
