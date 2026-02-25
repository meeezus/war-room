-- Seed 5 default objectives for War Room
-- Uses fixed UUIDs + ON CONFLICT (id) DO NOTHING for idempotency

INSERT INTO objectives (id, title, description, success_criteria, status, created_by)
VALUES
  (
    'a1b2c3d4-0001-4000-8000-000000000001',
    'Ship War Room v1',
    'Reach daily-driver status with dashboard, chat, kanban, and objectives tracking',
    'Dashboard, Shoin Chat, Kanban, and Objectives pages are functional and used daily',
    'active',
    'Sensei'
  ),
  (
    'a1b2c3d4-0002-4000-8000-000000000002',
    'Daimyo Council Accuracy',
    'Council reviews consistently catch real issues and add value to proposals',
    'Council reviews surface actionable feedback on >80% of proposals reviewed',
    'active',
    'Sensei'
  ),
  (
    'a1b2c3d4-0003-4000-8000-000000000003',
    'Autonomous Patrol Coverage',
    'Patrol engine scans all active projects and surfaces actionable discoveries',
    'Patrol runs on all active projects and produces at least 1 actionable discovery per cycle',
    'active',
    'Sensei'
  ),
  (
    'a1b2c3d4-0004-4000-8000-000000000004',
    'Skill Evolution Pipeline',
    'Post-mission learning loop extracts, validates, and applies patterns to SKILL files',
    'Completed missions produce skill patches that are reviewed and merged into SKILL files',
    'active',
    'Sensei'
  ),
  (
    'a1b2c3d4-0005-4000-8000-000000000005',
    'Mobile-Ready Dashboard',
    'War Room is usable on phone for quick status checks on the go',
    'Dashboard and key pages render correctly and are navigable on a 390px-wide viewport',
    'active',
    'Sensei'
  )
ON CONFLICT (id) DO NOTHING;
