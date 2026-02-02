# 🚀 **Deployment Guide - Secure Access Pass**

Complete step-by-step guide for deploying your Secure Access Pass application to production.

---

## 📋 **Deployment Checklist**

- [ ] Supabase project created
- [ ] Database schema imported
- [ ] Environment variables configured
- [ ] Vercel account created
- [ ] GitHub repository pushed
- [ ] Application deployed
- [ ] Camera permissions tested on mobile

---

## 🗄️ **Step 1: Setup Supabase**

### 1.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click **"New Project"**
3. Fill in:
   - **Name**: `secure-access-pass`
   - **Database Password**: (save this securely)
   - **Region**: Choose closest to your users
4. Click **"Create new project"**
5. Wait ~2 minutes for setup

### 1.2 Import Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **"New Query"**
3. Copy the entire contents of `supabase-schema.sql`
4. Paste into the editor
5. Click **"Run"**
6. Verify success (should see "Success. No rows returned")

### 1.3 Verify Tables Created

1. Go to **Table Editor** in sidebar
2. You should see:
   - `profiles`
   - `properties`
   - `access_rules`
   - `user_rule_status`
   - `access_logs`

### 1.4 Get API Credentials

1. Go to **Settings → API**
2. Copy these values (you'll need them later):
   - **Project URL**: `https://your-project-ref.supabase.co`
   - **anon public** key
   - **service_role** key (⚠️ Keep this secret!)

---

## 📦 **Step 2: Prepare Code for Deployment**

### 2.1 Update Environment Variables

Create `.env.local` file (if not exists):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_DEFAULT_PROPERTY_ID=00000000-0000-0000-0000-000000000001
```

### 2.2 Test Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and verify:
- ✅ Homepage loads with Navy/Teal theme
- ✅ Dashboard at `/dashboard` loads
- ✅ Scanner at `/scanner` loads

### 2.3 Build Test

```bash
npm run build
```

Should complete without errors.

---

## 🐙 **Step 3: Push to GitHub**

### 3.1 Initialize Git (if not done)

```bash
git init
git add .
git commit -m "Initial commit - Secure Access Pass"
```

### 3.2 Create GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. **Repository name**: `secure-access-pass`
3. **Visibility**: Private (recommended for production)
4. **Do NOT** initialize with README (we already have one)
5. Click **"Create repository"**

### 3.3 Push Code

```bash
git remote add origin https://github.com/YOUR_USERNAME/secure-access-pass.git
git branch -M main
git push -u origin main
```

---

## ☁️ **Step 4: Deploy to Vercel**

### 4.1 Connect GitHub Repository

1. Go to [vercel.com](https://vercel.com)
2. Click **"Add New Project"**
3. Import your `secure-access-pass` repository
4. Vercel will auto-detect Next.js settings

### 4.2 Configure Environment Variables

In Vercel project settings, add these environment variables:

| Variable Name | Value | Notes |
|--------------|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project-ref.supabase.co` | From Supabase Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1...` | anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1...` | ⚠️ service_role key (secret!) |
| `NEXT_PUBLIC_DEFAULT_PROPERTY_ID` | `00000000-0000-0000-0000-000000000001` | Default property ID |

**Important**: Mark `SUPABASE_SERVICE_ROLE_KEY` as **secret** (not exposed to frontend)

### 4.3 Deploy

1. Click **"Deploy"**
2. Wait ~2 minutes for build
3. You'll get a URL like: `https://secure-access-pass.vercel.app`

### 4.4 Verify Deployment

Visit your Vercel URL and test:
- ✅ Homepage loads correctly
- ✅ Click **"Manager Dashboard"** → loads `/dashboard`
- ✅ Click **"Open Scanner"** → loads `/scanner`
- ✅ Try adding a resident in dashboard
- ✅ Try scanning a QR code on mobile

---

## 📱 **Step 5: Mobile Testing**

### 5.1 Test Scanner on Mobile Device

1. Open your Vercel URL on a **smartphone**
2. Navigate to `/scanner`
3. Allow camera permissions when prompted
4. Test QR code scanning:
   - Generate a resident QR code in dashboard
   - Download QR code PNG
   - Open on another device
   - Scan with scanner

### 5.2 Test Entry/Exit Flow

1. **ENTRY Mode**:
   - Scan a resident QR code
   - Should show green "Access Granted"
   - Verify location updates to "INSIDE" in dashboard

2. **Anti-Passback Test**:
   - Scan the same QR code again (while INSIDE)
   - Should show red "Pass already in use"

3. **EXIT Mode**:
   - Toggle to EXIT mode
   - Scan the QR code
   - Should show green "Exit Recorded"
   - Verify location updates to "OUTSIDE"

4. **Failed Rule Test**:
   - In dashboard, toggle OFF a rule for a resident
   - Try to scan their QR code in ENTRY mode
   - Should show red "Access Denied: [Rule Name] is False"

---

## 🔒 **Step 6: Security Hardening**

### 6.1 Enable Row Level Security (already done in schema)

Verify in Supabase:
1. Go to **Authentication → Policies**
2. Check that policies exist for all tables

### 6.2 Disable Public Signups (Optional)

If you want to manually manage users:
1. Go to **Authentication → Settings**
2. Disable **"Enable email signups"**

### 6.3 Configure CORS (if needed)

In Supabase:
1. Go to **Settings → API**
2. Add your Vercel domain to allowed origins

---

## 🌐 **Step 7: Custom Domain (Optional)**

### 7.1 Add Custom Domain in Vercel

1. Go to your project **Settings → Domains**
2. Add your domain: `pool.yourdomain.com`
3. Follow DNS configuration instructions

### 7.2 Update Supabase CORS

Add your custom domain to Supabase allowed origins.

---

## 📊 **Step 8: Monitoring & Analytics**

### 8.1 Vercel Analytics (Free)

Automatically enabled - view in Vercel dashboard.

### 8.2 Supabase Usage

Monitor database usage:
1. Go to **Settings → Usage**
2. Check:
   - Database size
   - API requests
   - Storage usage

---

## 🔄 **Step 9: Continuous Deployment**

### 9.1 Automatic Deployments

Vercel automatically deploys on `git push`:
- Push to `main` → Production deployment
- Push to feature branch → Preview deployment

### 9.2 Update Process

```bash
# Make changes locally
npm run dev  # Test locally

# Commit and push
git add .
git commit -m "Add new feature"
git push origin main

# Vercel automatically deploys
```

---

## 🆘 **Troubleshooting**

### Issue: "Cannot connect to database"

**Solution**:
- Verify `NEXT_PUBLIC_SUPABASE_URL` is correct
- Check Supabase project is active
- Verify environment variables in Vercel

### Issue: "Camera not working on mobile"

**Solution**:
- Ensure you're using **HTTPS** (Vercel provides this)
- Check mobile browser permissions
- Try Safari on iOS, Chrome on Android

### Issue: "QR codes not generating"

**Solution**:
- Verify `qrcode.react` is installed
- Check browser console for errors
- Ensure resident has valid `qr_code` field

### Issue: "Rules not updating"

**Solution**:
- Hard refresh browser (Ctrl+Shift+R)
- Check Supabase RLS policies
- Verify API routes are working

---

## 📈 **Production Best Practices**

### Database

- ✅ **Backups**: Supabase auto-backups daily (Pro plan)
- ✅ **Indexes**: Already created in schema for performance
- ✅ **Monitoring**: Set up alerts in Supabase

### Application

- ✅ **Error Tracking**: Consider adding Sentry
- ✅ **Logging**: Use Vercel Logs for debugging
- ✅ **Performance**: Vercel Edge Network provides global CDN

### Security

- ✅ **Environment Variables**: Never commit `.env.local`
- ✅ **Service Role Key**: Only use server-side
- ✅ **RLS Policies**: Already configured

---

## 🎉 **Success Checklist**

- [ ] Application deployed to Vercel
- [ ] Database connected and working
- [ ] Can add residents in dashboard
- [ ] QR codes generate and download
- [ ] Scanner works on mobile device
- [ ] Entry/Exit flow works correctly
- [ ] Anti-passback enforcement works
- [ ] Rule toggle system works
- [ ] Access logs are recording
- [ ] Custom domain configured (optional)

---

## 📞 **Support Resources**

- **Next.js Docs**: [nextjs.org/docs](https://nextjs.org/docs)
- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **Vercel Docs**: [vercel.com/docs](https://vercel.com/docs)
- **Tailwind Docs**: [tailwindcss.com/docs](https://tailwindcss.com/docs)

---

## 🔄 **Updating Production**

```bash
# 1. Make changes locally
git pull origin main
# ... make changes ...

# 2. Test locally
npm run dev

# 3. Build test
npm run build

# 4. Commit and push
git add .
git commit -m "Description of changes"
git push origin main

# 5. Vercel auto-deploys (check dashboard)
```

---

**🚀 Deployment Complete!**

Your Secure Access Pass application is now live and ready to manage pool access for apartment complexes!
