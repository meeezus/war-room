-- Project-Objective link: move FK from objectives.project_id to projects.objective_id
-- and fix proposals source constraint to include reflexive + awareness

-- 1. Add objective_id FK on projects (canonical direction)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS objective_id UUID REFERENCES objectives(id);

-- 2. Index for objective lookups (partial — only non-null)
CREATE INDEX IF NOT EXISTS idx_projects_objective ON projects(objective_id) WHERE objective_id IS NOT NULL;

-- 3. Deprecation comment on the old FK column
COMMENT ON COLUMN objectives.project_id IS 'DEPRECATED: Use projects.objective_id instead. Will be removed in future migration.';

-- 4. NULL out existing objectives.project_id values
UPDATE objectives SET project_id = NULL WHERE project_id IS NOT NULL;

-- 5. Fix proposals source constraint to include reflexive + awareness
ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_source_check;
ALTER TABLE proposals ADD CONSTRAINT proposals_source_check
  CHECK (source IN ('discord', 'cron', 'trigger', 'manual', 'patrol', 'awareness', 'reflexive'));
