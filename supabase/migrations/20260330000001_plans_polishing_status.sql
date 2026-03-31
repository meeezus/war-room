-- Add 'polishing' to plans status constraint (flywheel v2 bead polish phase)
ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_status_check;
ALTER TABLE plans ADD CONSTRAINT plans_status_check
  CHECK (status IN ('draft', 'brainstorming', 'analyzing', 'polishing', 'reviewing', 'approved', 'running', 'completed', 'failed'));
