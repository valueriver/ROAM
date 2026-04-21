CREATE TABLE IF NOT EXISTS devices (
  device_id    TEXT PRIMARY KEY,
  slug         TEXT UNIQUE NOT NULL,
  token_hash   TEXT UNIQUE NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_devices_slug ON devices (slug);
CREATE INDEX IF NOT EXISTS idx_devices_token_hash ON devices (token_hash);
