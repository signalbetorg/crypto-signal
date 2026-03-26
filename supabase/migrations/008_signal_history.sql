CREATE TABLE public.signal_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol        text NOT NULL,
  exchange      text NOT NULL,
  signal_type   text NOT NULL CHECK (signal_type IN ('BUY','SELL')),
  confidence    int NOT NULL,
  entry_price   numeric NOT NULL,
  target_price  numeric NOT NULL,
  stop_price    numeric NOT NULL,
  fired_at      timestamptz NOT NULL,
  expires_at    timestamptz NOT NULL,
  outcome       text CHECK (outcome IN ('WIN','LOSS','EXPIRED')),
  outcome_price numeric,
  resolved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, symbol, exchange, fired_at)
);

ALTER TABLE public.signal_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own history" ON public.signal_history
  FOR SELECT USING (auth.uid() = user_id);

-- service role key bypasses RLS for INSERT/UPDATE from Railway
CREATE INDEX signal_history_user_fired ON public.signal_history (user_id, fired_at DESC);
CREATE INDEX signal_history_unresolved ON public.signal_history (exchange, symbol, fired_at)
  WHERE outcome IS NULL;
