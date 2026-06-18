ALTER TABLE strategy_stats ADD COLUMN max_activated_levels INTEGER;
ALTER TABLE strategy_stats ADD COLUMN avg_used_capital_pct REAL;
ALTER TABLE strategy_stats ADD COLUMN best_result_pct REAL;
ALTER TABLE strategy_stats ADD COLUMN worst_drawdown_pct REAL;
