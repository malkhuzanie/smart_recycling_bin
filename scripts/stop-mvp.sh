#!/bin/bash
# Stop MVP services

echo "🛑 Stopping Smart Recycling Bin MVP..."

if [ -f "mvp.pid" ]; then
    while IFS= read -r pid; do
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            echo "🔴 Stopping process $pid"
            kill "$pid"
        fi
    done < mvp.pid
    
    # Wait a moment and force kill if necessary
    sleep 3
    
    while IFS= read -r pid; do
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            echo "💥 Force stopping process $pid"
            kill -9 "$pid"
        fi
    done < mvp.pid
    
    rm mvp.pid
    echo "✅ All services stopped"
else
    echo "⚠️  PID file not found. Attempting to kill by port..."
    
    # Kill processes on known ports
    lsof -ti:5000 | xargs kill -9 2>/dev/null || true
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    
    echo "✅ Port cleanup completed"
fi
