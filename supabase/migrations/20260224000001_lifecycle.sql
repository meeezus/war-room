-- Add status column to chat_threads
ALTER TABLE chat_threads ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active','archived'));

-- Add status column to council_sessions
ALTER TABLE council_sessions ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active','archived'));

-- Create indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_chat_threads_status ON chat_threads(status);
CREATE INDEX IF NOT EXISTS idx_council_sessions_status ON council_sessions(status);
