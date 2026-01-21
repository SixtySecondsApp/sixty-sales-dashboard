#!/bin/bash
# Test script to verify Cursor cache clearing

echo "=================================="
echo "Cursor Cache Clear Test"
echo "=================================="

# Check for Cursor cache directories
echo ""
echo "→ Checking Cursor cache directories:"

cursor_cache_dirs=(
    "$HOME/.cursor/cache"
    "$HOME/.cursor/.cursor-agent"
    "$HOME/.cursor/sessions"
    "$HOME/.local/share/cursor-agent/sessions"
)

for cache_dir in "${cursor_cache_dirs[@]}"; do
    if [ -d "$cache_dir" ] || [ -L "$cache_dir" ]; then
        echo "  ✓ Found: $cache_dir"
        du -sh "$cache_dir" 2>/dev/null || echo "    Size: (unable to determine)"
    else
        echo "  ✗ Not found: $cache_dir"
    fi
done

# Check for temp files
echo ""
echo "→ Checking temporary files:"
temp_count=$(find /tmp -maxdepth 1 -name "cursor-*" -o -name "tmp.*" 2>/dev/null | wc -l)
echo "  Found $temp_count temporary files in /tmp"

# Test clearing
echo ""
read -p "Do you want to clear all Cursor cache? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "→ Clearing Cursor cache..."
    
    for cache_dir in "${cursor_cache_dirs[@]}"; do
        if [ -d "$cache_dir" ] || [ -L "$cache_dir" ]; then
            echo "  Removing: $cache_dir"
            rm -rf "$cache_dir" 2>/dev/null || echo "    Failed to remove (may need sudo)"
        fi
    done
    
    echo "  Removing temp files..."
    rm -rf /tmp/cursor-* 2>/dev/null
    rm -rf /tmp/tmp.* 2>/dev/null
    
    echo ""
    echo "✓ Cache cleared successfully"
else
    echo ""
    echo "Skipped cache clearing"
fi

echo ""
echo "=================================="
echo "Test Complete"
echo "=================================="

