CREATE TABLE IF NOT EXISTS public.coin_signals (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol      text        NOT NULL,
  exchange    text        NOT NULL DEFAULT 'binance' CHECK (exchange IN ('binance', 'coinbase', 'upbit')),
  signal_type text        NOT NULL CHECK (signal_type IN ('BUY', 'SELL', 'NEUTRAL')),
  watch       text        CHECK (watch IN ('WATCH_BUY', 'WATCH_SELL')),
  confidence  integer     NOT NULL,
  timestamp   bigint      NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS coin_signals_dedup
  ON public.coin_signals (symbol, exchange, timestamp);

-- TTL cleanup: optional pg_cron job to delete rows older than 24h
-- Not required at launch — table stays small (max ~9 rows active per exchange)

ALTER TABLE public.coin_signals ENABLE ROW LEVEL SECURITY;
-- No client-side access policies. Server bypasses RLS via service role key.
