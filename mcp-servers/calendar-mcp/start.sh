#!/bin/bash

# Google Calendar MCP Server Startup Script

echo "🚀 Starting Google Calendar MCP Server..."
echo "========================================"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from template..."
    cp .env.example .env
    echo "✅ Created .env file from template"
    echo ""
    echo "📝 Please edit .env file with your Google OAuth credentials:"
    echo "   - GOOGLE_CLIENT_ID"
    echo "   - GOOGLE_CLIENT_SECRET"
    echo ""
    echo "🔗 Get credentials from: https://console.cloud.google.com/"
    echo ""
    read -p "Press Enter after updating .env file to continue..."
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Build the project
if [ ! -d "dist" ] || [ "src" -nt "dist" ]; then
    echo "🔨 Building project..."
    npm run build
    echo ""
fi

# Start the server
echo "🌟 Starting MCP server..."
echo ""
npm start