-- Add chat_history column to plans table for conversational iteration
ALTER TABLE plans ADD COLUMN IF NOT EXISTS chat_history JSONB DEFAULT '[]';
