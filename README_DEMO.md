# 🎬 Milestone 1 Demo - Quick Start

## Before Demo: Run These Commands

### 1. Install Dependencies (if not done)
```bash
npm install
```

### 2. Test Everything
```bash
# Test Supabase
npm run test:supabase

# Test WhatsApp  
npm run test:whatsapp

# Start server
npm run dev
```

### 3. Verify Database
- Go to: https://app.supabase.com/project/zleorpeqpbyttemxgedi
- Check Table Editor - should see 10 tables
- If missing, run migrations from `supabase/migrations/`

---

## Demo Commands

### Show Homepage
Visit: http://localhost:3000

### Test API
```bash
curl http://localhost:3000/api/whatsapp/webhook
```

### Send WhatsApp Message
```bash
npm run test:whatsapp
```

---

## Demo Checklist

- [ ] Supabase test passes
- [ ] WhatsApp test passes  
- [ ] Homepage loads
- [ ] API endpoint responds
- [ ] Database tables visible
- [ ] Phone ready for WhatsApp test

---

## Full Demo Guide

See `DEMO_SCRIPT.md` for complete demo flow.

---

**Ready for demo! 🚀**



