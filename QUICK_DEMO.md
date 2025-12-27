# Quick Demo Commands 🚀

**Run these commands in order for the demo:**

## 1. Start Dev Server

```bash
npm run dev
```

**Expected:** Server running on http://localhost:3000

---

## 2. Test Supabase (in new terminal)

```bash
npm run test:supabase
```

**Expected:** ✅ Connection successful

---

## 3. Test WhatsApp (in new terminal)

```bash
npm run test:whatsapp
```

**Expected:** ✅ Message sent successfully

---

## 4. Test API Endpoints

```bash
# Health check
curl http://localhost:3000/api/whatsapp/webhook

# Test send message
curl -X POST http://localhost:3000/api/whatsapp/test \
  -H "Content-Type: application/json" \
  -d '{"to": "+923224916205", "message": "Demo message from QikParcel!"}'
```

---

## 5. Open in Browser

Visit: http://localhost:3000

---

## Demo Flow

1. ✅ Show homepage (http://localhost:3000)
2. ✅ Show Supabase dashboard (tables)
3. ✅ Send WhatsApp message (test script)
4. ✅ Show webhook endpoint (curl)
5. ✅ Show project structure
6. ✅ Show documentation

---

**All set for demo! 🎬**



