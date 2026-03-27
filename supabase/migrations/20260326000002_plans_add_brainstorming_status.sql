-- Add brainstorming status to plans CHECK constraint
ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_status_check;
ALTER TABLE plans ADD CONSTRAINT plans_status_check CHECK (status IN ('draft', 'brainstorming', 'analyzing', 'reviewing', 'approved', 'running', 'completed', 'failed'));
