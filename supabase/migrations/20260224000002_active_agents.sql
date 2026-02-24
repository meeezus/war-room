CREATE TABLE active_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type text NOT NULL,
  task_summary text,
  progress int DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  mission_id uuid REFERENCES missions(id),
  started_at timestamptz DEFAULT now(),
  status text DEFAULT 'running' CHECK (status IN ('running', 'idle', 'completed', 'failed'))
);

CREATE INDEX idx_active_agents_status ON active_agents(status);

ALTER PUBLICATION supabase_realtime ADD TABLE active_agents;
