#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Sixty Sales Dashboard Development Servers${NC}"
echo ""

# Kill any existing servers on our ports
echo -e "${YELLOW}🔍 Checking for existing servers...${NC}"
lsof -ti:5173,5174,5175,8000 | xargs kill -9 2>/dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Cleaned up existing servers${NC}"
else
    echo -e "${GREEN}✅ No existing servers found${NC}"
fi

# Start backend server
echo ""
echo -e "${YELLOW}🎯 Starting backend server on port 8000...${NC}"
npm run dev:api &
BACKEND_PID=$!

# Wait for backend to be ready
echo -e "${YELLOW}⏳ Waiting for backend to be ready...${NC}"
while ! curl -s http://localhost:8000/api/health > /dev/null 2>&1; do
    sleep 1
done
echo -e "${GREEN}✅ Backend server is ready!${NC}"

# Start frontend server
echo ""
echo -e "${YELLOW}🎨 Starting frontend server...${NC}"
npm run dev &
FRONTEND_PID=$!

# Wait for frontend to be ready
echo -e "${YELLOW}⏳ Waiting for frontend to be ready...${NC}"
sleep 3

# Find which port Vite is using
VITE_PORT=$(lsof -i -P -n | grep LISTEN | grep node | grep -E "517[0-9]" | head -1 | awk '{print $9}' | cut -d: -f2)

if [ -z "$VITE_PORT" ]; then
    VITE_PORT="5173"
fi

echo ""
echo -e "${GREEN}✅ All servers are running!${NC}"
echo ""
echo -e "${GREEN}📱 Frontend: http://localhost:${VITE_PORT}${NC}"
echo -e "${GREEN}🔧 Backend API: http://localhost:8000${NC}"
echo -e "${GREEN}❤️  Health Check: http://localhost:8000/api/health${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all servers${NC}"

# Function to handle shutdown
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Shutting down servers...${NC}"
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    # Also kill any node processes on our ports
    lsof -ti:5173,5174,5175,8000 | xargs kill -9 2>/dev/null
    echo -e "${GREEN}✅ All servers stopped${NC}"
    exit 0
}

# Set up trap to catch Ctrl+C
trap cleanup INT

# Keep script running and show logs
wait