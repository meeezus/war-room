# DB Query Performance Metrics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend `analyzeQueries()` to capture real DB performance telemetry (p50/p95 latencies from `pg_stat_statements`, table scan stats from `pg_stat_user_tables`) alongside fixing the broken app-level latency measurement that's currently always `null`.

**Architecture:** Two new RPC functions in a SQL migration expose Postgres system stats to the service role. A new `lib/db-performance.ts` fetches these with graceful fallback if `pg_stat_statements` isn't enabled. `query-analyzer.ts` imports these stats and folds them into the `AnalysisReport` + proposal generator.

**Tech Stack:** Supabase JS client (`.rpc()`), PostgreSQL `pg_stat_statements` extension, `pg_stat_user_tables`, Vitest for tests.

---

## Context

### What's broken today

`QueryMetrics.latencyMs` is declared in the interface but **always returns `null`** — the field is set in `evaluateQuery()` but never actually computed (no timestamp math anywhere). This is dead data.

### What's missing

`AnalysisReport` has zero DB-level telemetry. We don't know:
- Which Postgres queries are slow
- Which tables are getting sequential scans (missing indexes)
- P50/P95 of actual DB query execution times

### What we're NOT doing

- pgBadger (requires log file access, overkill for Supabase cloud)
- Supabase Performance Advisor (dashboard-only, no API)
- Per-request query tracing (would require middleware changes)

---

## File Inventory

| File | Action | Notes |
|------|--------|-------|
| `supabase/migrations/20260228000000_db_perf_rpcs.sql` | Create | Two RPC functions + extension enable |
| `lib/db-performance.ts` | Create | Types, fetchDbPerformanceStats(), percentile util |
| `lib/query-analyzer.ts` | Modify | Fix latencyMs, import db-performance, extend report |
| `app/api/cron/analyze-queries/route.ts` | Modify | Surface db metrics in response JSON |
| `__tests__/unit/db-performance.test.ts` | Create | percentile util + proposal generation tests |

---

## Task 1: SQL Migration — DB Performance RPC Functions

**Files:**
- Create: `supabase/migrations/20260228000000_db_perf_rpcs.sql`

### Step 1: Create the migration file

```sql
-- Enable pg_stat_statements (idempotent — safe if already on)
create extension if not exists pg_stat_statements;

-- ============================================================
-- get_slow_query_stats
-- Returns queries with mean execution time >= p_min_mean_ms
-- that have been called at least p_min_calls times.
-- Returns empty if pg_stat_statements not installed.
-- ============================================================
create or replace function get_slow_query_stats(
  p_min_calls  int   default 5,
  p_min_mean_ms float default 50
)
returns table (
  query          text,
  calls          bigint,
  mean_exec_time float,
  min_exec_time  float,
  max_exec_time  float,
  stddev_exec_time float,
  total_exec_time float,
  avg_rows       float
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_stat_statements') then
    return query
      select
        pss.query,
        pss.calls,
        pss.mean_exec_time,
        pss.min_exec_time,
        pss.max_exec_time,
        pss.stddev_exec_time,
        pss.total_exec_time,
        (pss.rows::float / nullif(pss.calls, 0)) as avg_rows
      from pg_stat_statements pss
      where pss.calls          >= p_min_calls
        and pss.mean_exec_time >= p_min_mean_ms
        and pss.dbid = (select oid from pg_database where datname = current_database())
      order by pss.mean_exec_time desc
      limit 20;
  end if;
  -- If extension not present: return empty result set (no rows)
end;
$$;

-- ============================================================
-- get_table_health
-- Sequential scan ratio per table. High seq_scan + low idx_scan
-- = missing index candidate.
-- ============================================================
create or replace function get_table_health()
returns table (
  table_name         text,
  seq_scans          bigint,
  idx_scans          bigint,
  seq_tup_read       bigint,
  n_live_tup         bigint,
  missing_index_risk text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select
      relname::text,
      seq_scan,
      coalesce(idx_scan, 0),
      seq_tup_read,
      n_live_tup,
      case
        when seq_scan > 100
          and n_live_tup > 1000
          and (idx_scan = 0 or seq_scan::float / nullif(idx_scan, 0) > 5)
          then 'high'
        when seq_scan > 10
          and n_live_tup > 100
          and (idx_scan = 0 or seq_scan::float / nullif(idx_scan, 0) > 2)
          then 'medium'
        else 'low'
      end::text
    from pg_stat_user_tables
    where n_live_tup > 0
    order by seq_tup_read desc
    limit 20;
end;
$$;

-- Grant to service_role (used by the cron job)
grant execute on function get_slow_query_stats(int, float) to service_role;
grant execute on function get_table_health()               to service_role;
```

### Step 2: Verify migration file exists
```bash
ls ~/Code/war-room/supabase/migrations/20260228000000_db_perf_rpcs.sql
```
Expected: file listed

### Step 3: Commit
```bash
git add supabase/migrations/20260228000000_db_perf_rpcs.sql
git commit -m "feat: add db performance RPC functions (pg_stat_statements + table health)"
```

---

## Task 2: Create `lib/db-performance.ts`

**Files:**
- Create: `lib/db-performance.ts`

### Step 1: Write the failing test first

Create `__tests__/unit/db-performance.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { percentile } from '@/lib/db-performance'

describe('percentile()', () => {
  it('returns null for empty array', () => {
    expect(percentile([], 0.5)).toBeNull()
  })

  it('returns the single element for a 1-element array', () => {
    expect(percentile([42], 0.5)).toBe(42)
    expect(percentile([42], 0.95)).toBe(42)
  })

  it('computes p50 of [10,20,30,40,50]', () => {
    // idx = ceil(5 * 0.5) - 1 = 2  →  sorted[2] = 30
    expect(percentile([10, 20, 30, 40, 50], 0.5)).toBe(30)
  })

  it('computes p95 of 10 elements', () => {
    // [100..1000 step 100] sorted — idx = ceil(10 * 0.95) - 1 = 9  →  1000
    const data = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
    expect(percentile(data, 0.95)).toBe(1000)
  })

  it('handles unsorted input', () => {
    // must sort before calling — test that sorted order matters
    const sorted = [10, 20, 30, 40, 50]
    expect(percentile(sorted, 0.5)).toBe(30)
  })
})
```

### Step 2: Run test to verify it fails
```bash
cd ~/Code/war-room && npx vitest run __tests__/unit/db-performance.test.ts
```
Expected: FAIL — `percentile` not found

### Step 3: Create `lib/db-performance.ts`

```typescript
import { createClient } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SlowQuery {
  query:    string
  calls:    number
  meanMs:   number
  minMs:    number
  maxMs:    number
  stddevMs: number
  totalMs:  number
  avgRows:  number
}

export interface TableHealthStat {
  tableName:         string
  seqScans:          number
  idxScans:          number
  seqTupRead:        number
  nLiveTup:          number
  missingIndexRisk:  'high' | 'medium' | 'low'
}

export interface DbPerformanceStats {
  available:    boolean          // false when pg_stat_statements unavailable
  slowQueries:  SlowQuery[]
  tableHealth:  TableHealthStat[]
  p50MeanMs:    number | null    // p50 of mean_exec_time across slow queries
  p95MeanMs:    number | null    // p95 of mean_exec_time across slow queries
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Nearest-rank percentile.
 * Input array MUST already be sorted ascending.
 */
export function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  const idx = Math.ceil(sorted.length * p) - 1
  return sorted[Math.max(0, idx)]
}

// ─── Fetcher ──────────────────────────────────────────────────────────────────

/**
 * Fetch DB-level performance stats via Supabase RPC.
 * Gracefully returns { available: false } on any failure so
 * the cron job keeps running even if pg_stat_statements is off.
 */
export async function fetchDbPerformanceStats(): Promise<DbPerformanceStats> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const [slowResult, tableResult] = await Promise.all([
      supabase.rpc('get_slow_query_stats', { p_min_calls: 5, p_min_mean_ms: 50 }),
      supabase.rpc('get_table_health'),
    ])

    if (slowResult.error || tableResult.error) {
      console.warn('[db-perf] RPC error:', slowResult.error || tableResult.error)
      return { available: false, slowQueries: [], tableHealth: [], p50MeanMs: null, p95MeanMs: null }
    }

    const slowQueries: SlowQuery[] = (slowResult.data ?? []).map((row: Record<string, unknown>) => ({
      query:    String(row.query),
      calls:    Number(row.calls),
      meanMs:   Number(row.mean_exec_time),
      minMs:    Number(row.min_exec_time),
      maxMs:    Number(row.max_exec_time),
      stddevMs: Number(row.stddev_exec_time),
      totalMs:  Number(row.total_exec_time),
      avgRows:  Number(row.avg_rows),
    }))

    const tableHealth: TableHealthStat[] = (tableResult.data ?? []).map((row: Record<string, unknown>) => ({
      tableName:        String(row.table_name),
      seqScans:         Number(row.seq_scans),
      idxScans:         Number(row.idx_scans),
      seqTupRead:       Number(row.seq_tup_read),
      nLiveTup:         Number(row.n_live_tup),
      missingIndexRisk: row.missing_index_risk as 'high' | 'medium' | 'low',
    }))

    // P50/P95 across all slow query mean execution times
    const meanTimes = slowQueries.map((q) => q.meanMs).sort((a, b) => a - b)
    const p50MeanMs = percentile(meanTimes, 0.5)
    const p95MeanMs = percentile(meanTimes, 0.95)

    return { available: true, slowQueries, tableHealth, p50MeanMs, p95MeanMs }
  } catch (err) {
    console.warn('[db-perf] Failed to fetch performance stats:', err)
    return { available: false, slowQueries: [], tableHealth: [], p50MeanMs: null, p95MeanMs: null }
  }
}
```

### Step 4: Run test to verify it passes
```bash
cd ~/Code/war-room && npx vitest run __tests__/unit/db-performance.test.ts
```
Expected: PASS (4 tests)

### Step 5: Commit
```bash
git add lib/db-performance.ts __tests__/unit/db-performance.test.ts
git commit -m "feat: add db-performance module with percentile util and pg_stat_statements fetcher"
```

---

## Task 3: Fix `latencyMs` in `query-analyzer.ts` (line 73–90 + 274–297)

**Files:**
- Modify: `lib/query-analyzer.ts:1-36` (add imports + types)
- Modify: `lib/query-analyzer.ts:73-90` (`fetchResponse` return type)
- Modify: `lib/query-analyzer.ts:95-183` (`evaluateQuery` signature)
- Modify: `lib/query-analyzer.ts:274-320` (`analyzeQueries` — latency computation + db stats)

### Step 1: Write the failing test

Add to `__tests__/unit/db-performance.test.ts`:

```typescript
import { percentile } from '@/lib/db-performance'

describe('app latency p50/p95 computation', () => {
  it('computes correct p50 from latency array', () => {
    // Simulate: 5 queries with latencies [100, 200, 300, 400, 500]
    const latencies = [100, 200, 300, 400, 500].sort((a, b) => a - b)
    expect(percentile(latencies, 0.5)).toBe(300)
  })

  it('filters out null latencies before computing', () => {
    const raw = [100, null, 300, null, 500] as (number | null)[]
    const valid = raw.filter((l): l is number => l !== null).sort((a, b) => a - b)
    expect(percentile(valid, 0.5)).toBe(300)
  })
})
```

### Step 2: Run — should pass (percentile already implemented)
```bash
cd ~/Code/war-room && npx vitest run __tests__/unit/db-performance.test.ts
```
Expected: PASS

### Step 3: Update `lib/query-analyzer.ts`

**3a. Add import + new types at top of file (after line 4):**

Add import:
```typescript
import { fetchDbPerformanceStats, percentile, DbPerformanceStats } from '@/lib/db-performance'
```

Add types to the interfaces block (after `ProposalDraft`):
```typescript
interface AppLatency {
  p50Ms:  number | null
  p95Ms:  number | null
  avgMs:  number | null
}

interface FetchedResponse {
  content:   string | null
  createdAt: string | null
}
```

Add `dbPerformance` and `appLatency` to `AnalysisReport`:
```typescript
interface AnalysisReport {
  period:              { start: string; end: string }
  totalQueries:        number
  avgQualityScore:     number
  avgEfficiencyScore:  number
  criticalIssues:      string[]
  proposals:           ProposalDraft[]
  appLatency:          AppLatency       // NEW
  dbPerformance:       DbPerformanceStats  // NEW
}
```

**3b. Change `fetchResponse()` return type (lines 73–90):**

Old:
```typescript
async function fetchResponse(threadId: string, userMessageTime: string): Promise<string | null> {
  ...
  return data?.content || null
}
```

New:
```typescript
async function fetchResponse(threadId: string, userMessageTime: string): Promise<FetchedResponse> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data } = await supabase
    .from('chat_messages')
    .select('content, created_at')
    .eq('thread_id', threadId)
    .eq('role', 'assistant')
    .gt('created_at', userMessageTime)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  return {
    content:   data?.content   ?? null,
    createdAt: data?.created_at ?? null,
  }
}
```

**3c. Add `latencyMs` param to `evaluateQuery()` (lines 95–183):**

Change signature from:
```typescript
async function evaluateQuery(
  query: string,
  response: string | null,
  queryId: string,
  timestamp: string
): Promise<QueryMetrics>
```

To:
```typescript
async function evaluateQuery(
  query: string,
  response: string | null,
  queryId: string,
  timestamp: string,
  latencyMs: number | null
): Promise<QueryMetrics>
```

And in both return paths inside `evaluateQuery`, replace `latencyMs: null` with `latencyMs`.

**3d. Update `analyzeQueries()` (lines 274–321):**

Replace the query evaluation loop and add DB stats:

```typescript
export async function analyzeQueries(): Promise<AnalysisReport> {
  // Fetch queries + DB stats concurrently
  const [queries, dbPerformance] = await Promise.all([
    fetchRecentQueries(),
    fetchDbPerformanceStats(),
  ])

  if (queries.length === 0) {
    return {
      period: {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        end:   new Date().toISOString(),
      },
      totalQueries:       0,
      avgQualityScore:    0,
      avgEfficiencyScore: 0,
      criticalIssues:     ['No queries found in last 24h'],
      proposals:          [],
      appLatency:         { p50Ms: null, p95Ms: null, avgMs: null },
      dbPerformance,
    }
  }

  // Evaluate each query (with latency from response timestamps)
  const metrics: QueryMetrics[] = []
  for (const query of queries) {
    const { content: responseContent, createdAt: responseAt } = await fetchResponse(
      query.thread_id,
      query.created_at
    )
    const latencyMs = responseAt
      ? new Date(responseAt).getTime() - new Date(query.created_at).getTime()
      : null
    const metric = await evaluateQuery(query.content, responseContent, query.id, query.created_at, latencyMs)
    metrics.push(metric)
  }

  // App-level latency stats (p50/p95)
  const validLatencies = metrics
    .map((m) => m.latencyMs)
    .filter((l): l is number => l !== null)
    .sort((a, b) => a - b)

  const appLatency: AppLatency = {
    p50Ms: percentile(validLatencies, 0.5),
    p95Ms: percentile(validLatencies, 0.95),
    avgMs: validLatencies.length > 0
      ? validLatencies.reduce((s, l) => s + l, 0) / validLatencies.length
      : null,
  }

  const proposals = generateProposals(metrics, dbPerformance)

  const avgQuality    = metrics.reduce((sum, m) => sum + m.qualityScore,    0) / metrics.length
  const avgEfficiency = metrics.reduce((sum, m) => sum + m.efficiencyScore, 0) / metrics.length

  const criticalIssues = metrics
    .filter((m) => m.qualityScore < 5)
    .map((m) => `Low quality response (${m.qualityScore}/10): "${m.query}"`)

  return {
    period: {
      start: queries[0].created_at,
      end:   queries[queries.length - 1].created_at,
    },
    totalQueries:       queries.length,
    avgQualityScore:    avgQuality,
    avgEfficiencyScore: avgEfficiency,
    criticalIssues,
    proposals,
    appLatency,
    dbPerformance,
  }
}
```

**3e. Update `generateProposals()` signature to accept `dbPerformance`:**

```typescript
function generateProposals(metrics: QueryMetrics[], dbPerformance: DbPerformanceStats): ProposalDraft[] {
```

Add after existing proposals generation logic:

```typescript
  // ── DB Performance Proposals ──────────────────────────────────────────────

  if (dbPerformance.available) {
    // Slow query proposals
    const criticalSlowQueries = dbPerformance.slowQueries.filter((q) => q.meanMs > 500)
    if (criticalSlowQueries.length > 0) {
      const examples = criticalSlowQueries
        .slice(0, 2)
        .map((q) => `${q.meanMs.toFixed(0)}ms avg (${q.calls} calls): "${q.query.slice(0, 80)}..."`)
        .join('\n')

      proposals.push({
        title: `Optimize ${criticalSlowQueries.length} Slow DB Queries (>500ms avg)`,
        description: `pg_stat_statements detected slow queries:\n${examples}\nConsider: query plan analysis (EXPLAIN ANALYZE), index additions, query rewriting.`,
        domain: 'engineering',
        priority: 'high',
      })
    }

    // Missing index proposals
    const highRiskTables = dbPerformance.tableHealth.filter((t) => t.missingIndexRisk === 'high')
    if (highRiskTables.length > 0) {
      const tableList = highRiskTables
        .map((t) => `${t.tableName} (${t.seqScans.toLocaleString()} seq scans, ${t.nLiveTup.toLocaleString()} rows)`)
        .join(', ')

      proposals.push({
        title: `Add Indexes to ${highRiskTables.length} High-Scan Tables`,
        description: `Tables with high sequential scan ratios (likely missing indexes): ${tableList}. Run EXPLAIN ANALYZE on common queries against these tables.`,
        domain: 'engineering',
        priority: 'high',
      })
    }

    // P95 latency warning
    if (dbPerformance.p95MeanMs !== null && dbPerformance.p95MeanMs > 1000) {
      proposals.push({
        title: 'DB Query P95 Latency Exceeds 1s',
        description: `P95 mean execution time is ${dbPerformance.p95MeanMs.toFixed(0)}ms. The 95th percentile of slow query mean times is over 1 second. Review top slow queries and consider connection pooling (PgBouncer) or query caching.`,
        domain: 'engineering',
        priority: 'medium',
      })
    }
  }

  return proposals
}
```

### Step 4: Build check (catches type errors)
```bash
cd ~/Code/war-room && npx tsc --noEmit 2>&1 | head -30
```
Expected: no output (0 errors)

### Step 5: Commit
```bash
git add lib/query-analyzer.ts
git commit -m "fix: compute appLatency from response timestamps, integrate dbPerformance into analyzeQueries"
```

---

## Task 4: Extend Cron Route Response

**Files:**
- Modify: `app/api/cron/analyze-queries/route.ts:51-62`

### Step 1: Update the response JSON

Replace the return statement in the route (lines 51–62):

Old:
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
  },
  durationMs: duration,
})
```

New:
```typescript
return NextResponse.json({
  success: true,
  report: {
    period:             report.period,
    totalQueries:       report.totalQueries,
    avgQualityScore:    report.avgQualityScore,
    avgEfficiencyScore: report.avgEfficiencyScore,
    criticalIssues:     report.criticalIssues,
    proposalsCreated,
    appLatency: {
      p50Ms: report.appLatency.p50Ms,
      p95Ms: report.appLatency.p95Ms,
      avgMs: report.appLatency.avgMs,
    },
    dbPerformance: {
      available:     report.dbPerformance.available,
      slowQueryCount: report.dbPerformance.slowQueries.length,
      p50MeanMs:     report.dbPerformance.p50MeanMs,
      p95MeanMs:     report.dbPerformance.p95MeanMs,
      highRiskTables: report.dbPerformance.tableHealth
        .filter((t) => t.missingIndexRisk === 'high')
        .map((t) => t.tableName),
    },
  },
  durationMs: duration,
})
```

### Step 2: Build check
```bash
cd ~/Code/war-room && npx tsc --noEmit 2>&1 | head -20
```
Expected: no output

### Step 3: Commit
```bash
git add app/api/cron/analyze-queries/route.ts
git commit -m "feat: surface appLatency and dbPerformance summary in cron route response"
```

---

## Task 5: Run Full Test Suite + Build

### Step 1: Run all unit tests
```bash
cd ~/Code/war-room && npx vitest run __tests__/unit/
```
Expected: all PASS

### Step 2: Full build
```bash
cd ~/Code/war-room && npm run build 2>&1 | tail -20
```
Expected: `✓ Compiled successfully`

### Step 3: Final commit if clean
```bash
git status
```

---

## Verification

After deploying migration to Supabase:

1. **Test RPC via Supabase SQL editor:**
   ```sql
   select * from get_slow_query_stats(1, 0);
   select * from get_table_health();
   ```
   Expected: rows returned (or empty if no queries tracked yet)

2. **Trigger cron manually:**
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" \
     https://your-war-room.vercel.app/api/cron/analyze-queries
   ```
   Expected: response includes `appLatency.p50Ms`, `dbPerformance.available: true`

3. **Check pg_stat_statements is tracking queries** — run some queries in the app first, then check `get_slow_query_stats(1, 0)` for results.

---

## Rollback

```bash
# Remove migration (before applying to prod)
rm supabase/migrations/20260228000000_db_perf_rpcs.sql

# Revert query-analyzer.ts
git revert HEAD~2

# Drop RPC functions if already applied
drop function if exists get_slow_query_stats(int, float);
drop function if exists get_table_health();
```

## Out of Scope

- pgBadger log analysis (no log file access on Supabase cloud)
- Per-request DB query tracing (requires middleware instrumentation — defer until query volume justifies it)
- Storing historical DB performance snapshots (defer — add `db_perf_snapshots` table only if trending data needed)
- `pg_stat_activity` live query monitoring (operational concern, not batch analytics)
