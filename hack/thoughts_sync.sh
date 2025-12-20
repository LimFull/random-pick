#!/usr/bin/env bash
set -euo pipefail

# Simple thoughts sync script for house-work-scheduler project
# This replaces the humanlayer thoughts sync functionality

echo "Syncing thoughts directory..."

# Create thoughts directory structure if it doesn't exist
mkdir -p thoughts/shared/research
mkdir -p thoughts/shared/plans
mkdir -p thoughts/shared/handoffs

# Create searchable directory with hard links for better search performance
if [ -d "thoughts" ]; then
    echo "Creating searchable links..."
    rm -rf thoughts/searchable 2>/dev/null || true
    mkdir -p thoughts/searchable
    
    # Create hard links for all markdown files
    find thoughts -name "*.md" -type f | while read -r file; do
        # Remove thoughts/ prefix and create directory structure
        relative_path="${file#thoughts/}"
        target_dir="thoughts/searchable/$(dirname "$relative_path")"
        mkdir -p "$target_dir"
        
        # Create hard link
        ln "$file" "thoughts/searchable/$relative_path" 2>/dev/null || true
    done
    
    echo "Thoughts sync completed successfully!"
    echo "Found $(find thoughts -name "*.md" | wc -l) markdown files"
else
    echo "No thoughts directory found. Creating basic structure..."
    mkdir -p thoughts/shared/{research,plans,handoffs}
    echo "Basic thoughts structure created."
fi
