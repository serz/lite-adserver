#!/bin/bash

# init_db.sh - Script to initialize the local development database
# Starts wrangler dev to initialize the D1 database, then runs migrations

# Print banner
echo "========================================"
echo "     Lite Ad Server DB Initializer     "
echo "========================================"
echo

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "Error: wrangler is not installed"
    echo "Please install it with: npm install -g wrangler"
    exit 1
fi

echo "This script will:"
echo "1. Start wrangler dev for a few seconds to initialize databases"
echo "2. Run the database migrations to create the schema"
echo "3. Exit when complete"
echo

# Function to check if a process is running
is_running() {
    ps -p $1 >/dev/null 2>&1
}

# Confirm with user
read -p "Do you want to proceed? (y/n): " CONFIRM
if [[ $CONFIRM != "y" && $CONFIRM != "Y" ]]; then
    echo "Operation cancelled"
    exit 0
fi

echo "Starting wrangler dev to initialize D1 database..."
# Start wrangler dev in the background
wrangler dev &
WRANGLER_PID=$!

# Wait a moment for wrangler to start
sleep 3

# Check if wrangler is still running
if ! is_running $WRANGLER_PID; then
    echo "Error: Wrangler failed to start"
    exit 1
fi

echo "Wrangler is running (PID: $WRANGLER_PID)"
echo "Waiting 5 seconds for the database to initialize..."
sleep 5

# Run migrations
echo "Running database migrations..."
wrangler d1 execute lite_adserver_db --local --file="migrations/0000_initial_schema.sql"
MIGRATION_RESULT=$?

# Stop wrangler dev
echo "Stopping wrangler..."
kill $WRANGLER_PID

# Wait for process to terminate
wait $WRANGLER_PID 2>/dev/null

# Check if migration was successful
if [ $MIGRATION_RESULT -ne 0 ]; then
    echo "Migration failed. Please check the error and try again."
    exit 1
fi

echo
echo "Database initialization completed successfully!"
echo
echo "You can now run the following commands:"
echo "- ./dev_scripts/seed_example_data.sh (to add test data)"
echo "- wrangler dev (to start the development server)"
echo
echo "==========================================" 