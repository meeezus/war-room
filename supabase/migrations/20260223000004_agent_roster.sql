-- Add missing agents to agent_presence for Shoin Chat FK constraints
INSERT INTO agent_presence (id, name, avatar, specialty, status) VALUES
  ('makima', 'Makima', '/avatars/makima.webp', 'Synthesis', 'online'),
  ('bulma', 'Bulma', '/avatars/bulma.webp', 'Product', 'offline'),
  ('l', 'L', '/avatars/l.webp', 'Analysis', 'offline'),
  ('nanami', 'Nanami', '/avatars/nanami.webp', 'Finance', 'offline'),
  ('armin', 'Armin', '/avatars/armin.webp', 'Research', 'offline')
ON CONFLICT (id) DO NOTHING;
