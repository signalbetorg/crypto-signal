ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_exchange_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_exchange_check
  CHECK (exchange IN ('binance', 'coinbase', 'upbit', 'bybit'));
