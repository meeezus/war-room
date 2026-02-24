-- Seed missing Daimyo agents (L, Nanami, Armin, Bulma) and remove legacy Power row

INSERT INTO agent_status (id, name, display_name, domain, model, level, status)
VALUES
  ('l', 'L', 'L', 'analysis', 'opus-4.6', 2, 'idle'),
  ('nanami', 'Nanami', 'Nanami', 'finance', 'opus-4.6', 2, 'idle'),
  ('armin', 'Armin', 'Armin', 'research', 'opus-4.6', 2, 'idle'),
  ('bulma', 'Bulma', 'Bulma', 'product', 'opus-4.6', 2, 'idle')
ON CONFLICT (id) DO NOTHING;

-- Clean up Power references before deleting
DELETE FROM agent_relationships WHERE agent_a = 'power' OR agent_b = 'power';
DELETE FROM agent_status WHERE id = 'power';
