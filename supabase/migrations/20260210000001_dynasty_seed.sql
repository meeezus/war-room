-- Seed data for dynasty dashboard
-- Projects from ~/Shugyo/Mission-Control.md
-- Boards from ~/Shugyo/Shogunate/Boards/*.md and ~/Shugyo/ÆOM/Folio/Boards/*.md
-- Stale data corrections applied: Atlas→Ed, Sage→Light, Vex→Toji, Spark→Power, Bolt→Major

INSERT INTO projects (id, title, status, priority, goal, type, owner, notes, next_action) VALUES
('shogunate', 'Shogunate War Room', 'inprogress', 0, 'Live command dashboard for AI executive council — Kanban boards, agent status, event feeds', 'strategy', 'Michael', 'War Room v2 complete — Supabase integration, realtime, PWA shipped. Dynasty dashboard expansion next.', 'Dynasty-wide project tracking'),
('folio', 'Folio', 'inprogress', 0, 'SaaS research tool for health influencers — Jack Schroder is Client Zero', 'product', 'Development', '13/13 sprint tasks shipped Feb 6. Sprint 1 post-benchmark perf shipped. Graph RAG complete. Create page redesign planned.', 'Create page redesign with right research sidebar'),
('hip-memory', 'HIP Memory System', 'inprogress', 1, 'Hierarchical Implicit Processing memory architecture for persistent AI context', 'project', 'Michael', 'Active development. Cross-session memory for Claude Code and Pip.', 'Continue implementation'),
('job-apps', 'Job Applications', 'inprogress', 1, 'Land next role — applications, portfolio, interview prep', 'job-hunt', 'Michael', 'Active job search alongside client work.', 'Check application status'),
('garage-door', 'Garage Door', 'todo', 1, 'Smart garage door automation project', 'project', 'Michael', 'Wants to work on soon.', 'Define scope and requirements'),
('folio-opennote', 'Folio OpenNote Testing', 'inprogress', 1, 'Test Canvas editor AI flow end-to-end with real content', 'verification', 'Development', 'canvasContext detection fixed. E2E test revealed navigation bug.', 'Debug navigation bug in UniversalChatBar submit handler'),
('claude-security', 'Claude Security', 'todo', 2, 'Security hardening for Claude Code workflows and agent systems', 'project', 'Michael', 'Security review of agent infrastructure, OAuth tokens, credential management.', 'Scope the security audit'),
('obsidian-workflows', 'Obsidian Workflow Exploration', 'someday', 2, 'Evaluate board alternatives and workflow plugins', 'project', 'Michael', 'Phase 3. Board alternatives: Dataview+Kanban, Bases, Obsidian Projects.', 'Research kepano/obsidian-skills and Claudian'),
('x-algorithm', 'X Algorithm', 'someday', 2, 'Optimize X/Twitter algorithm engagement for content distribution', 'project', 'Michael', 'Queued — after Folio stabilizes.', 'Research current X algorithm patterns'),
('decopon-atx', 'DecoponATX', 'onhold', 2, 'Tricia''s company — AI consulting and implementation', 'client', 'Michael', 'Client Zero for ÆOM. On hold while focusing on Folio/Jack.', 'Check in with Tricia'),
('aeom-landing', 'ÆOM Landing Page', 'someday', 3, 'Marketing website for ÆOM — establish online presence', 'project', 'Michael', 'Business landing page. Deferred until after Folio demo.', 'Draft landing page copy and design'),
('visati', 'Visati', 'someday', 3, 'Meditation and journaling app concept', 'project', 'Michael', 'Exploring concept. No timeline.', 'Define MVP scope'),
('stan-scraper', 'Stan Scraper', 'onhold', 3, 'Scrape Stan platform course content for reference library', 'project', 'Michael', 'Scraping blocked by platform changes.', 'Research alternative scraping methods'),
('flowygate', 'FlowyGate', 'someday', 3, 'Exploring FlowGate concept', 'project', 'Michael', 'Early exploration phase.', 'Define what this project is'),
('convoy', 'Convoy', 'someday', 99, 'Trisha''s AI consulting idea', 'project', 'Michael', 'Concept only. No active work.', 'Discuss with Trisha when ready'),
('maps-leadgen', 'Maps Lead Gen', 'someday', 99, 'Google Maps based lead generation business idea', 'project', 'Michael', 'Business idea. No active work.', 'Validate market opportunity');

-- Shogunate Boards (5 boards)
INSERT INTO boards (id, project_id, title, description, board_type) VALUES
('shogunate-daimyo-council', 'shogunate', 'Daimyo Council', 'Five domain lords. Five SKILL.md files. Five autonomous agents.', 'board'),
('shogunate-war-room-infra', 'shogunate', 'War Room Infrastructure', 'Six-layer stack implementation. Real-time dashboard. Obsidian two-way sync.', 'board'),
('shogunate-agent-protocols', 'shogunate', 'Agent Protocols', 'Protocol definitions for agent behavior and coordination', 'board'),
('shogunate-samurai-workers', 'shogunate', 'Samurai Workers', 'Worker pool definitions and spawning protocols', 'board'),
('shogunate-sage-activation', 'shogunate', 'Sage Activation Sprint', 'Sprint for activating Sage (Light) Discord bot', 'board');

-- Folio Boards (7 boards as epics)
INSERT INTO boards (id, project_id, title, description, board_type) VALUES
('folio-chat-coherence', 'folio', 'Chat Coherence', 'Coherent, multi-hop AI conversations over Jack''s notes and studies', 'epic'),
('folio-content-creation', 'folio', 'Content Creation', 'Voice-aware content creation that sounds like Jack', 'epic'),
('folio-knowledge-base', 'folio', 'Knowledge Base', 'Jack''s corpus — every note, study, and import searchable and connected', 'epic'),
('folio-research-discovery', 'folio', 'Research Discovery', 'Personalized research feed with quality papers and filters', 'epic'),
('folio-graph', 'folio', 'Graph', 'LLM-extracted entity graph over 1148 notes for relational queries', 'epic'),
('folio-platform-ux', 'folio', 'Platform UX', 'Clean, Notion-style interface — icon-only sidebar, smart UI', 'epic'),
('folio-community', 'folio', 'Community', 'Share research and content to Jack''s community', 'epic');

-- ÆOM Epics (2 boards)
INSERT INTO boards (id, project_id, title, description, board_type) VALUES
('aeom-tokencos', 'shogunate', 'TokenOS', 'Clawdbot Token Economics Engine — cost-aware AI system', 'epic'),
('aeom-multi-agent', 'shogunate', 'Multi-Agent Ops', 'Multi-agent architecture and mission control patterns', 'epic');

-- =============================================
-- TASKS
-- =============================================

-- Shogunate > Daimyo Council tasks (these are profile entries, represented as tasks for visibility)
-- Note: Atlas→Ed, Sage→Light, Vex→Toji, Spark→Power, Bolt→Major (corrected names)
INSERT INTO tasks (board_id, project_id, title, status, priority, goal, type, owner, notes) VALUES
('shogunate-daimyo-council', 'shogunate', 'Pip — Shogun (Coordination)', 'active', 0, 'Council coordination and mission routing', 'daimyo-profile', 'Pip', 'Level 4. Opus 4.6. Active. Architecture v2 complete.'),
('shogunate-daimyo-council', 'shogunate', 'Ed — VP Engineering', 'active', 0, 'Sprint planning, code review, debug with root cause analysis', 'daimyo-profile', 'Ed', 'Level 2. Sonnet 4.5. Active. War Room v2 file sync.'),
('shogunate-daimyo-council', 'shogunate', 'Light — VP Product', 'active', 0, 'Strategy analysis, product roadmap, Discord council presence', 'daimyo-profile', 'Light', 'Level 2. Opus 4.6 + verbose. Active. Discord bot testing.'),
('shogunate-daimyo-council', 'shogunate', 'Toji — VP Commerce', 'todo', 1, 'Lead qualification, deal pipeline, outreach, revenue forecasting', 'daimyo-profile', 'Toji', 'Level 2. Sonnet 4.5. Idle. Needs Discord bot token + SKILL.md.'),
('shogunate-daimyo-council', 'shogunate', 'Power — VP Marketing', 'todo', 1, 'Content calendar, campaign analysis, brand voice, growth experiments', 'daimyo-profile', 'Power', 'Level 2. Sonnet 4.5. Idle. Needs Discord bot token + SKILL.md.'),
('shogunate-daimyo-council', 'shogunate', 'Major — VP Operations', 'todo', 1, 'Deployment automation, CI/CD, system monitoring, incident response', 'daimyo-profile', 'Major', 'Level 2. Sonnet 4.5. Idle. Needs Discord bot token + SKILL.md.'),
('shogunate-daimyo-council', 'shogunate', 'Write SKILL.md for Toji, Power, Major', 'todo', 1, 'Create SKILL.md capability files for remaining Daimyo', 'task', 'Pip', NULL);

-- Shogunate > Agent Protocols tasks
INSERT INTO tasks (board_id, project_id, title, status, priority, goal, type, owner, notes) VALUES
('shogunate-agent-protocols', 'shogunate', 'Code of Silence', 'done', 0, 'Agents speak only when @mentioned or during scheduled standup', 'protocol', 'Pip', 'Heartbeat mode implemented. Daily standup at 9 AM / 6 PM CST.'),
('shogunate-agent-protocols', 'shogunate', 'Leveling System', 'active', 0, '4-level authority — Observer → Advisor → Operator → Daimyo', 'protocol', 'Pip', 'All Daimyo start at Level 2. Promotion requires 5 tasks + Sensei approval.'),
('shogunate-agent-protocols', 'shogunate', 'Cap Gates', 'todo', 1, 'Quota checks before accepting work — reject at entry', 'protocol', 'Pip', 'Daily task limits per agent. Token budget gates. Priority validation.'),
('shogunate-agent-protocols', 'shogunate', 'Reaction Matrix', 'todo', 2, 'Probability-based inter-agent triggers', 'protocol', 'Pip', 'Event-driven collaboration. Cooldown periods. Spontaneous agent interaction.');

-- Shogunate > Samurai Workers tasks
INSERT INTO tasks (board_id, project_id, title, status, priority, goal, type, owner, notes) VALUES
('shogunate-samurai-workers', 'shogunate', 'Business Samurai', 'todo', 1, 'Writer, Researcher, Analyst, Executor for non-coding tasks', 'worker-pool', 'Sensei', 'Spawned by Daimyo. Sonnet/Haiku models. Ephemeral.'),
('shogunate-samurai-workers', 'shogunate', 'Engineering Samurai', 'todo', 1, 'Coder, Debugger, Tester, Reviewer for coding tasks', 'worker-pool', 'Sensei', 'Spawned by Ed and Major. TDD. Code review.'),
('shogunate-samurai-workers', 'shogunate', 'Worker Spawning Protocol', 'todo', 2, 'Daimyo delegates to Samurai via sessions_spawn', 'protocol', 'Pip', 'Orchestrator (Opus) → Worker (Sonnet/Haiku). 30-50% cost savings.');

-- Shogunate > Sage Activation Sprint tasks
INSERT INTO tasks (board_id, project_id, title, status, priority, goal, type, owner, notes) VALUES
('shogunate-sage-activation', 'shogunate', 'Configure Discord Bot', 'done', 0, 'Add Light token to OpenClaw, configure Opus 4.6', 'task', 'Pip', 'Token configured. Gateway restarted.'),
('shogunate-sage-activation', 'shogunate', 'Fix Channel Permissions', 'active', 0, 'Light visible and responding in #council channel', 'task', 'Sensei', 'Bot not appearing. Need to verify invite + permissions.'),
('shogunate-sage-activation', 'shogunate', 'Level 2 Protocol', 'active', 0, 'Advisor mode — recommends, awaits approval', 'task', 'Light', 'SOUL.md updated. No autonomous execution.'),
('shogunate-sage-activation', 'shogunate', 'War Room Integration', 'active', 0, 'Light status displays in War Room dashboard', 'task', 'Sensei', 'File system sync for Light status.'),
('shogunate-sage-activation', 'shogunate', 'Obsidian Links', 'todo', 1, 'Click Light in War Room → opens Daimyo/Light.md', 'task', 'Sensei', 'obsidian:// URI integration.');

-- Folio > Chat Coherence tasks (18 tasks — most done)
INSERT INTO tasks (board_id, project_id, title, status, priority, goal, type, owner, notes, completed_at) VALUES
('folio-chat-coherence', 'folio', 'Sprint 1 — Post-Benchmark Performance', 'done', NULL, 'Fix 23% cache failure rate, 500-1800ms latency reduction', 'sprint', 'Ed', 'Cache quality gate, skip embedding on follow-ups, conditional PubMed. Tested at 481 avg words.', '2026-02-09'),
('folio-chat-coherence', 'folio', 'Graph RAG — Entity Store + Batch Extractor', 'done', NULL, 'Upsert entities with deduplication + batch pipeline for 1148 notes', 'feature', 'Development', 'Fixed 4 bugs. Switched from API to local extraction.', '2026-02-07'),
('folio-chat-coherence', 'folio', 'Graph RAG — Schema + Migration', 'done', NULL, 'kb_entities, kb_entity_relations, kb_item_entities tables', 'feature', 'Development', 'Three tables, indexes, RLS policies applied.', '2026-02-07'),
('folio-chat-coherence', 'folio', 'Graph RAG — RPC Traversal', 'done', NULL, 'Recursive CTE for multi-hop graph traversal', 'feature', 'Development', 'All SQL. Bidirectional BFS for path finding.', '2026-02-07'),
('folio-chat-coherence', 'folio', 'Graph RAG — Entity Extraction Module', 'done', NULL, 'LLM extracts entities + relations from kb_items', 'feature', 'Development', '8 entity types implemented.', '2026-02-07'),
('folio-chat-coherence', 'folio', 'Graph RAG — kb_graph_search A-RAG Tool', 'done', NULL, 'A-RAG tool for graph traversal queries', 'feature', 'Development', 'Dual mode: fan-out + path finding.', '2026-02-07'),
('folio-chat-coherence', 'folio', 'Graph RAG — A-RAG Prompt Enhancement', 'done', NULL, 'System prompt + UX labels for graph search', 'feature', 'Development', 'graph Source.type, stream label, prompt guidance.', '2026-02-07'),
('folio-chat-coherence', 'folio', 'Graph RAG — Validation + Incremental', 'done', NULL, 'Eval script, incremental extraction, performance indexes', 'feature', 'Development', 'ENABLE_GRAPH_RAG env var.', '2026-02-07'),
('folio-chat-coherence', 'folio', 'A-RAG Pipeline Refactor', 'done', NULL, 'Refactor 2182-line route.ts into modular architecture', 'refactor', 'Pip', '7 modules in lib/chat/.', '2026-02-06'),
('folio-chat-coherence', 'folio', 'A-RAG Multi-Turn Quality', 'done', NULL, 'Source-aware history, anti-sycophancy, confirmation grounding', 'systemic-fix', 'Pip', '5 quality improvements.', '2026-02-07'),
('folio-chat-coherence', 'folio', 'A-RAG P0 Bugfixes', 'done', NULL, 'Fix 5 P0 bugs — follow-up loss, tool suggestions, pre-prompt, modal, sort', 'bug-fix', 'Pip', NULL, '2026-02-07'),
('folio-chat-coherence', 'folio', 'Semantic Cache Fix', 'done', NULL, 'Skip cache on follow-ups, schema v3', 'bug-fix', 'Pip', NULL, '2026-02-07'),
('folio-chat-coherence', 'folio', 'search_research LLM Tool', 'done', NULL, 'Mid-conversation PubMed + bioRxiv/medRxiv search', 'feature', 'Development', NULL, '2026-02-06'),
('folio-chat-coherence', 'folio', 'Post-Conversation Memory Extraction', 'done', NULL, 'Haiku extracts research interests after every conversation', 'feature', 'Development', 'user_memories table. ~$0.005/extraction.', '2026-02-06'),
('folio-chat-coherence', 'folio', 'Chat Depth + Tables', 'done', NULL, 'Match ChatGPT 4o depth with markdown tables', 'enhancement', 'Development', NULL, '2026-02-06'),
('folio-chat-coherence', 'folio', 'Conversation Persistence', 'done', NULL, 'DB-backed message storage, multi-turn context', 'feature', 'Pip', NULL, '2026-02-05'),
('folio-chat-coherence', 'folio', 'Title Generation', 'done', NULL, 'Haiku auto-generates 3-8 word conversation titles', 'feature', 'Pip', NULL, '2026-02-05'),
('folio-chat-coherence', 'folio', 'Deep Mode — Agencia Discussion', 'done', NULL, 'Auto-escalation via A-RAG tools, no UI toggle needed', 'decision', 'Product', 'Graph RAG + multi-turn + tool use handles deep mode implicitly.', '2026-02-07');

-- Folio > Content Creation tasks (7 tasks — all done)
INSERT INTO tasks (board_id, project_id, title, status, priority, goal, type, owner, notes, completed_at) VALUES
('folio-content-creation', 'folio', 'Validate Canvas Inline Editing', 'done', NULL, 'E2E test inline suggestions with Jack', 'verification', 'Development', 'All 9 steps verified.', '2026-02-07'),
('folio-content-creation', 'folio', 'Chat Bar Auto-Minimize', 'done', NULL, 'Collapse chat bar when rewrite_suggestion arrives', 'enhancement', 'Development', NULL, '2026-02-07'),
('folio-content-creation', 'folio', 'Canvas Markdown to HTML', 'done', NULL, 'Convert LLM markdown to HTML for Tiptap', 'bug-fix', 'Development', 'Added marked package.', '2026-02-07'),
('folio-content-creation', 'folio', 'Canvas Content Generation Fix', 'done', NULL, 'Use conversation context instead of random KB search', 'bug-fix', 'Development', 'Add to Canvas button on chat messages.', '2026-02-06'),
('folio-content-creation', 'folio', 'Canvas Editor AI (OpenNote Flow)', 'done', NULL, 'Highlight → Ask → chat → accept/deny overlay', 'bug-fix', 'Development', NULL, '2026-02-06'),
('folio-content-creation', 'folio', 'Voice Profile in Chat', 'done', NULL, '91% voice match with anti-caricature instruction', 'enhancement', 'Development', NULL, '2026-02-06'),
('folio-content-creation', 'folio', 'Copy Button (Rich HTML)', 'done', NULL, 'One-click copy with formatting preserved', 'feature', 'Development', NULL, '2026-02-06');

-- Folio > Knowledge Base tasks (7 tasks — 4 done, 2 someday, 1 done)
INSERT INTO tasks (board_id, project_id, title, status, priority, goal, type, owner, notes, completed_at) VALUES
('folio-knowledge-base', 'folio', 'Embedding Provider Fix (1024→1536)', 'done', NULL, 'Fix dimension mismatch', 'bug-fix', 'Development', 'Migration applied.', '2026-02-07'),
('folio-knowledge-base', 'folio', 'Document Upload + Chunking', 'done', NULL, 'Multi-format document upload with chunking', 'feature', 'Pip', NULL, '2026-01-15'),
('folio-knowledge-base', 'folio', 'Hybrid Search', 'done', NULL, 'Vector + BM25 + trigram fuzzy search', 'feature', 'Pip', NULL, '2026-02-05'),
('folio-knowledge-base', 'folio', 'Tags + Pagination', 'done', NULL, 'Tagging system and pagination for notes view', 'feature', 'Pip', NULL, '2026-02-03'),
('folio-knowledge-base', 'folio', 'Grimhood Search Fix', 'done', NULL, 'Indexing/caching fix for Grimhood content search', 'bug-fix', 'Pip', NULL, '2026-02-03');
INSERT INTO tasks (board_id, project_id, title, status, priority, goal, type, owner, notes) VALUES
('folio-knowledge-base', 'folio', 'Apple Notes Import v2', 'someday', 3, 'In-app import, no terminal intimidation', 'feature', 'Development', NULL),
('folio-knowledge-base', 'folio', 'Substack Import', 'someday', 3, 'RSS import for researcher archives', 'feature', 'Development', 'RSS only gets non-paywall content.');

-- Folio > Research Discovery tasks (6 tasks — all done)
INSERT INTO tasks (board_id, project_id, title, status, priority, goal, type, owner, notes, completed_at) VALUES
('folio-research-discovery', 'folio', 'Research Feed Redesign', 'done', NULL, 'Twitter-like scrollable feed with filters', 'feature', 'Development', NULL, '2026-02-06'),
('folio-research-discovery', 'folio', 'Expandable Source Cards', 'done', NULL, 'KB, PubMed, Web sources as expandable cards', 'feature', 'Development', NULL, '2026-02-06'),
('folio-research-discovery', 'folio', 'Email Digest Wire-Up', 'done', NULL, 'Connect digest to Research feed', 'enhancement', 'Development', NULL, '2026-02-06'),
('folio-research-discovery', 'folio', 'Preprints Cron', 'done', NULL, 'Vercel daily cron for preprint feed', 'infrastructure', 'Development', NULL, '2026-02-06'),
('folio-research-discovery', 'folio', 'PubMed Plus Sign Fix', 'done', NULL, 'NAD+ encoding — plus sign as %2B', 'bug-fix', 'Development', NULL, '2026-02-06'),
('folio-research-discovery', 'folio', 'Article Detail Modal Fix', 'done', NULL, 'Fallback for missing abstract', 'bug-fix', 'Pip', NULL, '2026-02-07');

-- Folio > Graph tasks (10 tasks — 9 done, 1 someday)
INSERT INTO tasks (board_id, project_id, title, status, priority, goal, type, owner, notes, completed_at) VALUES
('folio-graph', 'folio', 'Graph RAG — Schema + Migration', 'done', NULL, 'Three tables with indexes and RLS', 'feature', 'Development', NULL, '2026-02-07'),
('folio-graph', 'folio', 'Graph RAG — RPC Traversal Functions', 'done', NULL, 'Recursive CTE for multi-hop traversal', 'feature', 'Development', NULL, '2026-02-07'),
('folio-graph', 'folio', 'Graph RAG — Entity Extraction Module', 'done', NULL, 'LLM entity extraction from kb_items', 'feature', 'Development', NULL, '2026-02-07'),
('folio-graph', 'folio', 'Graph RAG — Entity Store + Batch Extractor', 'done', NULL, 'Upsert with dedup + batch pipeline', 'feature', 'Development', NULL, '2026-02-08'),
('folio-graph', 'folio', 'Graph RAG — kb_graph_search Tool', 'done', NULL, 'A-RAG graph traversal tool', 'feature', 'Development', NULL, '2026-02-07'),
('folio-graph', 'folio', 'Graph RAG — A-RAG Prompt Enhancement', 'done', NULL, 'Prompt and UX for graph search', 'feature', 'Development', NULL, '2026-02-07'),
('folio-graph', 'folio', 'Graph RAG — Validation + Incremental', 'done', NULL, 'Eval script + incremental extraction', 'feature', 'Development', NULL, '2026-02-07'),
('folio-graph', 'folio', 'Graph Explorer UI', 'done', NULL, '3D force-directed graph visualization', 'feature', 'Pip', 'Three.js sprite labels, top entities dropdown.', '2026-02-08'),
('folio-graph', 'folio', 'Graph-Chat Integration', 'done', NULL, 'Wire graph search into A-RAG chat pipeline', 'feature', 'Pip', '6 files modified, 151 lines.', '2026-02-08');
INSERT INTO tasks (board_id, project_id, title, status, priority, goal, type, owner, notes) VALUES
('folio-graph', 'folio', 'Agentic Memory — Graph Write-Back', 'someday', 3, 'LLM writes new entity connections discovered during chat back to graph', 'feature', 'Development', 'After Graph RAG quality proven. Needs confidence threshold.');

-- Folio > Platform UX tasks (3 tasks — 1 done, 2 active)
INSERT INTO tasks (board_id, project_id, title, status, priority, goal, type, owner, notes, completed_at) VALUES
('folio-platform-ux', 'folio', 'Conversation Persistence Across Pages', 'done', NULL, 'Chat state persists across navigations', 'enhancement', 'Development', NULL, '2026-02-06');
INSERT INTO tasks (board_id, project_id, title, status, priority, goal, type, owner, notes) VALUES
('folio-platform-ux', 'folio', 'Sidebar Restructure', 'done', 1, 'Icon-only collapsed sidebar with 3 flat sections', 'enhancement', 'Development', 'Kill parent categories. Notion-style minimal icons.'),
('folio-platform-ux', 'folio', 'Suggestion Whitespace Cleanup', 'todo', 3, 'Strip leading/trailing whitespace in suggestion content', 'bug-fix', 'Development', 'Extra space appears above after accepting replacement.');

-- Folio > Community tasks (2 tasks — someday)
INSERT INTO tasks (board_id, project_id, title, status, priority, goal, type, owner, notes) VALUES
('folio-community', 'folio', 'Skool Integration', 'someday', 99, 'Direct posting to Skool from Canvas', 'feature', NULL, 'Deferred until core product solid.'),
('folio-community', 'folio', 'Sharing / Export', 'someday', 99, 'Share research findings with community', 'feature', NULL, 'Future feature.');

-- Folio Command Center standalone tasks
INSERT INTO tasks (board_id, project_id, title, status, priority, goal, type, owner, notes, completed_at) VALUES
('folio-chat-coherence', 'folio', 'Fix A-RAG 60s tweet latency + canvas markdown bug', 'done', 0, 'Fix A-RAG latency + canvas markdown rendering', 'feature', 'Pip', 'Added EFFICIENCY RULE + marked.parse().', '2026-02-08'),
('folio-chat-coherence', 'folio', 'Research canvas/content creation flow gaps', 'done', 0, 'Investigate canvas flow + plan Create page redesign', 'investigation', 'Pip', 'Discovered page tracking gap. Recommended right sidebar layout.', '2026-02-09');
