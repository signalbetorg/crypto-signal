ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free'
    CHECK (tier IN ('free', 'pro')),
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
