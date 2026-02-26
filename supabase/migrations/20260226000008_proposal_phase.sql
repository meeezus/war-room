-- Add phase tracking to proposals for the Daimyo Pipeline
-- Phases: scope → research → brd → prd → trd → build → review → ship
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS phase text DEFAULT 'scope';
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS phase_artifacts jsonb DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_proposals_phase ON proposals (phase);
