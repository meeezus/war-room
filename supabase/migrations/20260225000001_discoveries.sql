CREATE TABLE discoveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT DEFAULT 'info',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  repo TEXT,
  file_path TEXT,
  evidence TEXT,
  suggested_action TEXT,
  status TEXT DEFAULT 'pending',
  feedback TEXT,
  proposal_id UUID REFERENCES proposals(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_discoveries_status ON discoveries(status);
CREATE INDEX idx_discoveries_agent ON discoveries(agent_id);
