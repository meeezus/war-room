-- Link tasks to their originating proposals
ALTER TABLE tasks ADD COLUMN proposal_id UUID REFERENCES proposals(id);
CREATE INDEX idx_tasks_proposal_id ON tasks(proposal_id);
