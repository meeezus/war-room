# Jack Query Analysis Cron Job

Automated daily job that analyzes Jack's real chat queries to identify improvement opportunities and auto-create War Room proposals.

## How It Works

**Daily at 9am CT:**
1. Fetches all real user queries from last 24h (excludes test queries)
2. For each query:
   - Retrieves the assistant response
   - Evaluates with Haiku:
     - Quality score (1-10): depth, accuracy, relevance
     - Efficiency score (1-10): conciseness, completeness
     - Issues found
     - Actionable suggestions
3. Aggregates metrics across all queries
4. Identifies patterns (recurring issues, common suggestions)
5. Generates proposals when:
   - Avg quality < 7 (high priority)
   - Avg efficiency < 7 (medium priority)
   - Same issue appears 3+ times (high/medium priority)
   - Same suggestion appears 3+ times (medium priority)
6. Auto-creates proposals in War Room with source='cron'

## Cost

~$0.02/day in Haiku API calls (assuming 20-30 queries/day @ $0.25/MTok)

## Setup

### 1. Environment Variables

Required in `.env.local`:

```bash
# From .env.local.example
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Optional (for production security)
CRON_SECRET=random-secret-here
```

### 2. Deploy to Vercel

The cron job is configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/analyze-queries",
      "schedule": "0 9 * * *"
    }
  ]
}
```

Vercel automatically:
- Runs the job daily at 9am
- Sends `Authorization: Bearer <CRON_SECRET>` header
- Retries on failure
- Logs execution in Vercel dashboard

### 3. Verify Setup

**Manual test:**
```bash
# Without auth (for local testing)
curl http://localhost:3000/api/cron/analyze-queries

# With auth (for production)
curl -H "Authorization: Bearer your-cron-secret" \
  https://your-app.vercel.app/api/cron/analyze-queries
```

**Expected response:**
```json
{
  "success": true,
  "report": {
    "period": { "start": "...", "end": "..." },
    "totalQueries": 23,
    "avgQualityScore": 7.8,
    "avgEfficiencyScore": 8.2,
    "criticalIssues": [],
    "proposalsCreated": 1
  },
  "durationMs": 12450
}
```

## Files

| File | Purpose |
|------|---------|
| `lib/query-analyzer.ts` | Core analysis logic (Haiku evaluation, proposal generation) |
| `app/api/cron/analyze-queries/route.ts` | Cron endpoint handler |
| `vercel.json` | Cron schedule configuration |

## How It Creates the Improvement Flywheel

```
Real usage
    ↓
Daily analysis (Haiku)
    ↓
Identify patterns & issues
    ↓
Auto-create proposals
    ↓
Proposals become missions
    ↓
Missions improve Jack
    ↓
Better responses
    ↓
(loop back to top)
```

## Proposal Examples

**Low Quality Detected:**
```
Title: Improve Response Quality for Clinical Trial Queries
Description: Average quality score is 6.3/10. Low-scoring examples:
"search trials for diabetes" (score: 5), "find cancer studies" (score: 4).
Consider: better knowledge base coverage, more detailed clinical trial
data integration, improved search relevance.
Domain: engineering
Priority: high
```

**Recurring Issue:**
```
Title: Fix Recurring Issue: Missing trial location data
Description: This issue appeared in 8 queries (35% of analyzed queries).
Investigate root cause and implement fix.
Domain: engineering
Priority: high
```

**Common Suggestion:**
```
Title: Implement Recurring Suggestion: Add trial eligibility criteria to results
Description: This improvement was suggested for 12 queries.
High-impact optimization opportunity.
Domain: product
Priority: medium
```

## Monitoring

Check Vercel logs for:
- Cron execution status
- Query counts
- Avg scores
- Proposals created
- Error rates

Filter logs: `[cron]` prefix

## Adjusting Thresholds

Edit `lib/query-analyzer.ts`:

```typescript
// Quality threshold (line ~217)
if (avgQuality < 7) { // Lower = more strict

// Efficiency threshold (line ~229)
if (avgEfficiency < 7) { // Lower = more strict

// Minimum issue frequency (line ~249)
if (count >= 3) { // Higher = fewer proposals
```

## Disabling

Remove the `vercel.json` file or comment out the cron entry:

```json
{
  "crons": [
    // {
    //   "path": "/api/cron/analyze-queries",
    //   "schedule": "0 9 * * *"
    // }
  ]
}
```
