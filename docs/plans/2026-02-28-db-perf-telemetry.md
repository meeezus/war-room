# DB Perf Telemetry Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the daily `analyze-queries` cron to capture Supabase query telemetry (slow query latencies, index usage) from `pg_stat_statements` and surface proposals when DB bottlenecks are found.

**Architecture:** A new Supabase migration creates two SQL functions (`get_slow_queries`, `get_index_usage`) with `SECURITY DEFINER` to safely expose `pg_stat_statements` data. A new `fetchDbPerfMetrics()` function in `lib/query-analyzer.ts` calls these via RPC, and the results feed into both a persistent `db_perf_snapshots` table and the existing `generateProposals()` logic.

**Tech Stack:** Next.js 15, Supabase (PostgreSQL + PostgREST), `pg_stat_statements` (enabled by default on Supabase hosted), `@supabase/supabase-js`

---

## Context

`analyzeQueries()` currently:
- Evaluates chat quality (Haiku scores quality/efficiency 1-10)
- `latencyMs` is hardcoded `null` throughout — there's a `// TODO: Track actual latency`
- Zero DB-level visibility: no slow query detection, no index usage, no connection metrics

`pg_stat_statements` is enabled by default on every hosted Supabase project. It tracks per-normalized-query stats: `calls`, `mean_exec_time`, `max_exec_time`, `total_exec_time`, `rows`. We access it through a `SECURITY DEFINER` SQL function callable via `supabase.rpc()`.

**What we are NOT doing:**
- pgBadger (requires log file access, not available on hosted Supabase)
- `EXPLAIN ANALYZE` at runtime (dangerous in production cron, and requires PostgREST config changes)
- Supabase Metrics API Prometheus scraping (valuable but better for Grafana, not a cron job)

---

## File Inventory

| File | Action | Note |
|------|--------|-------|
| `supabase/migrations/20260228000001_db_perf_functions.sql` | Create | SQL functions + `db_perf_snapshots` table |
| `lib/query-analyzer.ts` | Modify | Add `DbPerfMetrics` type, `fetchDbPerfMetrics()`, integrate into `analyzeQueries()` and `generateProposals()` |
| `app/api/cron/analyze-queries/route.ts` | Modify | Surface `dbPerf` in response |
| `lib/__tests__/query-analyzer.test.ts` | Create | Unit tests for proposal generation with perf data |

---

## Task 1: Migration — SQL Functions + Snapshot Table

**Files:**
- Create: `supabase/migrations/20260228000001_db_perf_functions.sql`

**Step 1: Write the migration**

```sql
-- supabase/migrations/20260228000001_db_perf_functions.sql

-- Grant postgres role permission to read pg_stat_statements
-- (required on Supabase hosted; no-op if already granted)
grant pg_read_all_stats to postgres;

-- Function: get_slow_queries
-- Returns top slow queries from pg_stat_statements.
-- SECURITY DEFINER so service_role can call it via RPC.
create or replace function get_slow_queries(
  min_calls int default 5,
  min_mean_exec_ms float default 5.0
)
returns table (
  query          text,
  calls          bigint,
  mean_exec_ms   float,
  max_exec_ms    float,
  total_exec_ms  float,
  stddev_exec_ms float,
  rows_affected  bigint
)
language sql
security definer
set search_path = public
as $$
  select
    query,
    calls,
    mean_exec_time   as mean_exec_ms,
    max_exec_time    as max_exec_ms,
    total_exec_time  as total_exec_ms,
    stddev_exec_time as stddev_exec_ms,
    rows             as rows_affected
  from pg_stat_statements
  where calls >= min_calls
    and mean_exec_time >= min_mean_exec_ms
  order by total_exec_time desc
  limit 20;
$$;

-- Function: get_index_usage
-- Returns tables with low index usage (candidates for new indexes or seq scan investigation).
create or replace function get_index_usage()
returns table (
  table_name      text,
  seq_scans       bigint,
  idx_scans       bigint,
  idx_usage_pct   float,
  live_rows       bigint
)
language sql
security definer
set search_path = public
as $$
  select
    relname                                                      as table_name,
    seq_scan                                                     as seq_scans,
    idx_scan                                                     as idx_scans,
    case
      when (seq_scan + idx_scan) = 0 then null
      else round((idx_scan::float / (seq_scan + idx_scan) * 100)::numeric, 1)::float
    end                                                          as idx_usage_pct,
    n_live_tup                                                   as live_rows
  from pg_stat_user_tables
  where n_live_tup > 100          -- skip tiny/empty tables
  order by seq_scan desc
  limit 20;
$$;

-- Table: db_perf_snapshots
-- Daily snapshot of DB telemetry for trending over time.
create table if not exists db_perf_snapshots (
  id            serial primary key,
  captured_at   timestamptz default now(),
  slow_queries  jsonb,   -- array of get_slow_queries() rows
  index_usage   jsonb,   -- array of get_index_usage() rows
  summary       jsonb    -- { slowQueryCount, tablesWithLowIndexPct, topSlowQuery }
);

-- RLS: service_role only (cron writes, no public read needed)
alter table db_perf_snapshots enable row level security;
create policy "service_role_all" on db_perf_snapshots
  for all using (auth.role() = 'service_role');
```

**Step 2: Verify migration is syntactically valid**

```bash
cd /Users/michaelenriquez/Code/war-room
npx supabase db diff --local 2>&1 | head -30
```

Expected: Either shows the diff cleanly or "No changes" (if local DB not running, that's fine — migration file correctness is what matters here).

**Step 3: Note the filename**

The file `20260228000001_db_perf_functions.sql` follows the existing `YYYYMMDDNNNNNN_*` naming convention (check via `ls supabase/migrations/` — all existing files use 8-digit date prefix).

**Step 4: Commit**

```bash
git add supabase/migrations/20260228000001_db_perf_functions.sql
git commit -m "feat: add db_perf SQL functions and snapshot table"
```

---

## Task 2: Add `DbPerfMetrics` Type + `fetchDbPerfMetrics()` to query-analyzer.ts

**Files:**
- Modify: `lib/query-analyzer.ts` (lines 1-36 for types, after line 90 for new function)

**Step 1: Write failing test for `fetchDbPerfMetrics` return shape**

Create `lib/__tests__/query-analyzer.test.ts`:

```typescript
// lib/__tests__/query-analyzer.test.ts
import { describe, it, expect, jest, beforeEach } from '@jest/globals'

// We test the proposal generation logic (pure functions) not the RPC calls
// Integration test for fetchDbPerfMetrics is in Step 7 (manual curl)

describe('generateProposalsFromPerfData', () => {
  it('generates slow query proposal when mean_exec_ms > 100', () => {
    const slowQueries = [
      {
        query: 'SELECT * FROM chat_messages WHERE thread_id = $1',
        calls: 500,
        mean_exec_ms: 245.3,
        max_exec_ms: 890.1,
        total_exec_ms: 122650,
        stddev_exec_ms: 45.2,
        rows_affected: 12500,
      },
    ]
    const proposals = proposalsFromSlowQueries(slowQueries)
    expect(proposals.length).toBeGreaterThan(0)
    expect(proposals[0].title).toContain('Slow Query')
    expect(proposals[0].priority).toBe('high')
  })

  it('generates index proposal for table with < 50% index usage', () => {
    const indexUsage = [
      {
        table_name: 'chat_messages',
        seq_scans: 8000,
        idx_scans: 200,
        idx_usage_pct: 2.4,
        live_rows: 50000,
      },
    ]
    const proposals = proposalsFromIndexUsage(indexUsage)
    expect(proposals.length).toBeGreaterThan(0)
    expect(proposals[0].title).toContain('Index')
    expect(proposals[0].description).toContain('chat_messages')
  })

  it('skips proposal when all queries are fast (mean < 10ms)', () => {
    const slowQueries = [
      {
        query: 'SELECT id FROM proposals LIMIT 10',
        calls: 100,
        mean_exec_ms: 2.1,
        max_exec_ms: 15.0,
        total_exec_ms: 210,
        stddev_exec_ms: 1.2,
        rows_affected: 1000,
      },
    ]
    const proposals = proposalsFromSlowQueries(slowQueries)
    expect(proposals.length).toBe(0)
  })
})

// These will be exported from query-analyzer.ts in Task 3
import { proposalsFromSlowQueries, proposalsFromIndexUsage } from '../query-analyzer'
```

**Step 2: Run test to confirm it fails**

```bash
cd /Users/michaelenriquez/Code/war-room
npx jest lib/__tests__/query-analyzer.test.ts 2>&1 | tail -20
```

Expected: FAIL with "Cannot find module '../query-analyzer'" or "proposalsFromSlowQueries is not a function".

**Step 3: Add types to `lib/query-analyzer.ts`**

After line 36 (after `ProposalDraft` interface), add:

```typescript
interface SlowQuery {
  query: string
  calls: number
  mean_exec_ms: number
  max_exec_ms: number
  total_exec_ms: number
  stddev_exec_ms: number
  rows_affected: number
}

interface IndexUsageStat {
  table_name: string
  seq_scans: number
  idx_scans: number
  idx_usage_pct: number | null
  live_rows: number
}

interface DbPerfMetrics {
  slowQueries: SlowQuery[]
  indexUsage: IndexUsageStat[]
  capturedAt: string
}
```

**Step 4: Add `fetchDbPerfMetrics()` after `fetchResponse()` (after line 90)**

```typescript
/**
 * Fetch DB performance telemetry via pg_stat_statements RPC functions.
 * Requires migration 20260228000001_db_perf_functions.sql to be applied.
 */
export async function fetchDbPerfMetrics(): Promise<DbPerfMetrics> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [slowResult, indexResult] = await Promise.all([
    supabase.rpc('get_slow_queries', { min_calls: 5, min_mean_exec_ms: 5.0 }),
    supabase.rpc('get_index_usage'),
  ])

  if (slowResult.error) {
    captureError(slowResult.error, 'fetchDbPerfMetrics.get_slow_queries')
  }
  if (indexResult.error) {
    captureError(indexResult.error, 'fetchDbPerfMetrics.get_index_usage')
  }

  return {
    slowQueries: (slowResult.data as SlowQuery[]) ?? [],
    indexUsage: (indexResult.data as IndexUsageStat[]) ?? [],
    capturedAt: new Date().toISOString(),
  }
}
```

**Step 5: Add pure helper functions (exported for testing)**

After `fetchDbPerfMetrics()`:

```typescript
/**
 * Pure: generate proposals from slow query data.
 * Exported for unit testing.
 */
export function proposalsFromSlowQueries(slowQueries: SlowQuery[]): ProposalDraft[] {
  const proposals: ProposalDraft[] = []

  // Queries averaging > 100ms are actionable
  const hotQueries = slowQueries.filter((q) => q.mean_exec_ms > 100)

  if (hotQueries.length > 0) {
    const worst = hotQueries[0] // already sorted by total_exec_ms DESC from SQL
    const truncatedQuery = worst.query.slice(0, 120)
    proposals.push({
      title: `Slow Query Detected: avg ${worst.mean_exec_ms.toFixed(0)}ms over ${worst.calls} calls`,
      description: `Query pattern: \`${truncatedQuery}\`\nCalls: ${worst.calls} | Mean: ${worst.mean_exec_ms.toFixed(1)}ms | Max: ${worst.max_exec_ms.toFixed(1)}ms | Total DB time: ${(worst.total_exec_ms / 1000).toFixed(1)}s/day\n\nInvestigate with EXPLAIN ANALYZE. Consider index or query rewrite.`,
      domain: 'engineering',
      priority: worst.mean_exec_ms > 500 ? 'high' : 'medium',
    })
  }

  // Flag if multiple hot queries exist
  if (hotQueries.length > 3) {
    proposals.push({
      title: `${hotQueries.length} Slow Queries Found — DB Performance Review Needed`,
      description: `${hotQueries.length} query patterns averaging >100ms detected in pg_stat_statements. Top offenders by total DB time: ${hotQueries.slice(0, 3).map((q) => `${q.mean_exec_ms.toFixed(0)}ms`).join(', ')}. Schedule a DB performance review.`,
      domain: 'engineering',
      priority: 'high',
    })
  }

  return proposals
}

/**
 * Pure: generate proposals from index usage data.
 * Exported for unit testing.
 */
export function proposalsFromIndexUsage(indexUsage: IndexUsageStat[]): ProposalDraft[] {
  const proposals: ProposalDraft[] = []

  // Tables with <30% index usage and >1000 rows are suspect
  const lowIndexTables = indexUsage.filter(
    (t) => t.idx_usage_pct !== null && t.idx_usage_pct < 30 && t.live_rows > 1000
  )

  for (const table of lowIndexTables.slice(0, 3)) {
    proposals.push({
      title: `Low Index Usage on \`${table.table_name}\` (${table.idx_usage_pct?.toFixed(0)}%)`,
      description: `Table \`${table.table_name}\` has ${table.seq_scans.toLocaleString()} sequential scans vs ${table.idx_scans.toLocaleString()} index scans (${table.live_rows.toLocaleString()} rows). High seq scan ratio suggests missing indexes on frequently filtered columns. Run \`EXPLAIN ANALYZE\` on common queries against this table.`,
      domain: 'engineering',
      priority: (table.idx_usage_pct ?? 100) < 10 ? 'high' : 'medium',
    })
  }

  return proposals
}
```

**Step 6: Run test again**

```bash
npx jest lib/__tests__/query-analyzer.test.ts 2>&1 | tail -20
```

Expected: PASS — all 3 tests green.

**Step 7: Commit**

```bash
git add lib/query-analyzer.ts lib/__tests__/query-analyzer.test.ts
git commit -m "feat: add fetchDbPerfMetrics, proposalsFromSlowQueries, proposalsFromIndexUsage"
```

---

## Task 3: Integrate DB Perf into `analyzeQueries()` + Snapshot Storage

**Files:**
- Modify: `lib/query-analyzer.ts` — update `AnalysisReport`, `analyzeQueries()`, `generateProposals()`

**Step 1: Extend `AnalysisReport` interface** (around line 22)

Add `dbPerf` field:

```typescript
interface AnalysisReport {
  period: { start: string; end: string }
  totalQueries: number
  avgQualityScore: number
  avgEfficiencyScore: number
  criticalIssues: string[]
  proposals: ProposalDraft[]
  dbPerf: DbPerfMetrics | null  // <-- add this
}
```

**Step 2: Update `analyzeQueries()` to fetch DB perf in parallel and include in report**

Current `analyzeQueries()` starts at line 274. Replace the body to add parallel DB perf fetching:

```typescript
export async function analyzeQueries(): Promise<AnalysisReport> {
  // Fetch queries and DB perf in parallel
  const [queries, dbPerf] = await Promise.all([
    fetchRecentQueries(),
    fetchDbPerfMetrics().catch((err) => {
      captureError(err, 'analyzeQueries.fetchDbPerfMetrics')
      return null
    }),
  ])

  if (queries.length === 0) {
    return {
      period: {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      totalQueries: 0,
      avgQualityScore: 0,
      avgEfficiencyScore: 0,
      criticalIssues: ['No queries found in last 24h'],
      proposals: dbPerf ? [
        ...proposalsFromSlowQueries(dbPerf.slowQueries),
        ...proposalsFromIndexUsage(dbPerf.indexUsage),
      ] : [],
      dbPerf,
    }
  }

  // Evaluate each query (existing logic)
  const metrics: QueryMetrics[] = []
  for (const query of queries) {
    const response = await fetchResponse(query.thread_id, query.created_at)
    const metric = await evaluateQuery(query.content, response, query.id, query.created_at)
    metrics.push(metric)
  }

  // Generate proposals — quality-based + DB perf
  const qualityProposals = generateProposals(metrics)
  const dbPerfProposals = dbPerf ? [
    ...proposalsFromSlowQueries(dbPerf.slowQueries),
    ...proposalsFromIndexUsage(dbPerf.indexUsage),
  ] : []
  const proposals = [...qualityProposals, ...dbPerfProposals]

  // Calculate aggregates (existing)
  const avgQuality = metrics.reduce((sum, m) => sum + m.qualityScore, 0) / metrics.length
  const avgEfficiency = metrics.reduce((sum, m) => sum + m.efficiencyScore, 0) / metrics.length

  const criticalIssues = metrics
    .filter((m) => m.qualityScore < 5)
    .map((m) => `Low quality response (${m.qualityScore}/10): "${m.query}"`)

  // Persist DB perf snapshot
  if (dbPerf) {
    await saveDbPerfSnapshot(dbPerf).catch((err) =>
      captureError(err, 'analyzeQueries.saveDbPerfSnapshot')
    )
  }

  return {
    period: {
      start: queries[0].created_at,
      end: queries[queries.length - 1].created_at,
    },
    totalQueries: queries.length,
    avgQualityScore: avgQuality,
    avgEfficiencyScore: avgEfficiency,
    criticalIssues,
    proposals,
    dbPerf,
  }
}
```

**Step 3: Add `saveDbPerfSnapshot()` helper after `createProposals()`**

```typescript
/**
 * Persist daily DB perf snapshot for trending.
 */
async function saveDbPerfSnapshot(dbPerf: DbPerfMetrics): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const summary = {
    slowQueryCount: dbPerf.slowQueries.filter((q) => q.mean_exec_ms > 100).length,
    tablesWithLowIndexPct: dbPerf.indexUsage.filter(
      (t) => t.idx_usage_pct !== null && t.idx_usage_pct < 30
    ).length,
    topSlowQuery: dbPerf.slowQueries[0]
      ? {
          query: dbPerf.slowQueries[0].query.slice(0, 80),
          mean_exec_ms: dbPerf.slowQueries[0].mean_exec_ms,
        }
      : null,
  }

  const { error } = await supabase.from('db_perf_snapshots').insert({
    captured_at: dbPerf.capturedAt,
    slow_queries: dbPerf.slowQueries,
    index_usage: dbPerf.indexUsage,
    summary,
  })

  if (error) throw error
}
```

**Step 4: Run build to catch type errors**

```bash
cd /Users/michaelenriquez/Code/war-room
npx tsc --noEmit 2>&1 | grep -v node_modules | head -30
```

Expected: No errors. Fix any type mismatches before proceeding.

**Step 5: Run tests**

```bash
npx jest lib/__tests__/query-analyzer.test.ts 2>&1 | tail -10
```

Expected: PASS.

**Step 6: Commit**

```bash
git add lib/query-analyzer.ts
git commit -m "feat: integrate DB perf into analyzeQueries, save daily snapshots"
```

---

## Task 4: Update Cron Route Response

**Files:**
- Modify: `app/api/cron/analyze-queries/route.ts`

**Step 1: Update the response shape in `route.ts`**

Currently at line 51, the `NextResponse.json` call. Replace the report object:

```typescript
return NextResponse.json({
  success: true,
  report: {
    period: report.period,
    totalQueries: report.totalQueries,
    avgQualityScore: report.avgQualityScore,
    avgEfficiencyScore: report.avgEfficiencyScore,
    criticalIssues: report.criticalIssues,
    proposalsCreated,
    dbPerf: report.dbPerf
      ? {
          slowQueryCount: report.dbPerf.slowQueries.length,
          slowQueriesOver100ms: report.dbPerf.slowQueries.filter(
            (q) => q.mean_exec_ms > 100
          ).length,
          tablesWithLowIndexUsage: report.dbPerf.indexUsage.filter(
            (t) => t.idx_usage_pct !== null && t.idx_usage_pct < 30
          ).length,
          topSlowQueryMs: report.dbPerf.slowQueries[0]?.mean_exec_ms ?? null,
        }
      : null,
  },
  durationMs: duration,
})
```

Also update the console.log at line 35 to include dbPerf summary:

```typescript
console.log('[cron] Analysis complete:', {
  totalQueries: report.totalQueries,
  avgQuality: report.avgQualityScore.toFixed(2),
  avgEfficiency: report.avgEfficiencyScore.toFixed(2),
  proposalsGenerated: report.proposals.length,
  slowQueriesFound: report.dbPerf?.slowQueries.length ?? 'n/a',
})
```

**Step 2: Build check**

```bash
npx tsc --noEmit 2>&1 | grep -v node_modules | head -20
```

Expected: No errors.

**Step 3: Run local test of the cron endpoint**

```bash
# In one terminal: start dev server
npm run dev &

# In another: hit the cron endpoint (no CRON_SECRET in dev = open)
curl -s http://localhost:3000/api/cron/analyze-queries | python3 -m json.tool
```

Expected: JSON with `success: true` and `dbPerf` object present. If `pg_stat_statements` RPC isn't applied yet locally, `dbPerf` will be `null` (graceful fallback).

**Step 4: Build prod bundle**

```bash
npm run build 2>&1 | tail -20
```

Expected: Build succeeds, no type errors.

**Step 5: Commit**

```bash
git add app/api/cron/analyze-queries/route.ts
git commit -m "feat: surface DB perf summary in cron response"
```

---

## Task 5: Apply Migration to Production

**Step 1: Check current Supabase link**

```bash
npx supabase status 2>&1 | head -10
```

**Step 2: Apply migration via Supabase CLI**

```bash
npx supabase db push
```

Or if using the dashboard: copy the SQL from `supabase/migrations/20260228000001_db_perf_functions.sql` into the SQL editor.

**Step 3: Verify functions exist**

In Supabase SQL editor:

```sql
-- Should return rows
select proname from pg_proc
where proname in ('get_slow_queries', 'get_index_usage');
```

Expected: 2 rows.

**Step 4: Smoke test the RPC**

```sql
select * from get_slow_queries(1, 0.0) limit 5;
select * from get_index_usage() limit 5;
```

Expected: Returns data (even if empty if DB is idle).

**Step 5: Trigger cron manually (production)**

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  https://war-room.vercel.app/api/cron/analyze-queries | python3 -m json.tool
```

Expected: `dbPerf` object with real data in the response.

**Step 6: Verify snapshot was written**

```sql
select id, captured_at, summary
from db_perf_snapshots
order by captured_at desc
limit 3;
```

Expected: At least 1 row from the manual trigger.

---

## Rollback

| Step | Rollback |
|------|----------|
| Migration | `DROP FUNCTION get_slow_queries; DROP FUNCTION get_index_usage; DROP TABLE db_perf_snapshots;` |
| `query-analyzer.ts` | `git revert <commit>` — `analyzeQueries()` degrades gracefully to `dbPerf: null` even if functions don't exist |
| Cron route | Response shape is additive — no frontend depends on `dbPerf` field yet |

---

## Out of Scope

- **pgBadger**: requires SSH log access, not available on hosted Supabase. Defer unless we self-host.
- **Prometheus Metrics API scraping**: better for Grafana alerting. Defer to ops dashboard work.
- **Per-request `EXPLAIN ANALYZE`**: dangerous in prod, requires PostgREST config change. Defer.
- **War Room UI for DB perf**: `db_perf_snapshots` table is there; UI can be built later.

---

## Verification

```bash
# 1. Type check
npx tsc --noEmit

# 2. Unit tests
npx jest lib/__tests__/

# 3. Build
npm run build

# 4. Manual cron trigger (production)
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://war-room.vercel.app/api/cron/analyze-queries
```

Success = `dbPerf` object present in response with real latency data, snapshot row in `db_perf_snapshots`.
