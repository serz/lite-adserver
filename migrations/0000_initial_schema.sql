-- Campaign table
CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  redirect_url TEXT,
  start_date INTEGER NOT NULL,
  end_date INTEGER,
  status TEXT CHECK(status IN ('active', 'paused', 'archived')) DEFAULT 'paused',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Zone table (ad placement)
CREATE TABLE IF NOT EXISTS zones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  site_url TEXT,
  traffic_back_url TEXT,
  status TEXT CHECK(status IN ('active', 'inactive')) DEFAULT 'active',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Targeting rule types
CREATE TABLE IF NOT EXISTS targeting_rule_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Insert default targeting rule types
INSERT INTO targeting_rule_types (name, description)
VALUES 
  ('Geographic Location', 'Target by country, region, or city'),
  ('Device Type', 'Target by device: desktop, mobile, tablet'),
  ('Frequency Capping', 'Limit impressions per user'),
  ('Zone ID', 'Target specific ad placement zones');

-- Targeting rules
CREATE TABLE IF NOT EXISTS targeting_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  targeting_rule_type_id INTEGER NOT NULL,
  targeting_method TEXT CHECK(targeting_method IN ('whitelist', 'blacklist')) NOT NULL,
  rule TEXT NOT NULL,
  weight INTEGER DEFAULT 100,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (targeting_rule_type_id) REFERENCES targeting_rule_types(id)
);

-- Raw click tracking data
CREATE TABLE IF NOT EXISTS clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  zone_id INTEGER NOT NULL,
  ip TEXT,
  user_agent TEXT,
  referer TEXT,
  country TEXT,
  device_type TEXT,
  timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_dates ON campaigns(start_date, end_date);
CREATE INDEX idx_zones_status ON zones(status);
CREATE INDEX idx_targeting_rules_campaign ON targeting_rules(campaign_id);
CREATE INDEX idx_targeting_rules_type ON targeting_rules(targeting_rule_type_id);
CREATE INDEX idx_clicks_campaign ON clicks(campaign_id);
CREATE INDEX idx_clicks_zone ON clicks(zone_id);
CREATE INDEX idx_clicks_timestamp ON clicks(timestamp);
CREATE INDEX idx_clicks_country ON clicks(country); 