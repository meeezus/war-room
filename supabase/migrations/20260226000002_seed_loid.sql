-- Seed Loid Forger (Brand & Sales) into agent roster
INSERT INTO agent_status (id, name, display_name, domain, model, level, status)
VALUES ('loid', 'Loid', 'Loid', 'brand', 'opus-4.6', 2, 'idle')
ON CONFLICT (id) DO NOTHING;
