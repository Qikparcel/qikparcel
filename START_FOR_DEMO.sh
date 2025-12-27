#!/bin/bash

echo "🎬 Starting Server for Client Demo"
echo "==================================="
echo ""

# Kill everything
echo "Clearing processes..."
pkill -f "next" 2>/dev/null
kill -9 $(lsof -ti:3000) 2>/dev/null
sleep 3

# Clear cache
echo "Clearing cache..."
rm -rf .next

# Start server
echo ""
echo "Starting server on http://localhost:3000"
echo "Press Ctrl+C to stop"
echo ""
echo "Server will be ready in ~10 seconds..."
echo ""

PORT=3000 npm run dev



