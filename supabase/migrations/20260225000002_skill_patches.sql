CREATE TABLE skill_patches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  mission_id UUID REFERENCES missions(id),
  patch_type TEXT NOT NULL,
  content TEXT NOT NULL,
  content_embedding VECTOR(1024),
  confidence FLOAT DEFAULT 0.5,
  confirmation_count INT DEFAULT 1,
  applied BOOLEAN DEFAULT false,
  sunset_at TIMESTAMPTZ DEFAULT (now() + interval '90 days'),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_skill_patches_agent ON skill_patches(agent_id);
CREATE INDEX idx_skill_patches_applied ON skill_patches(applied);
