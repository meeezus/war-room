-- RPG Foundation: Agent Memory + Daimyo Relationships
-- Agent memory for personality evolution (inspired by VoxYZ ops_agent_memory)
-- Pairwise daimyo relationships for affinity matrix

-- ============================================================
-- 1. Agent Memory table
-- ============================================================

create table if not exists agent_memory (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null references agent_status(id),
  memory_type text not null check (memory_type in ('insight', 'pattern', 'strategy', 'preference', 'lesson')),
  content text not null,
  tags text[] default '{}',
  confidence numeric(3,2) default 0.5 check (confidence between 0 and 1),
  source_mission_id uuid references missions(id),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- 2. Daimyo Relationships table
-- ============================================================

create table if not exists agent_relationships (
  id uuid primary key default gen_random_uuid(),
  agent_a text not null references agent_status(id),
  agent_b text not null references agent_status(id),
  affinity numeric(3,2) not null default 0.5 check (affinity between 0.10 and 0.95),
  drift_history jsonb default '[]',
  updated_at timestamptz not null default now(),
  unique(agent_a, agent_b)
);

-- ============================================================
-- 3. RLS policies (match existing anon_read pattern)
-- ============================================================

alter table agent_memory enable row level security;
alter table agent_relationships enable row level security;
create policy "anon_read_memory" on agent_memory for select using (true);
create policy "anon_read_relationships" on agent_relationships for select using (true);

-- ============================================================
-- 4. Indexes
-- ============================================================

create index idx_agent_memory_agent on agent_memory(agent_id);
create index idx_agent_memory_mission on agent_memory(source_mission_id);
create index idx_agent_relationships_agents on agent_relationships(agent_a, agent_b);

-- ============================================================
-- 5. Seed pairwise daimyo relationships (15 pairs, 6 agents)
-- ============================================================

INSERT INTO agent_relationships (agent_a, agent_b, affinity) VALUES
  ('pip', 'ed', 0.85),
  ('pip', 'light', 0.80),
  ('pip', 'toji', 0.65),
  ('pip', 'power', 0.60),
  ('pip', 'major', 0.75),
  ('ed', 'light', 0.65),
  ('ed', 'toji', 0.40),
  ('ed', 'power', 0.35),
  ('ed', 'major', 0.70),
  ('light', 'toji', 0.75),
  ('light', 'power', 0.60),
  ('light', 'major', 0.55),
  ('toji', 'power', 0.80),
  ('toji', 'major', 0.50),
  ('power', 'major', 0.45);
