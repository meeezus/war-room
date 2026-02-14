-- Add execution columns to tasks table (unify with engine steps)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS mission_id uuid REFERENCES missions(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS kind text CHECK (kind IN ('research','code','review','test','deploy','write','analyze'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS daimyo text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS output text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS error text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS timeout_minutes int DEFAULT 30;

-- Update status constraint to include 'queued' and 'failed'
-- Drop existing constraint and recreate with new values
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('todo', 'assigned', 'queued', 'in_progress', 'review', 'done', 'someday', 'blocked', 'failed'));

-- Indexes for poller queries
CREATE INDEX IF NOT EXISTS idx_tasks_mission_id ON tasks(mission_id);
CREATE INDEX IF NOT EXISTS idx_tasks_daimyo ON tasks(daimyo);
CREATE INDEX IF NOT EXISTS idx_tasks_status_mission ON tasks(status, mission_id) WHERE mission_id IS NOT NULL;
