CREATE TABLE IF NOT EXISTS strategy_monitor_state (
  key TEXT PRIMARY KEY,
  value_json TEXT,
  updated_at TEXT
);
