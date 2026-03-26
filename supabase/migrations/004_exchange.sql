ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS exchange TEXT NOT NULL DEFAULT 'binance'
    CHECK (exchange IN ('binance', 'coinbase', 'upbit'));
