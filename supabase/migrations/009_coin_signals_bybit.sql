ALTER TABLE public.coin_signals
  DROP CONSTRAINT IF EXISTS coin_signals_exchange_check;
ALTER TABLE public.coin_signals
  ADD CONSTRAINT coin_signals_exchange_check
  CHECK (exchange IN ('binance', 'coinbase', 'upbit', 'bybit'));
