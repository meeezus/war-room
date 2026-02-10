-- Dynasty Dashboard v2 Schema Extension
-- Adds projects, boards, tasks tables + project_id FK on existing tables

-- Projects table
create table projects (
  id text primary key,
  title text not null,
  status text not null default 'active'
    check (status in ('inprogress', 'todo', 'done', 'someday', 'onhold')),
  priority int default 0,
  goal text,
  type text,
  owner text,
  notes text,
  next_action text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Boards table
create table boards (
  id text primary key,
  project_id text references projects(id),
  title text not null,
  description text,
  board_type text default 'board'
    check (board_type in ('board', 'epic')),
  created_at timestamptz default now()
);

-- Tasks table
create table tasks (
  id serial primary key,
  board_id text references boards(id),
  project_id text references projects(id),
  title text not null,
  status text not null default 'todo'
    check (status in ('active', 'todo', 'done', 'someday', 'blocked')),
  priority int,
  goal text,
  type text,
  owner text,
  notes text,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add project_id FK to existing tables
alter table proposals add column project_id text references projects(id);
alter table missions add column project_id text references projects(id);

-- Indexes
create index idx_projects_status on projects(status);
create index idx_projects_priority on projects(priority);
create index idx_boards_project on boards(project_id);
create index idx_tasks_board on tasks(board_id);
create index idx_tasks_project on tasks(project_id);
create index idx_tasks_status on tasks(status);
create index idx_missions_project on missions(project_id);
create index idx_proposals_project on proposals(project_id);

-- RLS (matching existing anon-read pattern)
alter table projects enable row level security;
alter table boards enable row level security;
alter table tasks enable row level security;
create policy "anon_read" on projects for select using (true);
create policy "anon_read" on boards for select using (true);
create policy "anon_read" on tasks for select using (true);
create policy "service_role_all" on projects for all using (auth.role() = 'service_role');
create policy "service_role_all" on boards for all using (auth.role() = 'service_role');
create policy "service_role_all" on tasks for all using (auth.role() = 'service_role');

-- Realtime publication
alter publication supabase_realtime add table projects;
alter publication supabase_realtime add table boards;
alter publication supabase_realtime add table tasks;
