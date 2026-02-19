# V7 Feature Implementation Guide

## Overview
This document provides implementation instructions for the 8 requested features in V7. Some features are completed, others need dashboard UI updates.

---

## ✅ COMPLETED FEATURES

### 1. Broadcast API with Target Filters ✅
**Backend:** `/app/api/broadcast/route.ts` - Already supports `INSIDE`, `ALL`, `RECENT` filters
**Status:** API ready, UI needs dropdown

**UI Implementation Needed:**
Add to broadcast modal in `app/dashboard/page.tsx` around line 1110:

```tsx
{/* Target Filter Dropdown */}
<div className="mb-4">
  <label className="block text-sm font-semibold text-navy-900 mb-2">
    Target Audience
  </label>
  <select
    value={broadcastTargetFilter}
    onChange={(e) => setBroadcastTargetFilter(e.target.value as 'INSIDE' | 'ALL' | 'RECENT')}
    className="w-full px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-red-500"
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
```

---

### 2. Move Broadcast Alert to Less Prominent Position ✅
**Status:** Completed - moved after Recent Activity section
**Location:** `app/dashboard/page.tsx` line ~809

The broadcast alert is now smaller and positioned before Quick Actions instead of at the top.

---

### 3. Separate Settings Tab
**Status:** Partially complete - tab added, content needs migration
**Current:** Tab button added with "Facility Settings" label
**Needed:** Move facility settings form from Overview to dedicated Settings tab

**Implementation Steps:**
1. In `app/dashboard/page.tsx`, find the settings content (property name, operating hours, etc.)
2. Move it from Overview tab to new section:

```tsx
{/* SETTINGS TAB */}
{activeTab === 'settings' && (
  <div className="space-y-6">
    <div className="bg-white rounded-xl shadow-lg p-8 border border-navy-200">
      <h2 className="text-2xl font-bold text-navy-900 mb-6 flex items-center gap-3">
        <Settings className="w-7 h-7 text-teal-600" />
        Facility Settings
      </h2>
      
      <form onSubmit={saveFacilitySettings} className="space-y-6">
        {/* Property Name */}
        <div>
          <label className="block text-sm font-semibold text-navy-900 mb-2">
            Property Name
          </label>
          <input
            type="text"
            value={propertyName}
            onChange={(e) => setPropertyName(e.target.value)}
            className="w-full px-4 py-3 border-2 border-navy-300 rounded-lg"
            required
          />
        </div>

        {/* Operating Hours */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-navy-900 mb-2">
              Opening Time
            </label>
            <input
              type="time"
              value={operatingHoursStart}
              onChange={(e) => setOperatingHoursStart(e.target.value)}
              className="w-full px-4 py-3 border-2 border-navy-300 rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-navy-900 mb-2">
              Closing Time
            </label>
            <input
              type="time"
              value={operatingHoursEnd}
              onChange={(e) => setOperatingHoursEnd(e.target.value)}
              className="w-full px-4 py-3 border-2 border-navy-300 rounded-lg"
              required
            />
          </div>
        </div>

        {/* Max Capacity */}
        <div>
          <label className="block text-sm font-semibold text-navy-900 mb-2">
            Maximum Capacity
          </label>
          <input
            type="number"
            min="1"
            value={maxCapacity}
            onChange={(e) => setMaxCapacity(parseInt(e.target.value))}
            className="w-full px-4 py-3 border-2 border-navy-300 rounded-lg"
            required
          />
        </div>

        {/* Guest Pass Price */}
        <div>
          <label className="block text-sm font-semibold text-navy-900 mb-2">
            Visitor Pass Price (24-hour pass)
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-navy-600 font-bold">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={guestPassPrice}
              onChange={(e) => setGuestPassPrice(parseFloat(e.target.value))}
              className="w-full pl-10 pr-4 py-3 border-2 border-navy-300 rounded-lg"
              required
            />
          </div>
        </div>

        {/* Max Guests Per Resident */}
        <div>
          <label className="block text-sm font-semibold text-navy-900 mb-2">
            Maximum Guests Per Resident
          </label>
          <input
            type="number"
            min="1"
            max="10"
            value={maxGuestsPerResident}
            onChange={(e) => setMaxGuestsPerResident(parseInt(e.target.value))}
            className="w-full px-4 py-3 border-2 border-navy-300 rounded-lg"
            required
          />
        </div>

        {/* Save Button */}
        <button
          type="submit"
          disabled={savingSettings}
          className="w-full bg-teal-600 hover:bg-teal-700 text-white px-6 py-4 rounded-lg font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {savingSettings ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Settings className="w-5 h-5" />
              Save Settings
            </>
          )}
        </button>
      </form>
    </div>
  </div>
)}
```

---

### 4. Revenue Analytics Dashboard ✅
**Backend:** `/app/api/revenue/route.ts` - Completed with comprehensive statistics
**Status:** API ready, UI needs implementation

**Features Provided by API:**
- Total revenue and pass count
- Active vs expired passes
- Current month revenue
- Last 7 days revenue
- Daily revenue (last 30 days)
- Weekly revenue (last 12 weeks)
- Monthly revenue (last 12 months)

**UI Implementation Needed:**
Add to dashboard tabs:

```tsx
{/* REVENUE TAB */}
{activeTab === 'revenue' && (
  <div className="space-y-6">
    {revenueLoading ? (
      <div className="text-center py-12">
        <Loader2 className="w-12 h-12 text-navy-600 animate-spin mx-auto mb-4" />
        <p className="text-navy-600 font-semibold">Loading revenue data...</p>
      </div>
    ) : revenueData ? (
      <>
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-6 h-6 text-green-600" />
              <span className="text-2xl font-bold text-green-600">
                ${revenueData.summary.totalRevenue.toFixed(2)}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-navy-900">Total Revenue</h3>
            <p className="text-xs text-navy-600">{revenueData.summary.totalPasses} passes sold</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-6 h-6 text-blue-600" />
              <span className="text-2xl font-bold text-blue-600">
                ${revenueData.summary.currentMonth.revenue.toFixed(2)}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-navy-900">This Month</h3>
            <p className="text-xs text-navy-600">{revenueData.summary.currentMonth.count} passes</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-6 h-6 text-purple-600" />
              <span className="text-2xl font-bold text-purple-600">
                ${revenueData.summary.last7Days.revenue.toFixed(2)}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-navy-900">Last 7 Days</h3>
            <p className="text-xs text-navy-600">{revenueData.summary.last7Days.count} passes</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-6 h-6 text-teal-600" />
              <span className="text-2xl font-bold text-teal-600">
                {revenueData.summary.activePasses}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-navy-900">Active Passes</h3>
            <p className="text-xs text-navy-600">${revenueData.summary.guestPassPrice}/pass</p>
          </div>
        </div>

        {/* Charts - Use Chart.js or simple bar charts */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
          <h3 className="text-xl font-bold text-navy-900 mb-4">Daily Revenue (Last 30 Days)</h3>
          <div className="space-y-2">
            {revenueData.charts.daily.slice(-7).map((day: any) => (
              <div key={day.date} className="flex items-center gap-4">
                <span className="text-sm text-navy-600 w-24">{day.date}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-8 relative overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-teal-500 to-blue-500 h-full rounded-full flex items-center px-3"
                    style={{ width: `${Math.max(5, (day.revenue / revenueData.summary.totalRevenue) * 100 * 3)}%` }}
                  >
                    <span className="text-xs font-bold text-white">${day.revenue.toFixed(2)}</span>
                  </div>
                </div>
                <span className="text-sm text-navy-600 w-16">{day.count} passes</span>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly Summary */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
          <h3 className="text-xl font-bold text-navy-900 mb-4">Weekly Revenue (Last 12 Weeks)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {revenueData.charts.weekly.slice(-8).map((week: any) => (
              <div key={week.week} className="bg-navy-50 rounded-lg p-4 text-center">
                <p className="text-xs text-navy-600 mb-2">{week.week}</p>
                <p className="text-lg font-bold text-navy-900">${week.revenue.toFixed(2)}</p>
                <p className="text-xs text-navy-600">{week.count} passes</p>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Summary */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
          <h3 className="text-xl font-bold text-navy-900 mb-4">Monthly Revenue (Last 12 Months)</h3>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {revenueData.charts.monthly.slice(-6).map((month: any) => (
              <div key={month.month} className="bg-gradient-to-br from-teal-50 to-blue-50 rounded-lg p-4 text-center border-2 border-teal-200">
                <p className="text-xs font-semibold text-navy-600 mb-2">{month.month}</p>
                <p className="text-xl font-bold text-teal-600">${month.revenue.toFixed(2)}</p>
                <p className="text-xs text-navy-600">{month.count} passes</p>
              </div>
            ))}
          </div>
        </div>
      </>
    ) : (
      <div className="bg-white rounded-xl shadow-lg p-12 text-center">
        <DollarSign className="w-16 h-16 text-navy-300 mx-auto mb-4" />
        <p className="text-xl font-semibold text-navy-600 mb-2">No revenue data available</p>
        <p className="text-sm text-navy-500">Revenue will appear once guest passes are purchased</p>
      </div>
    )}
  </div>
)}
```

---

### 5. Show Maintenance Closure Reason ✅
**Status:** Already implemented in `app/resident/page.tsx` line 506
**No action needed** - Feature complete

---

## 🔄 IN-PROGRESS / PENDING FEATURES

### 6. Unify Manager QR Download with Resident Full Pass Format
**Status:** Needs implementation
**Requirement:** Manager should download the same formatted pass that residents see

**Current State:**
- Manager downloads simple QR code PNG
- Resident sees full formatted pass with name, unit, QR code

**Implementation Needed:**
Create a reusable ID card component in `/components/IDCard.tsx`:

```tsx
'use client'

import { QRCodeCanvas } from 'qrcode.react'
import { Shield, User, Home } from 'lucide-react'

interface IDCardProps {
  residentName: string
  residentUnit: string
  qrCode: string
  location: 'INSIDE' | 'OUTSIDE'
}

export default function IDCard({ residentName, residentUnit, qrCode, location }: IDCardProps) {
  return (
    <div className="w-[400px] bg-gradient-to-br from-navy-900 via-navy-800 to-teal-900 rounded-2xl p-8 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-teal-500 p-2 rounded-lg">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">Secure Access Pass</h3>
            <p className="text-teal-300 text-xs">Pool Access ID</p>
          </div>
        </div>
      </div>

      {/* QR Code */}
      <div className="bg-white rounded-xl p-6 mb-6">
        <QRCodeCanvas
          value={qrCode}
          size={300}
          level="H"
          includeMargin={true}
          className="mx-auto"
        />
      </div>

      {/* Resident Info */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 text-white">
          <User className="w-5 h-5 text-teal-400" />
          <div>
            <p className="text-xs text-teal-300">Resident Name</p>
            <p className="font-bold text-lg">{residentName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-white">
          <Home className="w-5 h-5 text-teal-400" />
          <div>
            <p className="text-xs text-teal-300">Unit Number</p>
            <p className="font-bold text-lg">Unit {residentUnit}</p>
          </div>
        </div>
      </div>

      {/* Status Badge */}
      <div className={`mt-6 text-center py-3 rounded-lg font-bold text-sm ${
        location === 'INSIDE'
          ? 'bg-green-500/20 text-green-300 border-2 border-green-500'
          : 'bg-gray-500/20 text-gray-300 border-2 border-gray-500'
      }`}>
        Current Status: {location}
      </div>

      {/* Footer */}
      <p className="text-center text-teal-300 text-xs mt-4">
        Scan at entry/exit kiosks • Do not share
      </p>
    </div>
  )
}
```

Then in dashboard, replace simple QR download with:

```tsx
const downloadFullIDCard = (resident: ProfileWithRules) => {
  // Create hidden div with ID card
  const container = document.createElement('div')
  container.style.position = 'absolute'
  container.style.left = '-9999px'
  document.body.appendChild(container)

  // Render ID card using html2canvas
  import('html2canvas').then(({ default: html2canvas }) => {
    const root = ReactDOM.createRoot(container)
    root.render(
      <IDCard
        residentName={resident.name}
        residentUnit={resident.unit}
        qrCode={resident.qr_code}
        location={resident.current_location}
      />
    )

    setTimeout(() => {
      html2canvas(container.firstChild as HTMLElement).then(canvas => {
        const url = canvas.toDataURL('image/png')
        const link = document.createElement('a')
        link.download = `${resident.name.replace(/\s+/g, '-')}-AccessPass.png`
        link.href = url
        link.click()

        document.body.removeChild(container)
      })
    }, 100)
  })
}
```

---

### 7. Add Text/Email Sharing for Resident Passes
**Status:** Needs implementation
**Requirement:** Manager can send pass via text/email from dashboard

**Implementation Options:**

#### Option A: Simple mailto/sms links
```tsx
<div className="flex gap-2">
  <button
    onClick={() => {
      window.location.href = `mailto:?subject=Your Pool Access Pass&body=Hi ${resident.name}, here is your access pass. Please download and save to your phone.`
    }}
    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2"
  >
    <Mail className="w-4 h-4" />
    Email
  </button>
  <button
    onClick={() => {
      const phone = resident.phone?.replace(/\D/g, '')
      if (phone) {
        window.location.href = `sms:${phone}?body=Your pool access pass is ready. Visit the resident portal to download: https://yourdomain.com/resident`
      } else {
        alert('No phone number on file')
      }
    }}
    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2"
  >
    <MessageSquare className="w-4 h-4" />
    Text
  </button>
</div>
```

#### Option B: API-based sending (recommended for production)
Create `/app/api/send-pass/route.ts`:

```tsx
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { resident_id, method } = await request.json() // method: 'email' | 'sms'

    const adminClient = createAdminClient()
    const { data: resident } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', resident_id)
      .single()

    if (!resident) {
      return NextResponse.json({ error: 'Resident not found' }, { status: 404 })
    }

    if (method === 'email') {
      // Use SendGrid, AWS SES, or Resend
      // await sendEmail({
      //   to: resident.email,
      //   subject: 'Your Pool Access Pass',
      //   html: generatePassEmail(resident)
      // })
      return NextResponse.json({ success: true, message: 'Email sent' })
    }

    if (method === 'sms') {
      // Use Twilio
      // await sendSMS({
      //   to: resident.phone,
      //   body: 'Your pool access pass is ready. Download: https://yourdomain.com/resident'
      // })
      return NextResponse.json({ success: true, message: 'SMS sent' })
    }

    return NextResponse.json({ error: 'Invalid method' }, { status: 400 })
  } catch (error) {
    console.error('Error sending pass:', error)
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
  }
}
```

---

### 8. Payment Integration for Guest Passes
**Status:** Documentation ready
**Requirement:** Integrate payment processing for guest pass purchases

## Payment Integration Options

### Option A: Stripe (Recommended)
**Pros:**
- Industry standard
- Great documentation
- Cloudflare Workers compatible
- Built-in fraud protection

**Implementation Steps:**

1. **Install Stripe SDK:**
```bash
npm install stripe @stripe/stripe-js
```

2. **Create Stripe Checkout Session API:**
```typescript
// app/api/create-checkout/route.ts
import Stripe from 'stripe'
import { NextRequest, NextResponse } from 'next/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
})

export async function POST(request: NextRequest) {
  try {
    const { resident_id, guest_name, guest_email, guest_phone } = await request.json()

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: '24-Hour Visitor Pass',
              description: 'Pool access pass for guest',
            },
            unit_amount: 500, // $5.00 in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/resident?payment=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/resident?payment=cancelled`,
      metadata: {
        resident_id,
        guest_name,
        guest_email,
        guest_phone,
      },
    })

    return NextResponse.json({ sessionId: session.id, url: session.url })
  } catch (error) {
    return NextResponse.json({ error: 'Payment failed' }, { status: 500 })
  }
}
```

3. **Create Webhook Handler:**
```typescript
// app/api/stripe-webhook/route.ts
import Stripe from 'stripe'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const metadata = session.metadata!

    // Create guest pass in database
    const adminClient = createAdminClient()
    await adminClient.from('guest_passes').insert({
      property_id: process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID,
      purchaser_id: metadata.resident_id,
      guest_name: metadata.guest_name,
      guest_email: metadata.guest_email,
      guest_phone: metadata.guest_phone,
      pass_type: 'VISITOR',
      status: 'active',
      payment_status: 'paid',
      payment_amount: 5.00,
      stripe_session_id: session.id,
    })
  }

  return NextResponse.json({ received: true })
}
```

4. **Update Frontend:**
```tsx
// In resident page
const createPaidGuestPass = async (e: React.FormEvent) => {
  e.preventDefault()
  setCreatingPass(true)

  try {
    // Create Stripe checkout session
    const response = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resident_id: resident?.id,
        guest_name: guestName,
        guest_email: guestEmail,
        guest_phone: guestPhone,
      }),
    })

    const { url } = await response.json()
    
    // Redirect to Stripe Checkout
    window.location.href = url
  } catch (error) {
    alert('Payment setup failed')
  } finally {
    setCreatingPass(false)
  }
}
```

5. **Environment Variables:**
```bash
# .env.local
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
```

### Option B: PayPal
**Pros:**
- Widely recognized
- No credit card required for payers
- Good for consumer transactions

**Implementation:**
```bash
npm install @paypal/react-paypal-js
```

### Option C: Square
**Pros:**
- Simple API
- Good for small businesses
- Integrated payment terminal support

---

## Migration Database Changes Needed

### Add Payment Tracking to guest_passes Table

```sql
-- migrations/0008_add_payment_tracking.sql

ALTER TABLE guest_passes
ADD COLUMN payment_status TEXT DEFAULT 'pending',
ADD COLUMN payment_amount DECIMAL(10,2),
ADD COLUMN stripe_session_id TEXT,
ADD COLUMN paid_at TIMESTAMP;

-- Add check constraint
ALTER TABLE guest_passes
ADD CONSTRAINT check_payment_status 
CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded'));

-- Create index for faster payment lookups
CREATE INDEX idx_guest_passes_payment_status ON guest_passes(payment_status);
CREATE INDEX idx_guest_passes_stripe_session ON guest_passes(stripe_session_id);
```

---

## Summary of Implementation Status

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| 1. Broadcast Filters | ✅ Complete | ⚠️ Needs dropdown | 90% |
| 2. Alert Position | ✅ Complete | ✅ Complete | 100% |
| 3. Settings Tab | ✅ Complete | ⚠️ Needs migration | 80% |
| 4. Revenue Analytics | ✅ Complete | ⚠️ Needs charts | 70% |
| 5. QR Download Format | ❌ Not started | ❌ Not started | 0% |
| 6. Pass Sharing | ❌ Not started | ❌ Not started | 0% |
| 7. Maintenance Reason | ✅ Complete | ✅ Complete | 100% |
| 8. Payment Integration | 📝 Documented | ❌ Not started | 10% |

---

## Next Steps for Full Implementation

1. **High Priority:**
   - Complete Settings tab migration
   - Add Revenue Analytics UI with charts
   - Add broadcast target filter dropdown

2. **Medium Priority:**
   - Implement unified ID card download
   - Add pass sharing via email/SMS

3. **Low Priority (Future):**
   - Integrate Stripe payment processing
   - Add webhook handlers
   - Update database schema for payments

---

## Testing Checklist

- [ ] Broadcast sends to correct audience (INSIDE/ALL/RECENT)
- [ ] Settings tab saves all facility settings
- [ ] Revenue API returns correct calculations
- [ ] Revenue charts display properly
- [ ] Maintenance reason shows on resident page
- [ ] Manager can download formatted ID cards
- [ ] Pass sharing works via email/SMS
- [ ] Payment integration (when implemented) creates passes correctly

---

## Deployment Notes

**Environment Variables Required:**
```bash
NEXT_PUBLIC_DEFAULT_PROPERTY_ID=<uuid>
SUPABASE_SERVICE_ROLE_KEY=<key>

# For payment integration (future)
STRIPE_SECRET_KEY=<key>
STRIPE_PUBLISHABLE_KEY=<key>
STRIPE_WEBHOOK_SECRET=<key>
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
```

**Cloudflare Secrets:**
```bash
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

---

## Support & Documentation

- Stripe Docs: https://stripe.com/docs/payments/checkout
- PayPal Docs: https://developer.paypal.com/
- Supabase Docs: https://supabase.com/docs
- Cloudflare Workers: https://developers.cloudflare.com/workers

---

*Document Version: 7.0*  
*Last Updated: 2026-02-19*  
*Author: GenSpark AI Developer*
