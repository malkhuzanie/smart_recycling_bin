#!/bin/bash
# Start all MVP services for development: Backend, Frontend, and Python Services

echo "🚀 Starting Smart Recycling Bin MVP..."
echo "========================================"

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️  Port $1 is already in use. Please stop the service using this port."
        return 1
    fi
    return 0
}

# --- 1. Check required ports ---
check_port 5099 || { exit 1; } # Backend (updated to 5099 from your logs)
check_port 3000 || { exit 1; } # Frontend
check_port 8001 || { exit 1; } # ✨ NEW: Python CNN Health
check_port 8002 || { exit 1; } # ✨ NEW: Python Arduino Health

echo "✅ All required ports (5099, 3000, 8001, 8002) are available."

# --- 2. Start Backend Service ---
echo "🏢 Starting C# Backend..."
cd backend
# Use the port from your launchSettings.json
setsid dotnet run --urls="http://localhost:5099" &
BACKEND_PID=$!
cd .. # Return to project root

# Wait for backend to be fully ready
echo "⏳ Waiting for backend to initialize..."
sleep 12 # Increased sleep time slightly for safety

# Check if backend is running and healthy
if ! curl -f http://localhost:5099/api/system/ping > /dev/null 2>&1; then
    echo "❌ Backend failed to start or is not responding on http://localhost:5099/api/system/ping"
    echo "   Killing process $BACKEND_PID..."
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi
echo "✅ Backend started successfully (PID: $BACKEND_PID)"

# --- 3. ✨ NEW: Start Python Services ---
echo "🐍 Starting Python Orchestrated Services..."
cd python-services
# It's assumed python is on the PATH. If you use a venv, activate it first.
# Example: source ../venv/bin/activate
setsid python orchestrated_main_service.py &
PYTHON_PID=$!
cd .. # Return to project root
echo "✅ Python Services starting... (PID: $PYTHON_PID)"
sleep 5 # Give Python services a moment to initialize

# --- 4. Start Frontend Service ---
echo "⚛️  Starting React Frontend..."
cd frontend
setsid npm start &
FRONTEND_PID=$!
cd .. # Return to project root
echo "✅ Frontend starting... (PID: $FRONTEND_PID)"

# --- 5. Create PID file for easy cleanup ---
echo "📝 Writing PIDs to mvp.pid file for cleanup..."
echo "$BACKEND_PID" > mvp.pid
echo "$FRONTEND_PID" >> mvp.pid
echo "$PYTHON_PID" >> mvp.pid # ✨ NEW: Add Python service PID

echo ""
echo "🎉 All MVP Services Started Successfully!"
echo "========================================"
echo "📱 Frontend Dashboard:      http://localhost:3000"
echo "🏢 Backend API:             http://localhost:5099"
echo "📊 API Documentation:       http://localhost:5099/swagger"
echo "🐍 Python CNN Health:       http://localhost:8001/health" # ✨ NEW
echo "🐍 Python Arduino Health:   http://localhost:8002/health" # ✨ NEW
echo ""
echo "🔄 Services are running in the background."
echo "💡 To stop all services, run: ./scripts/stop-mvp.sh"
echo ""
echo "📋 View logs in the terminal or in the /logs directory."
