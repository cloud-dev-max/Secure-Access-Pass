# 🏊 Secure Access Pass

**Resort-Grade Digital Entry Solution for Swimming Pool Access Management**

A sophisticated B2B SaaS application that replaces physical key fobs with mobile QR codes, enabling property managers to instantly control pool access using flexible, custom rules.

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
Multi-property support for property management companies
- `id`, `name`, `address`, `city`, `state`, `zip_code`

---

## 🔐 **Security Features**

- ✅ **Row Level Security (RLS)** enabled on all tables
- ✅ **Manager-only access** to sensitive operations
- ✅ **Unique QR codes** - Cannot be duplicated or shared effectively
- ✅ **Anti-passback enforcement** - Prevents code sharing
- ✅ **Complete audit logs** - Track every access attempt
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
