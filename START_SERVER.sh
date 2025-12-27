#!/bin/bash

echo "🚀 Starting QikParcel Server for Client Demo"
echo "============================================"
echo ""

# Kill any existing processes
echo "1️⃣ Clearing port 3000..."
kill -9 $(lsof -ti:3000) 2>/dev/null
pkill -f "next dev" 2>/dev/null
sleep 2

# Check environment
echo "2️⃣ Checking environment..."
if [ ! -f .env.local ]; then
    echo "   ❌ .env.local not found!"
    exit 1
fi
echo "   ✅ Environment ready"

# Start server
echo ""
echo "3️⃣ Starting server on http://localhost:3000"
echo "   Press Ctrl+C to stop"
echo ""
echo "   Opening browser in 5 seconds..."
echo ""

# Start server in foreground so user can see output
PORT=3000 npm run dev



