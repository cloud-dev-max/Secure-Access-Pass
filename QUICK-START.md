# ⚡ **Quick Start Guide - Secure Access Pass**

Get your Secure Access Pass application running in **15 minutes**.

---

## 🎯 **Prerequisites**

- [ ] Node.js 18+ installed ([nodejs.org](https://nodejs.org))
- [ ] Git installed
- [ ] Supabase account ([supabase.com](https://supabase.com) - free tier works)
- [ ] Vercel account ([vercel.com](https://vercel.com) - free tier works)

---

## 📦 **Step 1: Get the Code (2 minutes)**

```bash
# Clone the repository
git clone <your-repo-url>
cd webapp

# Install dependencies
npm install
```

---

## 🗄️ **Step 2: Setup Supabase (5 minutes)**

### 2.1 Create Project

1. Go to [app.supabase.com](https://app.supabase.com)
2. Click **"New Project"**
3. Enter:
   - Name: `secure-access-pass`
   - Database Password: (create a strong password)
   - Region: (choose closest to you)
4. Wait ~2 minutes for setup

### 2.2 Import Database Schema

1. Click **"SQL Editor"** in sidebar
2. Click **"New Query"**
3. Copy entire contents of `supabase-schema.sql` file
4. Paste into editor
5. Click **"Run"** (bottom right)
6. Should see: ✅ "Success. No rows returned"

### 2.3 Get API Keys

1. Go to **Settings → API**
2. Copy these values:
   - **URL**: `https://xxxxx.supabase.co`
   - **anon public**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - **service_role**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

---

## ⚙️ **Step 3: Configure Environment (1 minute)**

```bash
# Copy the example file
cp .env.local.example .env.local

# Edit .env.local with your favorite editor
nano .env.local  # or code .env.local
```

**Paste your Supabase credentials:**

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_DEFAULT_PROPERTY_ID=00000000-0000-0000-0000-000000000001
```

---

## 🚀 **Step 4: Run Locally (1 minute)**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

You should see the **Secure Access Pass homepage** with Navy & Teal theme!

---

## 🧪 **Step 5: Test the Application (5 minutes)**

### 5.1 Test Manager Dashboard

1. Click **"Manager Dashboard"** (or visit `/dashboard`)
2. Add a test resident:
   - Name: `John Doe`
   - Email: `john@test.com`
   - Unit: `101`
   - Click **"Add Resident"**
3. You should see John appear in the table with:
   - Default rules (Rent Paid, Lease Compliant, Pool Rules)
   - All rules showing ✅ green checkmarks
   - QR code button

### 5.2 Generate QR Code

1. Click **"View QR"** button for John Doe
2. A modal appears with his unique QR code
3. Click **"Download QR Code"**
4. Save as `john-doe-qr.png`

### 5.3 Test Scanner (Desktop Preview)

1. Go back to homepage
2. Click **"Open Scanner"** (or visit `/scanner`)
3. You should see:
   - Navy/Teal scanner interface
   - ENTRY/EXIT toggle (default: ENTRY)
   - "Start Scanner" button

**Note**: For actual QR scanning, you need to test on a mobile device with camera.

### 5.4 Test Rule Toggle

1. Go back to **Dashboard**
2. Click the ✅ green checkmark next to "Rent Paid" for John
3. It should change to ❌ red X
4. This means John will now be **denied access** when scanning

---

## 📱 **Step 6: Deploy to Vercel (1 minute)**

### 6.1 Push to GitHub

```bash
# Initialize git (if not already done)
git add .
git commit -m "Initial deployment"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/secure-access-pass.git
git push -u origin main
```

### 6.2 Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Add environment variables (same as `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_DEFAULT_PROPERTY_ID`
5. Click **"Deploy"**
6. Wait ~2 minutes
7. You'll get a URL like: `https://secure-access-pass.vercel.app`

---

## 📱 **Step 7: Test on Mobile (Optional)**

1. Open your Vercel URL on your **smartphone**
2. Navigate to `/scanner`
3. Allow camera permissions
4. Open the downloaded QR code (`john-doe-qr.png`) on another device
5. Point your phone camera at the QR code
6. Should see:
   - 🟢 Green screen "Access Granted" (if rules are passing)
   - 🔴 Red screen "Access Denied: Rent Paid is False" (if you toggled it off)

---

## ✅ **Success Checklist**

- [ ] Dependencies installed (`npm install`)
- [ ] Supabase project created
- [ ] Database schema imported
- [ ] Environment variables configured
- [ ] Local dev server running (`npm run dev`)
- [ ] Can access homepage at `http://localhost:3000`
- [ ] Dashboard works at `/dashboard`
- [ ] Can add test residents
- [ ] QR codes generate and download
- [ ] Scanner interface loads at `/scanner`
- [ ] Deployed to Vercel
- [ ] Mobile camera scanning works

---

## 🎓 **Next Steps**

### Learn the System

- **Read**: `README.md` for complete feature documentation
- **Study**: `supabase-schema.sql` to understand the database
- **Review**: `PROJECT-SUMMARY.md` for architecture overview

### Customize

- **Add More Rules**: Go to Dashboard → Settings → Add New Access Rule
- **Modify Theme**: Edit `app/globals.css` (Navy/Teal colors)
- **Add Features**: Check API routes in `app/api/`

### Production Readiness

- **Enable Auth**: Add Supabase authentication for managers
- **Email Alerts**: Send notifications on access denied
- **Analytics**: Track access patterns over time
- **Mobile Apps**: Consider React Native for native iOS/Android

---

## 🆘 **Troubleshooting**

### "Cannot connect to database"

**Fix:**
```bash
# Verify your .env.local has correct Supabase URL
cat .env.local | grep SUPABASE_URL

# Restart dev server
npm run dev
```

### "npm install" fails

**Fix:**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Camera not working

**Fix:**
- ✅ Use **HTTPS** (Vercel provides this automatically)
- ✅ Check browser permissions (click lock icon in address bar)
- ✅ Try different browser (Chrome for Android, Safari for iOS)

### QR codes not generating

**Fix:**
```bash
# Verify qrcode.react is installed
npm list qrcode.react

# If not, reinstall:
npm install qrcode.react
```

---

## 📚 **Documentation Index**

| File | Purpose |
|------|---------|
| **README.md** | Complete project documentation |
| **DEPLOYMENT.md** | Detailed deployment guide |
| **PROJECT-SUMMARY.md** | Architecture overview |
| **QUICK-START.md** | This file - getting started |
| **supabase-schema.sql** | Database schema with comments |

---

## 💡 **Key Concepts**

### Dynamic Rules

Unlike traditional systems, rules are **not hardcoded**. Managers create rules through the UI, and the system automatically:
1. Adds columns to the resident table
2. Initializes status for existing residents
3. Enforces rules during scanning

### Anti-Passback

When a resident enters (INSIDE), their QR code cannot be used again until they exit (OUTSIDE). This prevents sharing QR codes.

### Audit Trail

Every scan attempt is logged with:
- ✅ User who scanned
- ✅ Timestamp
- ✅ Result (GRANTED/DENIED)
- ✅ Reason for denial (if applicable)
- ✅ IP address and user agent

---

## 🎉 **You're Ready!**

Your **Secure Access Pass** application is now running and ready to manage pool access for apartment complexes.

**Questions?** Check the other documentation files or open an issue on GitHub.

---

**⚡ Built in 15 minutes. Production-ready from day one.**
