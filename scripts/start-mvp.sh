#!/bin/bash
# Start MVP services for development

echo "🚀 Starting Smart Recycling Bin MVP..."

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️  Port $1 is already in use"
        return 1
    fi
    return 0
}

# Check required ports
check_port 5000 || { echo "Backend port 5000 is busy. Please stop the service using this port."; exit 1; }
check_port 3000 || { echo "Frontend port 3000 is busy. Please stop the service using this port."; exit 1; }

echo "✅ Ports are available"

# Start services in background
echo "🏢 Starting Backend..."
cd backend
dotnet run --urls="http://localhost:5000" &
BACKEND_PID=$!

# Wait for backend to start
echo "⏳ Waiting for backend to start..."
sleep 10

# Check if backend is running
if ! curl -f http://localhost:5000/health > /dev/null 2>&1; then
    echo "❌ Backend failed to start"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

echo "✅ Backend started successfully"

# Start frontend
echo "⚛️ Starting Frontend..."
cd ../frontend
npm start &
FRONTEND_PID=$!

echo "✅ Frontend starting..."

# Create PID file for cleanup
echo "$BACKEND_PID" > ../mvp.pid
echo "$FRONTEND_PID" >> ../mvp.pid

echo ""
echo "🎉 MVP Started Successfully!"
echo "=========================="
echo "📱 Frontend Dashboard: http://localhost:3000"
echo "🏢 Backend API:        http://localhost:5000"
echo "📊 API Documentation:  http://localhost:5000/swagger"
echo ""
echo "🔄 The services are running in the background."
echo "💡 To stop all services, run: ./scripts/stop-mvp.sh"
echo ""
echo "📋 Logs:"
echo "   Backend:  Check terminal output or logs/ directory"
echo "   Frontend: Check browser developer console"
