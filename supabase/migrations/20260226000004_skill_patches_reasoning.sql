-- Layer 2: Add reasoning context columns to skill_patches
-- Used by skill_evolution.py to store when/why metadata for learned patterns
ALTER TABLE skill_patches ADD COLUMN IF NOT EXISTS when_applies TEXT;
ALTER TABLE skill_patches ADD COLUMN IF NOT EXISTS why_matters TEXT;
