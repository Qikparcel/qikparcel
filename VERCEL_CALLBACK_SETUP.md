# Vercel Deployment - Callback URL Setup

## Important: Add Callback URL to Supabase

After deploying to Vercel, you **MUST** add the callback URL to Supabase's allowed redirect URLs.

### Steps:

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** > **URL Configuration**
3. Under **Redirect URLs**, add:
   ```
   https://your-app.vercel.app/callback
   ```
   Replace `your-app.vercel.app` with your actual Vercel deployment URL.

4. Also add your production URL to the **Site URL** if not already set:
   ```
   https://your-app.vercel.app
   ```

### Why This Is Needed

The magic link redirects to `/callback` which handles authentication tokens. Supabase requires all redirect URLs to be explicitly whitelisted for security.

### Testing

After adding the callback URL:
1. Try logging in on your Vercel deployment
2. You should be redirected to `/callback` after OTP verification
3. Then automatically redirected to `/dashboard`

If you still see issues, check:
- Browser console for errors
- Vercel function logs for API route errors
- Network tab to see if the callback API is being called



