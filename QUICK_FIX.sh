#!/bin/bash

echo "🔧 Quick Fix Script for QikParcel"
echo "=================================="
echo ""

# Kill any existing processes
echo "1️⃣ Killing existing processes on port 3000..."
kill -9 $(lsof -ti:3000) 2>/dev/null || echo "   Port 3000 is free"
sleep 2

# Check .env.local
echo ""
echo "2️⃣ Checking environment variables..."
if [ ! -f .env.local ]; then
    echo "   ❌ .env.local not found!"
    echo "   Please create .env.local with credentials"
    exit 1
else
    echo "   ✅ .env.local exists"
fi

# Check node_modules
echo ""
echo "3️⃣ Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "   📦 Installing dependencies..."
    npm install
else
    echo "   ✅ Dependencies installed"
fi

# Start server
echo ""
echo "4️⃣ Starting development server..."
echo "   Server will start on http://localhost:3000"
echo "   Press Ctrl+C to stop"
echo ""
npm run dev



