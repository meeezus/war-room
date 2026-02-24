ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_date timestamptz;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS council_session_id uuid REFERENCES council_sessions(id);
ALTER TABLE council_sessions ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id);
