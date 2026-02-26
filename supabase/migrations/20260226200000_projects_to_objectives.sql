-- Migrate orphan projects to objectives
INSERT INTO objectives (title, description, success_criteria, status, created_by, iteration_count, max_iterations)
SELECT
  title,
  COALESCE(goal, '') as description,
  'Migrated from project: ' || title as success_criteria,
  CASE
    WHEN status = 'inprogress' THEN 'active'
    WHEN status = 'done' THEN 'completed'
    ELSE 'active'
  END as status,
  'sensei' as created_by,
  0 as iteration_count,
  10 as max_iterations
FROM projects
WHERE objective_id IS NULL;

-- Create standing "Operational Health" objective for patrol missions
INSERT INTO objectives (title, description, success_criteria, status, created_by, iteration_count, max_iterations)
VALUES (
  'Operational Health',
  'Standing objective for patrol and awareness missions. Auto-assigned to orphan missions.',
  'Continuous operational health monitoring',
  'active',
  'system',
  0,
  999
);
