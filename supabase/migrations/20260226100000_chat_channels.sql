-- Chat Channels Schema (Slack-style channels alongside existing DM threads)
-- Additive only: does NOT touch chat_threads or chat_messages tables.

-- Categories (manual groupings for organizing channels)
CREATE TABLE chat_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position INT DEFAULT 0,
  collapsed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Channels (topic-based conversation spaces)
CREATE TABLE chat_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES chat_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  created_by TEXT,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Channel messages (separate from DM chat_messages)
CREATE TABLE chat_channel_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  agent_id TEXT,
  reply_to_id UUID REFERENCES chat_channel_messages(id),
  thread_id UUID REFERENCES chat_channel_messages(id),
  thread_count INT DEFAULT 0,
  forwarded_from UUID REFERENCES chat_channel_messages(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_channel_messages_channel ON chat_channel_messages(channel_id);
CREATE INDEX idx_channel_messages_thread ON chat_channel_messages(thread_id);
CREATE INDEX idx_channels_category ON chat_channels(category_id);

-- Enable RLS
ALTER TABLE chat_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channel_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies (open access, matching existing pattern)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_categories' AND policyname = 'Allow all') THEN
    CREATE POLICY "Allow all" ON chat_categories FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_channels' AND policyname = 'Allow all') THEN
    CREATE POLICY "Allow all" ON chat_channels FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_channel_messages' AND policyname = 'Allow all') THEN
    CREATE POLICY "Allow all" ON chat_channel_messages FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE chat_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_channels;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_channel_messages;

-- RPC for incrementing thread reply count
CREATE OR REPLACE FUNCTION increment_thread_count(message_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE chat_channel_messages
  SET thread_count = thread_count + 1
  WHERE id = message_id;
END;
$$ LANGUAGE plpgsql;

-- Seed default category and channel
INSERT INTO chat_categories (name, position) VALUES ('General', 0);
INSERT INTO chat_channels (category_id, name, is_default, created_by, position)
SELECT id, 'general', true, 'system', 0 FROM chat_categories WHERE name = 'General';
