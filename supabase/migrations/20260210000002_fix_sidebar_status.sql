-- Fix stale task status: Sidebar Restructure is done
UPDATE tasks SET status = 'done' WHERE title = 'Sidebar Restructure';
