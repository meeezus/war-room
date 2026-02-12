-- Shoin Chat Database Schema
-- Run this in Supabase SQL Editor

-- Enable Realtime for all tables
begin;
  -- Drop existing tables if recreating
  drop table if exists chat_attachments cascade;
  drop table if exists chat_messages cascade;
  drop table if exists chat_threads cascade;
  drop table if exists agent_presence cascade;
end;

-- Agent presence (real-time status)
create table agent_presence (
  id text primary key, -- agent_id: pip, ed, light, etc.
  name text not null,
  avatar text,
  specialty text,
  status text check (status in ('online', 'busy', 'idle', 'offline')) default 'offline',
  last_seen timestamp with time zone default now(),
  current_task text,
  metadata jsonb default '{}',
  updated_at timestamp with time zone default now()
);

-- Chat threads (conversations)
create table chat_threads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  agent_id text references agent_presence(id),
  user_id text not null default 'sensei', -- for multi-user support later
  last_message text,
  last_message_at timestamp with time zone default now(),
  unread boolean default false,
  metadata jsonb default '{}',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Chat messages
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references chat_threads(id) on delete cascade,
  role text check (role in ('user', 'assistant', 'system')) not null,
  content text not null,
  agent_id text references agent_presence(id),
  user_id text, -- for user messages
  streaming boolean default false, -- for streaming responses
  streaming_complete boolean default true,
  metadata jsonb default '{}',
  created_at timestamp with time zone default now()
);

-- Attachments
create table chat_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references chat_messages(id) on delete cascade,
  type text check (type in ('image', 'code', 'file', 'voice')) not null,
  name text not null,
  content text, -- for code snippets
  url text, -- for uploaded files
  size_bytes integer,
  metadata jsonb default '{}',
  created_at timestamp with time zone default now()
);

-- War Room events feed (bridge between War Room and Chat)
create table war_room_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null, -- 'mission.created', 'proposal.approved', 'agent.status', etc.
  agent_id text references agent_presence(id),
  title text not null,
  description text,
  metadata jsonb default '{}',
  created_at timestamp with time zone default now()
);

-- Enable Row Level Security
alter table agent_presence enable row level security;
alter table chat_threads enable row level security;
alter table chat_messages enable row level security;
alter table chat_attachments enable row level security;
alter table war_room_events enable row level security;

-- RLS Policies (open for now, restrict later)
create policy "Allow all" on agent_presence for all using (true) with check (true);
create policy "Allow all" on chat_threads for all using (true) with check (true);
create policy "Allow all" on chat_messages for all using (true) with check (true);
create policy "Allow all" on chat_attachments for all using (true) with check (true);
create policy "Allow all" on war_room_events for all using (true) with check (true);

-- Enable Realtime
alter publication supabase_realtime add table agent_presence;
alter publication supabase_realtime add table chat_messages;
alter publication supabase_realtime add table chat_threads;
alter publication supabase_realtime add table war_room_events;

-- Indexes for performance
create index idx_chat_messages_thread_id on chat_messages(thread_id);
create index idx_chat_messages_created_at on chat_messages(created_at);
create index idx_chat_threads_user_id on chat_threads(user_id);
create index idx_chat_threads_updated_at on chat_threads(updated_at desc);
create index idx_war_room_events_created_at on war_room_events(created_at desc);

-- Insert default Daimyo agents
insert into agent_presence (id, name, avatar, specialty, status) values
  ('cc', 'Claude Code', '🤖', 'Engineering', 'online'),
  ('pip', 'Pip', '🐿️', 'Coordination', 'online'),
  ('ed', 'Ed', '⚔️', 'Engineering', 'offline'),
  ('light', 'Light', '💡', 'Product', 'offline'),
  ('toji', 'Toji', '🛡️', 'Commerce', 'offline'),
  ('power', 'Power', '⚡', 'Influence', 'offline'),
  ('major', 'Major', '🎯', 'Operations', 'offline');

-- Create default welcome thread
insert into chat_threads (title, agent_id, last_message, last_message_at)
values ('Welcome to Shoin', 'pip', 'Yo! I''m Pip — your coordination agent. What are we building today?', now());

-- Add welcome message
insert into chat_messages (thread_id, role, content, agent_id)
select 
  id as thread_id,
  'assistant' as role,
  'Yo! I''m Pip — your coordination agent. What are we building today?' as content,
  'pip' as agent_id
from chat_threads 
where title = 'Welcome to Shoin';
