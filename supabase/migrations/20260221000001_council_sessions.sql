CREATE TABLE council_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  council_type TEXT DEFAULT 'full',
  reviews JSONB NOT NULL DEFAULT '[]'::jsonb,
  synthesis TEXT,
  recommendation TEXT,
  dissent TEXT,
  source TEXT DEFAULT 'claude_code',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_council_sessions_created ON council_sessions (created_at DESC);
