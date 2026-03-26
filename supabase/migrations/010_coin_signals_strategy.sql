-- Add strategy column to coin_signals and update unique index to allow both strategies
-- per candle (same symbol+exchange+timestamp can have two entries: one per strategy)

ALTER TABLE coin_signals
  ADD COLUMN strategy TEXT NOT NULL DEFAULT 'breakout';

-- Drop old unique index that didn't include strategy
DROP INDEX IF EXISTS coin_signals_dedup;

-- Recreate with strategy included
CREATE UNIQUE INDEX coin_signals_dedup
  ON coin_signals (symbol, exchange, timestamp, strategy);
