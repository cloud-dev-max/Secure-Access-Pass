# 🏊 Secure Access Pass

**Version 7.0 - Enhanced Analytics & Communication Platform**

**Resort-Grade Digital Entry Solution for Swimming Pool Access Management**

A sophisticated B2B SaaS application that replaces physical key fobs with mobile QR codes, enabling property managers to instantly control pool access using flexible, custom rules. Now with full multi-property support, professional UI, and enhanced resident portal.

---

## 🌊 **The Problem We Solve**

- **Residents share key fobs** with non-residents
- **No remote control** - Managers can't "turn off" a key fob if residents stop paying rent
- **No visibility** - Property managers don't know who's currently in the pool
- **Physical key fob costs** - Lost fobs require expensive replacements

---

## ✨ **Our Solution**

A web-based dashboard where managers can:
- **Instantly revoke access** based on custom "Rules" (Unpaid Rent, Lease Violations, etc.)
- **Track real-time location** (INSIDE/OUTSIDE)
- **Enforce anti-passback** - Prevent QR code sharing
- **Audit every entry/exit** - Complete compliance trail

---

## 🎨 **Design Philosophy**

**"High-End Resort Tech"**
- Navy Blue & Teal branding
- Clean, modern interface
- Fast, responsive experience
- Mobile-first QR scanner
- Real-time updates

---

## 🎉 **What's New in V7.0**

### Revenue Analytics & Reporting
- ✅ **Comprehensive Revenue API** - Track guest pass sales and revenue
- ✅ **Daily/Weekly/Monthly Charts** - Visual breakdown of income streams
- ✅ **Real-Time Stats** - Current month, last 7 days, total revenue
- ✅ **Pass Analytics** - Active vs expired pass tracking

### Enhanced Communication
- ✅ **Broadcast Targeting** - Send alerts to specific groups (inside/all/recent visitors)
- ✅ **Maintenance Notifications** - Residents see closure reasons automatically
- ✅ **Flexible Messaging** - Choose audience based on location and activity

### UI/UX Improvements
- ✅ **Dedicated Settings Tab** - Centralized facility configuration
- ✅ **Revenue Dashboard Tab** - Financial analytics at a glance
- ✅ **Less Intrusive Alerts** - Broadcast button moved to appropriate section
- ✅ **Better Information Hierarchy** - Cleaner dashboard organization

### Developer Experience
- ✅ **Comprehensive Implementation Guide** - V7-IMPLEMENTATION-GUIDE.md
- ✅ **Complete API Documentation** - Ready-to-use revenue endpoints
- ✅ **Payment Integration Docs** - Stripe/PayPal setup instructions
- ✅ **Modular Architecture** - Easy to extend and customize

See [V7-FINAL-SUMMARY.md](./V7-FINAL-SUMMARY.md) for implementation status and [V7-IMPLEMENTATION-GUIDE.md](./V7-IMPLEMENTATION-GUIDE.md) for detailed code examples.

---

## 🎉 **What's New in V5.0**

### Multi-Property SaaS Architecture
- ✅ **Property Switcher** - Manage multiple properties from one dashboard
- ✅ **Owner-based Access** - Each property linked to owner account
- ✅ **Isolated Data** - Complete separation between properties

### Professional UI Enhancements
- ✅ **Wide Pill Toggles** - OPEN/CLOSED status (Green/Red)
- ✅ **YES/NO Rule Toggles** - Replaced PASS/FAIL for clarity
- ✅ **Custom Property Names** - "Sunrise Condos", "Riverside Pool", etc.
- ✅ **Dynamic Digital IDs** - Show property name on resident cards

### Resident Portal Improvements
- ✅ **12-Hour Time Format** - "9:00 AM - 10:00 PM" (easier to read)
- ✅ **Bold Occupancy** - "X People Currently in Pool" (more prominent)
- ✅ **Real-Time Pricing** - Guest pass prices sync from settings
- ✅ **Better Layout** - Security settings moved to bottom

### Enhanced Features
- ✅ **Force Exit Logging** - Track manual checkouts by managers
- ✅ **Guest Pass Support** - Scanner validates both residents and guests
- ✅ **Accompanying Guest Limit** - Better terminology for guest restrictions
- ✅ **Complete Audit Trail** - FORCE_EXIT events logged separately

See [V5-PROFESSIONAL-SAAS-UPDATE.md](./V5-PROFESSIONAL-SAAS-UPDATE.md) for full details.

---

## 🏗️ **Tech Stack**

| Technology | Purpose |
|-----------|---------|
| **Next.js 15** | React framework with App Router |
| **TypeScript** | Type-safe development |
| **Tailwind CSS** | Utility-first styling with custom Navy/Teal theme |
| **Supabase** | PostgreSQL database, authentication, real-time |
| **Lucide React** | Beautiful icon library |
| **html5-qrcode** | Camera-based QR code scanning |
| **qrcode.react** | QR code generation |
| **Vercel** | Production deployment platform |

---

## 🧠 **Core Architecture: Dynamic Rule Engine**

### Database Schema

```sql
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│  profiles   │──────│ access_rules │──────│ user_rule_status│
└─────────────┘      └──────────────┘      └─────────────────┘
     │                                              │
     │                                              │
     └──────────────────────────────────────────────┘
                         │
                   ┌──────────────┐
                   │ access_logs  │
                   └──────────────┘
```

### The Rule Engine Logic (Entry Mode)

```typescript
WHEN Scanner reads QR code in ENTRY MODE:
  1. Fetch all active Rules for this property
  2. Check User's status for EACH rule
     IF (User fails ANY rule)
       → DENY ACCESS (Show specific rule name)
     IF (User passes ALL rules)
       → Proceed to next check
  3. Check Anti-Passback
     IF (User is already 'INSIDE')
       → DENY ACCESS ("Pass already in use")
  4. Success
     IF (All Rules = OK) AND (Location = OUTSIDE)
       → GRANT ACCESS (Green Screen)
       → Update location to 'INSIDE'
```

---

## 📁 **Project Structure**

```
webapp/
├── app/
│   ├── api/                      # Next.js API Routes
│   │   ├── check-access/        # Core access validation logic
│   │   ├── residents/           # CRUD for residents
│   │   ├── rules/               # CRUD for access rules
│   │   └── toggle-rule/         # Toggle rule status for users
│   ├── dashboard/               # Manager Command Center
│   │   └── page.tsx            # Dynamic rule table + toggle system
│   ├── scanner/                 # QR Scanner App
│   │   └── page.tsx            # Camera interface + access logic
│   ├── globals.css              # Navy Blue & Teal theme
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Landing page
├── lib/
│   ├── supabase/
│   │   ├── client.ts            # Client-side Supabase
│   │   └── server.ts            # Server-side Supabase
│   └── types/
│       └── database.ts          # TypeScript types
├── supabase-schema.sql          # Complete database schema
├── .env.local.example           # Environment variable template
└── README.md                    # This file
```

---

## 🚀 **Quick Start**

### Prerequisites

- Node.js 18+ installed
- Supabase account ([supabase.com](https://supabase.com))
- Git installed

### 1️⃣ **Clone & Install**

```bash
git clone <your-repo-url>
cd webapp
npm install
```

### 2️⃣ **Setup Supabase**

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the entire `supabase-schema.sql` file
3. Get your API credentials from **Settings → API**

### 3️⃣ **Configure Environment**

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
NEXT_PUBLIC_DEFAULT_PROPERTY_ID=00000000-0000-0000-0000-000000000001
```

### 4️⃣ **Run Development Server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5️⃣ **Deploy to Vercel**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone)

1. Connect your GitHub repository
2. Add environment variables in Vercel dashboard
3. Deploy!

---

## 📱 **Application Features**

### **Manager Dashboard** (`/dashboard`)

#### Resident Management
- ✅ Add new residents with auto-generated unique QR codes
- ✅ View all residents with their current location (INSIDE/OUTSIDE)
- ✅ Dynamic rule columns - automatically adapts to active rules
- ✅ Toggle system - Click to enable/disable rules per resident
- ✅ Download QR codes as PNG files

#### Rule Builder (`Settings` tab)
- ✅ Create custom access rules (e.g., "Pet Deposit", "Gym Waiver")
- ✅ Add rule descriptions
- ✅ Newly created rules automatically appear as columns in resident table
- ✅ All existing residents inherit new rules (default: PASS)

#### Real-Time Features
- ✅ Live location tracking (INSIDE/OUTSIDE)
- ✅ Instant rule status updates
- ✅ Visual feedback (green checkmark = PASS, red X = FAIL)

---

### **Scanner App** (`/scanner`)

#### Camera Interface
- ✅ Request camera permissions
- ✅ Real-time QR code detection
- ✅ 250x250 scanning box overlay

#### Mode Toggle
- **ENTRY Mode**: Runs full rule engine + anti-passback checks
- **EXIT Mode**: Simply updates location to OUTSIDE (always allows)

#### Visual Feedback
- 🟢 **Green Full-Screen**: Access Granted (shows resident name)
- 🔴 **Red Full-Screen**: Access Denied (shows specific denial reason)
- 🟠 **Orange Full-Screen**: System Error

#### Access Logic (ENTRY Mode)
1. **Rule Validation**: Check all active rules for the property
2. **Anti-Passback**: Prevent entry if already INSIDE
3. **Location Update**: Set to INSIDE on success
4. **Audit Logging**: Record every attempt (granted/denied)

---

## 🗄️ **Database Tables**

### `profiles`
Stores resident information and current location
- `id`, `name`, `email`, `unit`, `phone`
- `current_location` (INSIDE/OUTSIDE)
- `qr_code` (unique identifier)
- `property_id`, `role`, `is_active`

### `access_rules`
Defines the rules that managers create
- `id`, `property_id`, `rule_name`, `description`
- `is_active`, `created_by`

### `user_rule_status`
Links users to rules with their current status
- `id`, `user_id`, `rule_id`
- `status` (true = PASS, false = FAIL)

### `access_logs`
Complete audit trail of all access attempts
- `id`, `user_id`, `property_id`, `qr_code`
- `scan_type` (ENTRY/EXIT), `result` (GRANTED/DENIED)
- `denial_reason`, `location_before`, `location_after`
- `scanned_at`, `ip_address`, `user_agent`

### `properties`
Multi-property support for property management companies (V5+)
- `id`, `name`, `address`, `city`, `state`, `zip_code`
- `owner_id` (links to user account)
- `property_name` (custom display name)
- `operating_hours_start`, `operating_hours_end`
- `max_capacity`, `guest_pass_price`
- `max_guests_per_resident` (accompanying guest limit)
- `is_maintenance_mode`, `maintenance_reason`

### `guest_passes` (V3+)
One-time guest access passes purchased by residents
- `id`, `property_id`, `purchased_by` (resident user_id)
- `qr_code` (unique identifier)
- `guest_name`, `guest_email`, `guest_phone`
- `price_paid`, `status` (active/used/expired)
- `expires_at`, `used_at`

---

## 🔐 **Security Features**

- ✅ **Row Level Security (RLS)** enabled on all tables
- ✅ **Service Role Key** - Admin operations bypass RLS securely
- ✅ **4-Digit Random PINs** (V4+) - Secure resident authentication
- ✅ **Email + PIN Login** - Two-factor resident portal access
- ✅ **Manager-only access** to sensitive operations
- ✅ **Unique QR codes** - Cannot be duplicated or shared effectively
- ✅ **Anti-passback enforcement** - Prevents code sharing
- ✅ **Complete audit logs** - Track every access attempt including force exits
- ✅ **Server-side validation** - All checks run on backend

---

## 🎯 **Use Cases**

1. **Unpaid Rent**: Create a "Rent Paid" rule, toggle OFF for delinquent residents
2. **Lease Violations**: Create a "Lease Compliant" rule, revoke access instantly
3. **Pet Policy**: Create a "Pet Deposit" rule for pet owners
4. **Pool Rules**: Create a "Safety Rules Signed" rule for compliance
5. **Temporary Access**: Toggle rules on/off for short-term guests

---

## 🔄 **Future Enhancements**

- [ ] Multi-property dashboard for management companies
- [ ] SMS notifications for access attempts
- [ ] Advanced analytics and reporting
- [ ] Mobile native apps (iOS/Android)
- [ ] Visitor/guest access system
- [ ] Time-based access rules (hours of operation)
- [ ] Integration with property management software

---

## 📚 **API Routes**

### `POST /api/check-access`
Validates QR code and enforces access rules
```json
{
  "qr_code": "SAP-1234567890-abc123",
  "scan_type": "ENTRY" | "EXIT"
}
```

### `POST /api/broadcast` (V7)
Send health/safety alerts to residents
```json
{
  "message": "Pool closing early due to weather",
  "target_filter": "INSIDE" | "ALL" | "RECENT"
}
```

### `GET /api/revenue` (V7)
Fetch comprehensive revenue analytics
```json
{
  "summary": {
    "totalRevenue": 150.00,
    "totalPasses": 30,
    "currentMonth": {...},
    "last7Days": {...}
  },
  "charts": {
    "daily": [...],
    "weekly": [...],
    "monthly": [...]
  }
}
```

### `GET /api/residents`
Fetch all residents with their rule statuses

### `POST /api/residents`
Create a new resident (auto-generates QR code)

### `GET /api/rules`
Fetch all active access rules

### `POST /api/rules`
Create a new access rule

### `PATCH /api/toggle-rule`
Toggle a user's status for a specific rule
```json
{
  "user_id": "uuid",
  "rule_id": "uuid",
  "status": true | false
}
```

### `GET /api/settings` (V5+)
Fetch facility settings (hours, capacity, pricing)

### `PATCH /api/settings` (V5+)
Update facility settings

### `GET /api/guest-passes` (V6+)
Fetch guest passes for a resident

### `POST /api/guest-passes/purchase` (V6+)
Purchase a new visitor pass

---

## 🐛 **Troubleshooting**

### Camera not working?
- Ensure you're using HTTPS (required for camera access)
- Check browser permissions
- Try a different browser (Chrome/Safari recommended)

### QR codes not scanning?
- Ensure good lighting
- Hold device steady
- Clean camera lens
- Make sure QR code is not too small/large

### Rules not updating?
- Check Supabase connection
- Verify environment variables
- Check browser console for errors

---

## 🤝 **Contributing**

This is a sophisticated B2B SaaS application. Contributions are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 **License**

This project is proprietary software for demonstration purposes.

---

## 👥 **Credits**

Built with ❤️ using:
- [Next.js](https://nextjs.org)
- [Supabase](https://supabase.com)
- [Tailwind CSS](https://tailwindcss.com)
- [Lucide Icons](https://lucide.dev)
- [html5-qrcode](https://github.com/mebjas/html5-qrcode)

---

## 📞 **Support**

For issues or questions, please open a GitHub issue or contact support.

---

**🌊 Secure Access Pass** - Resort-Grade Digital Entry Solution
