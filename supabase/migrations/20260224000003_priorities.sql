-- Add priority field (1-4) to missions and tasks with CHECK constraint
-- P1 = highest, P4 = lowest (default)

-- Add priority to missions (new column)
ALTER TABLE missions
  ADD COLUMN priority int DEFAULT 3
  CHECK (priority >= 1 AND priority <= 4);

-- Add CHECK constraint to existing tasks priority column
-- First drop any existing data that would violate the constraint
UPDATE tasks SET priority = 3 WHERE priority IS NULL OR priority < 1 OR priority > 4;

-- Add the constraint
ALTER TABLE tasks
  ADD CONSTRAINT tasks_priority_check CHECK (priority >= 1 AND priority <= 4);

-- Set a default for tasks going forward
ALTER TABLE tasks ALTER COLUMN priority SET DEFAULT 3;

-- Indexes for sort performance
CREATE INDEX idx_missions_priority ON missions(priority);
CREATE INDEX idx_tasks_priority ON tasks(priority);
