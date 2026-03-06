-- cap_gates: daily token budget caps for the Shogunate engine
-- One row per named gate. The global gate (name = 'global') applies engine-wide.
CREATE TABLE IF NOT EXISTS cap_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  daily_budget_usd NUMERIC NOT NULL DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed: global daily budget gate ($50/day default, adjust as needed)
INSERT INTO cap_gates (name, daily_budget_usd, is_active)
VALUES ('global', 50, true)
ON CONFLICT (name) DO NOTHING;

-- RLS: service role manages, anon reads
ALTER TABLE cap_gates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read" ON cap_gates FOR SELECT USING (true);
CREATE POLICY "service_role_all" ON cap_gates FOR ALL USING (auth.role() = 'service_role');
