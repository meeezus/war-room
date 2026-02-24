-- Shoin Chat Database Schema (idempotent)

-- Drop chat-specific tables only (not war_room_events which pre-exists)
begin;
  drop table if exists chat_attachments cascade;
  drop table if exists chat_messages cascade;
  drop table if exists chat_threads cascade;
end;

-- Agent presence (real-time status) — may already exist
create table if not exists agent_presence (
  id text primary key,
  name text not null,
  avatar text,
  specialty text,
  status text check (status in ('online', 'busy', 'idle', 'offline')) default 'offline',
  last_seen timestamp with time zone default now(),
  current_task text,
  metadata jsonb default '{}',
  updated_at timestamp with time zone default now()
);

-- Chat threads
create table if not exists chat_threads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  agent_id text references agent_presence(id),
  user_id text not null default 'sensei',
  last_message text,
  last_message_at timestamp with time zone default now(),
  unread boolean default false,
  metadata jsonb default '{}',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Chat messages
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references chat_threads(id) on delete cascade,
  role text check (role in ('user', 'assistant', 'system')) not null,
  content text not null,
  agent_id text references agent_presence(id),
  user_id text,
  streaming boolean default false,
  streaming_complete boolean default true,
  metadata jsonb default '{}',
  created_at timestamp with time zone default now()
);

-- Attachments
create table if not exists chat_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references chat_messages(id) on delete cascade,
  type text check (type in ('image', 'code', 'file', 'voice')) not null,
  name text not null,
  content text,
  url text,
  size_bytes integer,
  metadata jsonb default '{}',
  created_at timestamp with time zone default now()
);

-- War Room events (if not already created)
create table if not exists war_room_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  agent_id text references agent_presence(id),
  title text not null,
  description text,
  metadata jsonb default '{}',
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table agent_presence enable row level security;
alter table chat_threads enable row level security;
alter table chat_messages enable row level security;
alter table chat_attachments enable row level security;
alter table war_room_events enable row level security;

-- RLS Policies (idempotent)
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'agent_presence' and policyname = 'Allow all') then
    create policy "Allow all" on agent_presence for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'chat_threads' and policyname = 'Allow all') then
    create policy "Allow all" on chat_threads for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'chat_messages' and policyname = 'Allow all') then
    create policy "Allow all" on chat_messages for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'chat_attachments' and policyname = 'Allow all') then
    create policy "Allow all" on chat_attachments for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'war_room_events' and policyname = 'Allow all') then
    create policy "Allow all" on war_room_events for all using (true) with check (true);
  end if;
end $$;

-- Realtime
alter publication supabase_realtime add table agent_presence;
alter publication supabase_realtime add table chat_messages;
alter publication supabase_realtime add table chat_threads;
-- war_room_events already in realtime publication

-- Indexes
create index if not exists idx_chat_messages_thread_id on chat_messages(thread_id);
create index if not exists idx_chat_messages_created_at on chat_messages(created_at);
create index if not exists idx_chat_threads_user_id on chat_threads(user_id);
create index if not exists idx_chat_threads_updated_at on chat_threads(updated_at desc);
create index if not exists idx_war_room_events_created_at on war_room_events(created_at desc);

-- Default agents
insert into agent_presence (id, name, avatar, specialty, status) values
  ('cc', 'Claude Code', '🤖', 'Engineering', 'online'),
  ('pip', 'Pip', '🐿️', 'Coordination', 'online'),
  ('ed', 'Ed', '⚔️', 'Engineering', 'offline'),
  ('light', 'Light', '💡', 'Product', 'offline'),
  ('toji', 'Toji', '🛡️', 'Commerce', 'offline'),
  ('power', 'Power', '⚡', 'Influence', 'offline'),
  ('major', 'Major', '🎯', 'Operations', 'offline')
on conflict (id) do nothing;

-- Default welcome thread
insert into chat_threads (title, agent_id, last_message, last_message_at)
select 'Welcome to Shoin', 'pip', 'Yo! I''m Pip — your coordination agent. What are we building today?', now()
where not exists (select 1 from chat_threads where title = 'Welcome to Shoin');

insert into chat_messages (thread_id, role, content, agent_id)
select t.id, 'assistant', 'Yo! I''m Pip — your coordination agent. What are we building today?', 'pip'
from chat_threads t
where t.title = 'Welcome to Shoin'
  and not exists (select 1 from chat_messages where thread_id = t.id);
