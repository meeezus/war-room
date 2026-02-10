-- Add council review routing for proposals
ALTER TABLE proposals ADD COLUMN council_review BOOLEAN DEFAULT false;
ALTER TABLE proposals ADD COLUMN reviews JSONB DEFAULT '[]'::jsonb;
