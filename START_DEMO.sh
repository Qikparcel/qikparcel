#!/bin/bash

# Milestone 1 Demo Startup Script
# Run this script to start everything for the demo

echo "🚀 Starting QikParcel MVP Demo..."
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ Error: .env.local file not found!"
    echo "Please create .env.local with all credentials"
    exit 1
fi

echo "✅ Environment variables found"
echo ""

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

echo "🧪 Running pre-demo tests..."
echo ""

# Test Supabase
echo "1️⃣ Testing Supabase connection..."
npm run test:supabase
SUPABASE_TEST=$?

echo ""
echo "2️⃣ Testing WhatsApp integration..."
npm run test:whatsapp
WHATSAPP_TEST=$?

echo ""
if [ $SUPABASE_TEST -eq 0 ] && [ $WHATSAPP_TEST -eq 0 ]; then
    echo "✅ All tests passed!"
    echo ""
    echo "🌐 Starting development server..."
    echo "Visit: http://localhost:3000"
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo ""
    npm run dev
else
    echo "❌ Some tests failed. Please check the errors above."
    echo ""
    echo "Troubleshooting:"
    echo "- Verify .env.local has all credentials"
    echo "- Check Supabase dashboard is accessible"
    echo "- Verify Twilio account has credits"
    exit 1
fi



