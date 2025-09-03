#!/bin/bash
# Stop MVP services

echo "🛑 Stopping Smart Recycling Bin MVP..."

if [ -f "mvp.pid" ]; then
    while IFS= read -r pid; do
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            # ✨ CRITICAL CHANGE: Kill the entire process group
            # The '--' ensures that the negative PID is not mistaken for an option.
            echo "🔴 Stopping process group $pid"
            kill -- -$pid
        fi
    done < mvp.pid
    
    # Wait a moment and force kill if necessary
    sleep 3
    
    while IFS= read -r pid; do
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            echo "💥 Force stopping process group $pid"
            kill -9 -- -$pid
        fi
    done < mvp.pid
    
    rm mvp.pid
    echo "✅ All services stopped"
else
    # ... (fallback logic can remain the same) ...
    echo "⚠️  PID file not found. Attempting to kill by port..."
    lsof -ti:5099 | xargs kill -9 2>/dev/null || true
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    lsof -ti:8001 | xargs kill -9 2>/dev/null || true
    lsof -ti:8002 | xargs kill -9 2>/dev/null || true
    echo "✅ Port cleanup completed"
fi
