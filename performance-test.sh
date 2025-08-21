#!/bin/bash

echo "🚀 Running Performance Test Suite"
echo "================================="
echo ""

API_BASE="http://127.0.0.1:8000/api"
OWNER_ID="ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459"

# Function to measure API response time
measure_time() {
    local endpoint=$1
    local description=$2
    
    echo "Testing: $description"
    
    # Run 5 times and calculate average
    total_time=0
    for i in {1..5}; do
        response_time=$(curl -s -o /dev/null -w "%{time_total}" "$endpoint")
        duration=$(echo "$response_time * 1000" | bc | cut -d. -f1)
        total_time=$(($total_time + $duration))
        echo "  Run $i: ${duration}ms"
    done
    
    avg_time=$(($total_time / 5))
    echo "  📊 Average: ${avg_time}ms"
    echo ""
}

echo "1️⃣ COMPANIES ENDPOINT"
echo "----------------------"
measure_time "$API_BASE/companies?includeStats=true&ownerId=$OWNER_ID&limit=20" "Companies with stats"

echo "2️⃣ DEALS ENDPOINT"
echo "-----------------"
measure_time "$API_BASE/deals?ownerId=$OWNER_ID&limit=20" "Deals with relationships"

echo "3️⃣ CONTACTS ENDPOINT"
echo "--------------------"
measure_time "$API_BASE/contacts?ownerId=$OWNER_ID&limit=20" "Contacts with company"

echo "4️⃣ OWNERS ENDPOINT"
echo "------------------"
measure_time "$API_BASE/owners" "Owners with stats"

echo "5️⃣ STAGES ENDPOINT"
echo "------------------"
measure_time "$API_BASE/stages" "Deal stages"

echo "6️⃣ CACHE PERFORMANCE"
echo "--------------------"
curl -s "$API_BASE/performance/stats" | jq '{
    queries,
    cacheHits,
    cacheMisses,
    cacheHitRatio,
    pool
}'

echo ""
echo "✅ Performance Test Complete!"