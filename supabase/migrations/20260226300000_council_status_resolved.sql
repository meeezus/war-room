-- Allow 'resolved' status on council_sessions (previously only active/archived)
ALTER TABLE council_sessions DROP CONSTRAINT IF EXISTS council_sessions_status_check;
ALTER TABLE council_sessions ADD CONSTRAINT council_sessions_status_check
  CHECK (status IN ('active', 'resolved', 'archived'));
