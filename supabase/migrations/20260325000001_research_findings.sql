-- Research findings from external sources (Twitter, arxiv, autoresearch, etc.)
CREATE TABLE IF NOT EXISTS research_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,           -- 'twitter', 'arxiv', 'autoresearch', 'last30days', 'manual', 'brave', 'perplexity'
  title TEXT NOT NULL,
  summary TEXT,
  url TEXT,
  relevance TEXT DEFAULT 'medium', -- 'high', 'medium', 'low'
  tags TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'new',       -- 'new', 'reviewed', 'actionable', 'archived'
  metadata JSONB DEFAULT '{}',     -- source-specific data (arxiv paper id, tweet id, etc.)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_research_findings_source ON research_findings(source);
CREATE INDEX IF NOT EXISTS idx_research_findings_status ON research_findings(status);
CREATE INDEX IF NOT EXISTS idx_research_findings_created ON research_findings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_findings_relevance ON research_findings(relevance);

-- RLS (match existing pattern -- allow anon access for now)
ALTER TABLE research_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to research_findings" ON research_findings
  FOR ALL USING (true) WITH CHECK (true);
