#!/bin/bash
set -e

echo "🚀 Installing Gmail MCP Server..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed. Please install Node.js 18+ and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | sed 's/v//')
REQUIRED_VERSION="18.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "❌ Node.js version $NODE_VERSION is not supported. Please install Node.js 18+ and try again."
    exit 1
fi

echo "✅ Node.js version $NODE_VERSION detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building TypeScript..."
npm run build

# Check if environment file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your Google OAuth credentials"
else
    echo "✅ .env file already exists"
fi

echo ""
echo "🎉 Gmail MCP Server installation complete!"
echo ""
echo "📋 Next steps:"
echo "1. Get Google OAuth credentials from https://console.cloud.google.com/"
echo "2. Edit .env file with your credentials"
echo "3. Add this server to your MCP client configuration:"
echo ""
echo "   {"
echo "     \"command\": \"node\","
echo "     \"args\": [\"$(pwd)/dist/index.js\"],"
echo "     \"env\": {"
echo "       \"GOOGLE_CLIENT_ID\": \"your_client_id\","
echo "       \"GOOGLE_CLIENT_SECRET\": \"your_client_secret\""
echo "     }"
echo "   }"
echo ""
echo "📚 See README.md for detailed setup instructions"