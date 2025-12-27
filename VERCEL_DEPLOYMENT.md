# Vercel Deployment Guide

This guide will walk you through deploying QikParcel MVP to Vercel.

## Prerequisites

1. ✅ Vercel account created (sign up at https://vercel.com)
2. ✅ GitHub account (recommended) or GitLab/Bitbucket
3. ✅ Code pushed to a Git repository
4. ✅ All environment variables documented (see below)

## Option 1: Deploy via Vercel Dashboard (Recommended)

### Step 1: Push Code to GitHub

1. If you haven't already, initialize a Git repository:

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. Create a new repository on GitHub:

   - Go to https://github.com/new
   - Name it: `qikparcel-mvp` (or your preferred name)
   - Choose Private (recommended) or Public
   - Click "Create repository"

3. Push your code:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/qikparcel-mvp.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Import Project to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Click **"Import Git Repository"**
4. Select your GitHub account (if not connected, connect it first)
5. Find and select your `qikparcel-mvp` repository
6. Click **"Import"**

### Step 3: Configure Project Settings

1. **Project Name**: `qikparcel-mvp` (or your preferred name)
2. **Framework Preset**: Next.js (should be auto-detected)
3. **Root Directory**: `./` (leave as default)
4. **Build Command**: `npm run build` (leave as default)
5. **Output Directory**: `.next` (leave as default)
6. **Install Command**: `npm install` (leave as default)

### Step 4: Add Environment Variables

**IMPORTANT**: Add all these environment variables in Vercel before deploying!

Click **"Environment Variables"** and add each one:

#### Supabase Variables:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

#### Twilio Variables:

```
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_MESSAGING_SERVICE_SID=MG6b9f0c807e8e0870fabb911bc69473e6
TWILIO_CONTENT_SID=your_twilio_content_template_sid
```

#### Application Variables:

```
NEXT_PUBLIC_APP_URL=https://your-project.vercel.app
```

**Note**: After first deployment, update `NEXT_PUBLIC_APP_URL` with your actual Vercel URL.

#### For Each Environment:

- ✅ Production
- ✅ Preview
- ✅ Development

Click **"Save"** after adding all variables.

### Step 5: Deploy

1. Review your settings
2. Click **"Deploy"**
3. Wait for the build to complete (usually 2-5 minutes)
4. Once deployed, you'll get a URL like: `https://qikparcel-mvp.vercel.app`

### Step 6: Update Environment Variables (if needed)

After first deployment:

1. Go to **Settings** → **Environment Variables**
2. Update `NEXT_PUBLIC_APP_URL` with your actual deployment URL
3. Redeploy (Vercel will auto-redeploy, or trigger manually)

## Option 2: Deploy via Vercel CLI

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```

### Step 3: Deploy

```bash
# From your project directory
cd /Users/nomanashraf/Desktop/QKPARCEL

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Step 4: Add Environment Variables via CLI

```bash
# Add environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add TWILIO_ACCOUNT_SID
vercel env add TWILIO_AUTH_TOKEN
vercel env add TWILIO_MESSAGING_SERVICE_SID
vercel env add TWILIO_CONTENT_SID
vercel env add NEXT_PUBLIC_APP_URL

# For each variable, select:
# - Which environments (Production, Preview, Development)
# - Enter the value
```

## Post-Deployment Checklist

### 1. Update Supabase Settings

1. Go to Supabase Dashboard → **Authentication** → **URL Configuration**
2. Add your Vercel URL to **Redirect URLs**:

   - `https://your-project.vercel.app/**`
   - `https://your-project.vercel.app/dashboard`
   - `https://your-project.vercel.app/login`
   - `https://your-project.vercel.app/signup`

3. Update **Site URL** to: `https://your-project.vercel.app`

### 2. Update Twilio Webhook (if using)

If you have WhatsApp webhooks configured:

1. Go to Twilio Console → **Messaging** → **WhatsApp Sandbox** (or your WhatsApp sender)
2. Update webhook URL to: `https://your-project.vercel.app/api/whatsapp/webhook`

### 3. Test the Deployment

1. Visit your Vercel URL
2. Test signup flow (both sender and courier)
3. Test login flow
4. Verify OTP delivery via WhatsApp
5. Check that documents upload for couriers

### 4. Verify Environment Variables

Check that all variables are set correctly:

1. Go to Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
2. Verify all variables are present
3. Make sure they're enabled for the correct environments

## Environment Variables Reference

### Required Variables:

| Variable                        | Description                              | Example                              |
| ------------------------------- | ---------------------------------------- | ------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Your Supabase project URL                | `https://xxxxx.supabase.co`          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key                   | `eyJhbGc...`                         |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase service role key (keep secret!) | `eyJhbGc...`                         |
| `TWILIO_ACCOUNT_SID`            | Twilio Account SID                       | `ACxxxxxxxxxxxxx`                    |
| `TWILIO_AUTH_TOKEN`             | Twilio Auth Token                        | `your_auth_token`                    |
| `TWILIO_MESSAGING_SERVICE_SID`  | Twilio Messaging Service SID             | `MG6b9f0c807e8e0870fabb911bc69473e6` |
| `TWILIO_CONTENT_SID`            | Twilio Content Template SID              | `HX3d88c55ab0f20871ef1ab83d9ae64040` |
| `NEXT_PUBLIC_APP_URL`           | Your Vercel deployment URL               | `https://qikparcel-mvp.vercel.app`   |

### Where to Find These Values:

- **Supabase**: Dashboard → Settings → API
- **Twilio**: Console → Account → Settings
- **Vercel URL**: Your project dashboard URL

## Troubleshooting

### Build Fails

**Error: "Module not found"**

- Make sure all dependencies are in `package.json`
- Run `npm install` locally to verify
- Check that `node_modules` is in `.gitignore`

**Error: "Environment variable missing"**

- Add all required environment variables in Vercel
- Make sure variables are set for the correct environment (Production/Preview)

### Deployment Succeeds but App Doesn't Work

**Error: "Invalid Supabase URL"**

- Check `NEXT_PUBLIC_SUPABASE_URL` is correct
- Make sure it starts with `https://`

**Error: "Failed to send OTP"**

- Verify Twilio credentials are correct
- Check Twilio account has sufficient balance
- Verify `TWILIO_CONTENT_SID` is correct

**Error: "Storage bucket not found"**

- Make sure you created the `courier-documents` bucket in Supabase
- Verify storage policies are set up

### Preview Deployments

Every push to your repository will create a preview deployment:

- Preview URLs: `https://qikparcel-mvp-git-branch-username.vercel.app`
- Use preview deployments to test before merging to main

## Continuous Deployment

Once connected to GitHub:

- ✅ Every push to `main` → Production deployment
- ✅ Every pull request → Preview deployment
- ✅ Automatic deployments enabled by default

## Custom Domain (Optional)

1. Go to Vercel Dashboard → Your Project → **Settings** → **Domains**
2. Add your custom domain
3. Follow DNS configuration instructions
4. Update `NEXT_PUBLIC_APP_URL` and Supabase redirect URLs

## Next Steps After Deployment

1. ✅ Share your Vercel URL with team members
2. ✅ Set up monitoring (Vercel Analytics)
3. ✅ Configure error tracking (Sentry, etc.)
4. ✅ Set up custom domain (if needed)
5. ✅ Configure production environment variables
6. ✅ Test all features in production
7. ✅ Set up database backups in Supabase

## Support

If you encounter issues:

1. Check Vercel build logs in the dashboard
2. Check function logs for API route errors
3. Verify all environment variables are set
4. Test locally with production environment variables (use `.env.local`)
