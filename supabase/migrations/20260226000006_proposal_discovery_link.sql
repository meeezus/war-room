-- Link proposals to discoveries (for auto-fix loop)
-- Allows tracking which proposal was created from which patrol discovery

ALTER TABLE proposals ADD COLUMN IF NOT EXISTS discovery_id UUID REFERENCES discoveries(id);
CREATE INDEX IF NOT EXISTS idx_proposals_discovery ON proposals(discovery_id) WHERE discovery_id IS NOT NULL;

-- Add 'escalated' to discoveries status (for cycle-breaker)
ALTER TABLE discoveries DROP CONSTRAINT IF EXISTS discoveries_status_check;
ALTER TABLE discoveries ADD CONSTRAINT discoveries_status_check
  CHECK (status IN ('pending', 'approved', 'dismissed', 'executed', 'escalated'));
