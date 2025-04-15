#!/bin/bash

# seed_example_data.sh - Script to seed example data for development
# Creates a zone, campaign, and targeting rules for testing

# Print banner
echo "========================================"
echo "     Lite Ad Server Data Seeder        "
echo "========================================"
echo

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "Error: wrangler is not installed"
    echo "Please install it with: npm install -g wrangler"
    exit 1
fi

# Create a temp file for the check
CHECK_SQL_FILE=$(mktemp)
cat > "$CHECK_SQL_FILE" << 'EOF'
SELECT name FROM sqlite_master WHERE type='table';
EOF

# Run the check and capture output to a file
RESULT_FILE=$(mktemp)
wrangler d1 execute lite_adserver_db --local --file="$CHECK_SQL_FILE" > "$RESULT_FILE" 2>&1
CHECK_EXIT_CODE=$?

# Clean up SQL file
rm "$CHECK_SQL_FILE"

# Check if the command was successful
if [ $CHECK_EXIT_CODE -ne 0 ]; then
    echo "Error: Could not access the database."
    echo "Error details:"
    cat "$RESULT_FILE"
    rm "$RESULT_FILE"
    echo
    echo "Please run: ./dev_scripts/init_db.sh to initialize the database."
    exit 1
fi

# Count the number of tables in the result
TABLES=$(grep -o "│ [a-zA-Z0-9_]* │" "$RESULT_FILE" | wc -l)
rm "$RESULT_FILE"

# Database check is commented out to allow the script to run even if tables are missing
# This allows the script to be run on a fresh database to set up initial data
echo "Database has $TABLES tables."
echo

echo "This script will create example data for development:"
echo "- 2 Zones (publisher placements)"
echo "- 2 Campaigns with targeting rules"
echo

# Confirm with user
read -p "Do you want to proceed with seeding example data? (y/n): " CONFIRM
if [[ $CONFIRM != "y" && $CONFIRM != "Y" ]]; then
    echo "Operation cancelled"
    exit 0
fi

# Delete any existing data first
CLEANUP_SQL=$(mktemp)
cat > "$CLEANUP_SQL" << 'EOF'
-- Delete any existing data to avoid conflicts
DELETE FROM targeting_rules;
DELETE FROM campaigns;
DELETE FROM zones;

-- Reset the auto-increment counters
DELETE FROM sqlite_sequence WHERE name IN ('campaigns', 'zones', 'targeting_rules');
EOF

echo "Cleaning up existing data..."
wrangler d1 execute lite_adserver_db --local --file="$CLEANUP_SQL"
rm "$CLEANUP_SQL"

# Create zones first
ZONES_SQL=$(mktemp)
cat > "$ZONES_SQL" << 'EOF'
-- First ensure we have targeting rule types
INSERT OR IGNORE INTO targeting_rule_types (id, name, description, created_at)
VALUES 
  (1, 'geo', 'Target by country', unixepoch()),
  (2, 'device_type', 'Target by device: desktop, mobile, tablet', unixepoch()),
  (3, 'capping', 'Limit impressions per user', unixepoch()),
  (4, 'zone_id', 'Target specific ad placement zones', unixepoch());

-- Create first example zone
INSERT INTO zones (id, name, site_url, traffic_back_url, status, created_at, updated_at) 
VALUES (1, 'Example Zone - Sports', 'https://example.com/sports', 'https://example.com/sports/fallback', 'active', unixepoch(), unixepoch());

-- Create second example zone
INSERT INTO zones (id, name, site_url, traffic_back_url, status, created_at, updated_at) 
VALUES (2, 'Example Zone - News', 'https://example.com/news', 'https://example.com/news/fallback', 'active', unixepoch(), unixepoch());

-- Display created zones
SELECT 'Zones created:' as message;
SELECT id, name, site_url, traffic_back_url FROM zones WHERE id IN (1, 2);
EOF

echo "Creating zones..."
wrangler d1 execute lite_adserver_db --local --file="$ZONES_SQL"
rm "$ZONES_SQL"

# Create the sports campaign
SPORTS_CAMPAIGN_SQL=$(mktemp)
cat > "$SPORTS_CAMPAIGN_SQL" << 'EOF'
-- Create Sports campaign
INSERT INTO campaigns (id, name, redirect_url, status, created_at, updated_at) 
VALUES (1, 'Sports Promotion Campaign', 'https://advertiser.example.com/sports-promo', 'active', unixepoch(), unixepoch());

SELECT id, name FROM campaigns WHERE id = 1;
EOF

echo "Creating Sports campaign..."
wrangler d1 execute lite_adserver_db --local --file="$SPORTS_CAMPAIGN_SQL"
rm "$SPORTS_CAMPAIGN_SQL"

# Create the news campaign
NEWS_CAMPAIGN_SQL=$(mktemp)
cat > "$NEWS_CAMPAIGN_SQL" << 'EOF'
-- Create News campaign
INSERT INTO campaigns (id, name, redirect_url, status, created_at, updated_at) 
VALUES (2, 'News Product Campaign', 'https://advertiser.example.com/news-product', 'active', unixepoch(), unixepoch());

SELECT id, name FROM campaigns WHERE id = 2;
EOF

echo "Creating News campaign..."
wrangler d1 execute lite_adserver_db --local --file="$NEWS_CAMPAIGN_SQL"
rm "$NEWS_CAMPAIGN_SQL"

# Use fixed IDs since we explicitly set them in the INSERT statements
SPORTS_CAMPAIGN_ID=1
NEWS_CAMPAIGN_ID=2

echo "Using Sports campaign ID: $SPORTS_CAMPAIGN_ID"
echo "Using News campaign ID: $NEWS_CAMPAIGN_ID"

# Create targeting rules for both campaigns in a single file
RULES_SQL=$(mktemp)
cat > "$RULES_SQL" << EOF
-- Add zone targeting for sports campaign
INSERT INTO targeting_rules (campaign_id, targeting_rule_type_id, targeting_method, rule, created_at, updated_at)
VALUES ($SPORTS_CAMPAIGN_ID, 4, 'whitelist', '1', unixepoch(), unixepoch());

-- Add geo targeting for sports campaign (US and Canada)
INSERT INTO targeting_rules (campaign_id, targeting_rule_type_id, targeting_method, rule, created_at, updated_at)
VALUES ($SPORTS_CAMPAIGN_ID, 1, 'whitelist', 'US,CA', unixepoch(), unixepoch());

-- Add zone targeting for news campaign
INSERT INTO targeting_rules (campaign_id, targeting_rule_type_id, targeting_method, rule, created_at, updated_at)
VALUES ($NEWS_CAMPAIGN_ID, 4, 'whitelist', '2', unixepoch(), unixepoch());

-- Add device targeting for news campaign (desktop only)
INSERT INTO targeting_rules (campaign_id, targeting_rule_type_id, targeting_method, rule, created_at, updated_at)
VALUES ($NEWS_CAMPAIGN_ID, 2, 'whitelist', 'desktop', unixepoch(), unixepoch());
EOF

echo "Creating targeting rules..."
wrangler d1 execute lite_adserver_db --local --file="$RULES_SQL"
rm "$RULES_SQL"

# Display summary of created data
SUMMARY_SQL=$(mktemp)
cat > "$SUMMARY_SQL" << EOF
-- Display summary of all created data
SELECT 'Campaigns:' as message;
SELECT id, name, redirect_url, status FROM campaigns 
WHERE id IN ($SPORTS_CAMPAIGN_ID, $NEWS_CAMPAIGN_ID);

SELECT 'Targeting Rules:' as message;
SELECT 
  c.name as campaign_name,
  trt.name as targeting_type,
  tr.targeting_method,
  tr.rule as target_value
FROM targeting_rules tr
JOIN campaigns c ON tr.campaign_id = c.id
JOIN targeting_rule_types trt ON tr.targeting_rule_type_id = trt.id
WHERE c.id IN ($SPORTS_CAMPAIGN_ID, $NEWS_CAMPAIGN_ID)
ORDER BY c.name, trt.name;
EOF

echo "Displaying created data..."
wrangler d1 execute lite_adserver_db --local --file="$SUMMARY_SQL"
rm "$SUMMARY_SQL"

echo
echo "Data seeding completed successfully!"
echo
echo "You can test the ad server by visiting:"
echo "- http://localhost:8787/serve/1 (Sports Zone)"
echo "- http://localhost:8787/serve/2 (News Zone)"
echo
echo "==========================================" 