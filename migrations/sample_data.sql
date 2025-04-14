-- Insert a zone
INSERT INTO zones (name, site_url, traffic_back_url, status)
VALUES (
  'Homepage Banner',
  'https://example.com', 
  'https://example.com/fallback',
  'active'
);

-- Insert a campaign
INSERT INTO campaigns (name, redirect_url, start_date, end_date, status)
VALUES (
  'Summer Sale Campaign',
  'https://example.com/summer-sale',
  unixepoch(), -- starts now
  unixepoch() + 2592000, -- ends in 30 days
  'active'
);

-- Get the targeting rule type for zone targeting
INSERT INTO targeting_rules (campaign_id, targeting_rule_type_id, targeting_method, rule, weight)
VALUES (
  1, -- First campaign ID
  4, -- Fourth rule type (Zone ID)
  'whitelist',
  '1', -- First zone ID
  100
); 