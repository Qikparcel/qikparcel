# Quick Start Guide - Milestone 1 🚀

**Fastest way to get Milestone 1 running**

---

## 1. Install Dependencies

```bash
npm install
```

---

## 2. Set Up Database (5 minutes)

### Option A: Copy-Paste Method (Easiest)

1. **Go to:** https://app.supabase.com/project/zleorpeqpbyttemxgedi/sql/new

2. **Run Migration 1:**
   - Open `supabase/migrations/001_initial_schema.sql`
   - Copy ALL contents
   - Paste into SQL Editor
   - Click **"Run"**

3. **Run Migration 2:**
   - Click "New Query"
   - Open `supabase/migrations/002_rls_policies.sql`
   - Copy ALL contents
   - Paste into SQL Editor
   - Click **"Run"**

✅ Done! Database is ready.

---

## 3. Test Everything

```bash
# Test Supabase connection
npm run test:supabase

# Test WhatsApp (sends to +923224916205)
npm run test:whatsapp

# Start dev server
npm run dev
```

Visit: http://localhost:3000

---

## 4. Verify Checklist

- [ ] Dependencies installed (`npm install`)
- [ ] Database migrations run (Step 2)
- [ ] Supabase test passes (`npm run test:supabase`)
- [ ] WhatsApp test passes (`npm run test:whatsapp`)
- [ ] Dev server runs (`npm run dev`)
- [ ] Homepage loads at http://localhost:3000

---

## ✅ Milestone 1 Complete!

If all checks pass, you're done! 🎉

**Next:** See `MILESTONE_1_COMPLETE_GUIDE.md` for detailed documentation.

---

## Need Help?

- **Database issues?** → Check `SUPABASE_SETUP.md`
- **WhatsApp issues?** → Check `TWILIO_SETUP.md`
- **Detailed steps?** → Check `MILESTONE_1_COMPLETE_GUIDE.md`

