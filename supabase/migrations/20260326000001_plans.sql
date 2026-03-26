-- Plans table -- stores parsed plan documents for the Plan Runner
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  raw_markdown TEXT NOT NULL,
  parsed_beads JSONB DEFAULT '[]',
  analysis JSONB,  -- flywheel analysis results (pushback, alternatives, blind spots)
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'analyzing', 'reviewing', 'approved', 'running', 'completed', 'failed')),
  flywheel_score INT,
  score_breakdown JSONB,  -- { money: 1-3, blast_radius: 1-3, novelty: 1-3 }
  auto_run BOOLEAN DEFAULT false,
  wave_count INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status);
CREATE INDEX IF NOT EXISTS idx_plans_created ON plans(created_at DESC);

-- RLS
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to plans" ON plans
  FOR ALL USING (true) WITH CHECK (true);

-- Add plan_id and wave_index to missions
ALTER TABLE missions ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES plans(id);
ALTER TABLE missions ADD COLUMN IF NOT EXISTS wave_index INT;
CREATE INDEX IF NOT EXISTS idx_missions_plan ON missions(plan_id);

-- Add working_dir to tasks for multi-repo routing
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS working_dir TEXT;
