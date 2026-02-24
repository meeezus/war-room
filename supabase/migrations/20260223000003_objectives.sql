-- Reflexive Execution: objectives table + FK columns on missions/proposals

-- Objectives table
CREATE TABLE IF NOT EXISTS objectives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    success_criteria TEXT NOT NULL,
    project_id TEXT REFERENCES projects(id),
    max_iterations INT NOT NULL DEFAULT 5,
    max_cost_usd REAL DEFAULT NULL,
    iteration_count INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'paused', 'completed', 'failed', 'capped')),
    created_by TEXT NOT NULL DEFAULT 'Sensei',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- FK columns on missions
ALTER TABLE missions ADD COLUMN IF NOT EXISTS objective_id UUID REFERENCES objectives(id);
ALTER TABLE missions ADD COLUMN IF NOT EXISTS evaluation_result JSONB;

-- FK columns on proposals
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS objective_id UUID REFERENCES objectives(id);
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS parent_mission_id UUID REFERENCES missions(id);

-- Partial index for efficient objective → mission lookups
CREATE INDEX IF NOT EXISTS idx_missions_objective ON missions(objective_id) WHERE objective_id IS NOT NULL;

-- RLS (matching existing anon-read + service_role pattern)
ALTER TABLE objectives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read" ON objectives FOR SELECT USING (true);
CREATE POLICY "service_role_all" ON objectives FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "anon_insert" ON objectives FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON objectives FOR UPDATE USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE objectives;
