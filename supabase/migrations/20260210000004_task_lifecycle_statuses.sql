-- Migrate task statuses: rename 'active' to 'in_progress' for new lifecycle
-- New lifecycle: todo | assigned | in_progress | review | done | someday | blocked

-- Drop old constraint that only allows (active, todo, done, someday, blocked)
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

-- Migrate existing data
UPDATE tasks SET status = 'in_progress' WHERE status = 'active';

-- Add new constraint with full lifecycle
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('todo', 'assigned', 'in_progress', 'review', 'done', 'someday', 'blocked'));
