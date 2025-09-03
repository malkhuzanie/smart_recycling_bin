#!/bin/bash
# This script installs all necessary dependencies for the project's services.
# It should be run from the root directory of the project.

# Exit immediately if a command exits with a non-zero status.
set -e

echo "🚀 Starting development environment setup for the Smart Recycling Bin..."
echo "======================================================================"

# --- 1. Backend (.NET) Dependencies ---
echo ""
echo "🏢 Setting up C# Backend dependencies..."
cd backend
dotnet restore
echo "✅ Backend dependencies restored successfully."
cd ..

# --- 2. Frontend (Node.js) Dependencies ---
echo ""
echo "⚛️  Setting up React Frontend dependencies..."
cd frontend
npm install
echo "✅ Frontend dependencies installed successfully."
cd ..

# --- 3. Python Services Dependencies ---
echo ""
echo "🐍 Setting up Python Services dependencies..."
cd python-services

echo "   - Installing Python packages from requirements_integrated.txt..."
pip install -r requirements_integrated.txt

echo "   - Deactivating virtual environment."
deactivate

echo "✅ Python dependencies installed successfully into 'python-services/venv/'."
cd ..

echo ""
echo "🎉 All dependencies have been installed successfully!"
echo "======================================================================"
echo "💡 You can now run the system using './scripts/start-mvp.sh'"
