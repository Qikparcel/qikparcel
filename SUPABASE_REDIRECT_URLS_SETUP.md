# Supabase Redirect URLs Setup

## Why This is Needed

Supabase requires you to whitelist redirect URLs for security. Even if your code passes a `redirectTo` URL, Supabase will only allow redirects to URLs that are in your allowed list.

## Step-by-Step Instructions

### 1. Go to Supabase Dashboard

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Select your QikParcel project

### 2. Navigate to Authentication Settings

1. In the left sidebar, click **"Authentication"**
2. Click **"URL Configuration"** (or look for "Redirect URLs" or "Site URL")

### 3. Add Redirect URLs

You need to add the following URLs to the **"Redirect URLs"** section:

#### For Local Development:

```
http://localhost:3000/**
http://localhost:3000/dashboard
http://localhost:3000/login
http://localhost:3000/signup
```

#### For Production (replace `your-project` with your actual Vercel URL):

```
https://your-project.vercel.app/**
https://your-project.vercel.app/dashboard
https://your-project.vercel.app/login
https://your-project.vercel.app/signup
```

**Important:** Use `/**` to allow all paths under that domain, or list specific paths.

### 4. Update Site URL (Optional but Recommended)

Also update the **"Site URL"** field:

- **Local:** `http://localhost:3000`
- **Production:** `https://your-project.vercel.app`

### 5. Save Changes

Click **"Save"** or **"Update"** to save your changes.

## Example Configuration

Your Redirect URLs list should look something like this:

```
http://localhost:3000/**
https://qikparcel-mvp.vercel.app/**
https://qikparcel-mvp-git-main-yourname.vercel.app/**
```

The `/**` pattern allows all paths under that domain, which is more flexible for development.

## Quick Access Path

Supabase Dashboard → Your Project → **Authentication** → **URL Configuration** → **Redirect URLs**

## Notes

- Changes take effect immediately
- You can add multiple URLs (one per line)
- Use `/**` for wildcard matching (recommended)
- Always include both localhost (for development) and production URLs

## Testing

After updating:

1. Try signing in locally - should redirect to `http://localhost:3000/dashboard`
2. Try signing in on production - should redirect to your Vercel URL

If you're still seeing localhost URLs in production, make sure:

1. ✅ Redirect URLs are added in Supabase
2. ✅ Your code changes are deployed
3. ✅ Environment variables are set correctly on Vercel
