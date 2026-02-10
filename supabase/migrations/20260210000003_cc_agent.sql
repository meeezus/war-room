-- Add CC (Claude Code) as a terminal agent
INSERT INTO agent_status (id, name, display_name, domain, model, level, status)
VALUES ('cc', 'CC', 'Claude Code', 'terminal', 'opus-4.6', 5, 'idle');

-- Add 'agent_action' type needs to support plan events
-- The events type check already includes 'agent_action' so we can use that

-- CC Ops board under Shogunate for tracking terminal work
INSERT INTO boards (id, project_id, title, board_type)
VALUES ('cc-ops', 'shogunate', 'CC Ops', 'board');
