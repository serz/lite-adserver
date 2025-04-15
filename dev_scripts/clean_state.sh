#!/bin/bash

# clean_state.sh - Script to remove development state files from the .wrangler directory
# This will reset the local development database and state

# Print banner
echo "====================================="
echo "     Lite Ad Server State Cleaner    "
echo "====================================="
echo

# Check if .wrangler directory exists
if [ ! -d ".wrangler" ]; then
    echo "Error: .wrangler directory not found"
    echo "Make sure you're running this script from the lite-adserver root directory"
    exit 1
fi

# Count state files before deletion
WRANGLER_COUNT=$(find .wrangler -type f | wc -l)
DB_FOLDER_COUNT=0

# Check if D1 database files exist
if [ -d ".wrangler/state/v3/d1" ]; then
    DB_FOLDER_COUNT=$(find .wrangler/state/v3/d1 -type f | wc -l)
    echo "Found $DB_FOLDER_COUNT database files in .wrangler/state/v3/d1 directory"
fi

echo "Found $WRANGLER_COUNT total files in .wrangler directory"
echo

# Confirm with user
read -p "Are you sure you want to reset all local development state? This cannot be undone. (y/n): " CONFIRM
if [[ $CONFIRM != "y" && $CONFIRM != "Y" ]]; then
    echo "Operation cancelled"
    exit 0
fi

# Remove state directories but preserve structure
echo "Removing wrangler state files..."

# Remove D1 database files
if [ -d ".wrangler/state/v3/d1" ]; then
    echo "Cleaning D1 database state..."
    rm -rf .wrangler/state/v3/d1/*
    mkdir -p .wrangler/state/v3/d1
fi

# Remove KV namespace files
if [ -d ".wrangler/state/v3/kv" ]; then
    echo "Cleaning KV namespace state..."
    rm -rf .wrangler/state/v3/kv/*
    mkdir -p .wrangler/state/v3/kv
fi

# Remove Cache namespace files
if [ -d ".wrangler/state/v3/cache" ]; then
    echo "Cleaning Cache namespace state..."
    rm -rf .wrangler/state/v3/cache/*
    mkdir -p .wrangler/state/v3/cache
fi

# Remove Durable Object namespace files
if [ -d ".wrangler/state/v3/objects" ]; then
    echo "Cleaning Durable Objects state..."
    rm -rf .wrangler/state/v3/objects/*
    mkdir -p .wrangler/state/v3/objects
fi

# Count remaining files after cleanup
REMAINING_COUNT=$(find .wrangler -type f | wc -l)
REMOVED_COUNT=$((WRANGLER_COUNT - REMAINING_COUNT))

echo
echo "Cleanup completed successfully!"
echo "- Wrangler state cleaned: $REMOVED_COUNT files removed"
if [ -d ".wrangler/state/v3/d1" ]; then
    echo "- D1 database state reset: $DB_FOLDER_COUNT files removed"
fi
echo
echo "====================================="
echo "You can now run 'wrangler dev' to start with a fresh state"
echo "=====================================" 