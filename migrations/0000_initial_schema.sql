-- Campaign table
CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  namespace TEXT NOT NULL,
  name TEXT NOT NULL,
  redirect_url TEXT,
  start_date INTEGER,
  end_date INTEGER,
  status TEXT CHECK(status IN ('active', 'paused', 'archived')) DEFAULT 'paused',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Zone table (ad placement)
CREATE TABLE IF NOT EXISTS zones (
  id TEXT PRIMARY KEY,            -- UUIDv7
  namespace TEXT NOT NULL,
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
  namespace TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Insert default targeting rule types
INSERT INTO targeting_rule_types (name, description)
VALUES 
  ('geo', 'Target by country'),
  ('device_type', 'Target by device: desktop, mobile, tablet'),
  ('capping', 'Limit impressions per user'),
  ('zone_id', 'Target specific ad placement zones');

-- Targeting rules
CREATE TABLE IF NOT EXISTS targeting_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  namespace TEXT NOT NULL,
  campaign_id INTEGER NOT NULL,
  targeting_rule_type_id INTEGER NOT NULL,
  targeting_method TEXT CHECK(targeting_method IN ('whitelist', 'blacklist')) NOT NULL,
  rule TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (targeting_rule_type_id) REFERENCES targeting_rule_types(id)
);

-- Unified ad events table
CREATE TABLE IF NOT EXISTS ad_events (
  id BIGINT PRIMARY KEY,                        -- Snowflake ID
  namespace TEXT NOT NULL,
  sub_id TEXT,                                  -- Additional identifier
  event_type TEXT NOT NULL,                     -- 'impression', 'click', 'conversion', etc.
  event_time INTEGER NOT NULL DEFAULT (unixepoch()), -- Unix timestamp
  campaign_id INTEGER,
  zone_id INTEGER NOT NULL,
  ip TEXT,
  user_agent TEXT,
  referer TEXT,
  country TEXT,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_dates ON campaigns(start_date, end_date);
CREATE INDEX idx_zones_status ON zones(status);
CREATE INDEX idx_targeting_rules_campaign ON targeting_rules(campaign_id);
CREATE INDEX idx_targeting_rules_type ON targeting_rules(targeting_rule_type_id);

-- Updated indexes for ad_events
CREATE INDEX idx_ad_events_campaign ON ad_events(campaign_id);
CREATE INDEX idx_ad_events_zone ON ad_events(zone_id);
CREATE INDEX idx_ad_events_time ON ad_events(event_time);
CREATE INDEX idx_ad_events_type ON ad_events(event_type);
CREATE INDEX idx_ad_events_country ON ad_events(country);
CREATE INDEX idx_ad_events_device ON ad_events(device_type);
CREATE INDEX idx_ad_events_sub_id ON ad_events(sub_id);