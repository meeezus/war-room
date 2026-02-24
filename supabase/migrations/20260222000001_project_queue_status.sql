-- Add 'queue' to project status constraint to match app types
-- App expects: inprogress | queue | done | onhold
-- DB had: inprogress | todo | done | someday | onhold
-- New: superset of both

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('inprogress', 'queue', 'done', 'onhold', 'todo', 'someday'));
