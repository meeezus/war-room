-- Add cost_estimate to missions for budget enforcement
-- The poller's daily budget check queries this column
ALTER TABLE missions ADD COLUMN IF NOT EXISTS cost_estimate NUMERIC DEFAULT 0;
