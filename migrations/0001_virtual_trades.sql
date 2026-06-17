CREATE TABLE IF NOT EXISTS virtual_trades (
  id TEXT PRIMARY KEY, symbol TEXT, base_symbol TEXT, exchange TEXT, timeframe TEXT, direction TEXT, entry_mode REAL,
  range_json TEXT, levels_json TEXT, status TEXT, opened_at TEXT, updated_at TEXT, closed_at TEXT,
  entry_price REAL, average_price REAL, take_price REAL, current_price REAL, activated_levels INTEGER,
  used_capital_pct REAL, max_drawdown_pct REAL, current_pnl_pct REAL, result_pct REAL, result_on_full_capital_pct REAL
);
CREATE TABLE IF NOT EXISTS virtual_trade_events (
  id TEXT PRIMARY KEY, trade_id TEXT, event_type TEXT, event_time TEXT, price REAL, level_index INTEGER, payload_json TEXT
);
CREATE TABLE IF NOT EXISTS strategy_stats (
  key TEXT PRIMARY KEY, symbol TEXT, timeframe TEXT, entry_mode REAL, exchange TEXT,
  total_trades INTEGER, take_hits INTEGER, active_trades INTEGER, drawdown_trades INTEGER,
  avg_result_pct REAL, avg_drawdown_pct REAL, avg_time_to_take_minutes REAL, updated_at TEXT
);
