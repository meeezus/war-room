-- Link proposals to projects so they can be filtered per-project
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES projects(id);
