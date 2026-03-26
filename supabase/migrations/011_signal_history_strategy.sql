-- Add strategy column to signal_history for user-visible strategy attribution

ALTER TABLE signal_history
  ADD COLUMN strategy TEXT NOT NULL DEFAULT 'breakout';
