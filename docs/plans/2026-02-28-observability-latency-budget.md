# Observability: Latency Tracking + Budget Gate Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace two hardcoded stubs (`latencyMs: null` and `budgetOk: true`) with real observability data so the engine dashboard reflects actual system performance.

**Architecture:**
- `latencyMs`: computed from `chat_messages` DB timestamps (user `created_at` → assistant `created_at`) — no new columns needed, just fetch `created_at` from the assistant message already queried by `fetchResponse`.
- `budgetOk`: new `cap_gates` DB table stores daily budget cap; engine-status sums `missions.cost_estimate` for today and compares against cap.

**Tech Stack:** TypeScript, Supabase (PostgREST), Vitest, Next.js App Router

---

## Task 1: Fetch assistant `created_at` in `fetchResponse`

**Files:**
- Modify: `lib/query-analyzer.ts:73-90`
- Test: `tests/unit/query-analyzer-latency.test.ts` (create)

### Step 1: Write the failing test

```typescript
// tests/unit/query-analyzer-latency.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase before import
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockGt = vi.fn()
const mockOrder = vi.fn()
const mockLimit = vi.fn()
const mockSingle = vi.fn()
const mockFrom = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

// Also mock anthropic (used at module level)
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => ({ messages: { create: vi.fn() } })),
}))
vi.mock('@/lib/sentry', () => ({ captureError: vi.fn() }))

// Import after mocks
const { evaluateQuery } = await import('../../lib/query-analyzer')

describe('latencyMs tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Chain: from().select().eq().eq().gt().order().limit().single()
    mockSingle.mockResolvedValue({
      data: { content: 'Response text', created_at: '2026-02-28T10:00:05.000Z' },
      error: null,
    })
    mockLimit.mockReturnValue({ single: mockSingle })
    mockOrder.mockReturnValue({ limit: mockLimit })
    mockGt.mockReturnValue({ order: mockOrder })
    mockEq.mockReturnValue({ gt: mockGt, eq: mockEq })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })
  })

  it('returns latencyMs as delta between user message time and assistant created_at', async () => {
    const userMessageTime = '2026-02-28T10:00:00.000Z' // t=0
    // assistant created_at = '2026-02-28T10:00:05.000Z' // t+5000ms
    // Expected: latencyMs = 5000

    const result = await evaluateQuery('What trials exist?', 'Response text', 'query-id-1', userMessageTime)
    expect(result.latencyMs).toBe(5000)
  })

  it('returns latencyMs null when response is null (no assistant message)', async () => {
    const result = await evaluateQuery(null as unknown as string, null, 'query-id-2', '2026-02-28T10:00:00.000Z')
    expect(result.latencyMs).toBeNull()
  })
})
```

### Step 2: Run test to verify it fails

```bash
cd ~/Code/war-room && npx vitest run tests/unit/query-analyzer-latency.test.ts
```

Expected: FAIL — `latencyMs` is `null` not `5000`.

### Step 3: Modify `fetchResponse` to return `created_at`

In `lib/query-analyzer.ts`, change `fetchResponse` return type and query:

```typescript
// Before (line 73-90):
async function fetchResponse(threadId: string, userMessageTime: string): Promise<string | null> {
  // ...
  const { data } = await supabase
    .from('chat_messages')
    .select('content')   // ← only content
    // ...
  return data?.content || null
}

// After:
interface AssistantMessage {
  content: string
  created_at: string
}

async function fetchResponse(threadId: string, userMessageTime: string): Promise<AssistantMessage | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data } = await supabase
    .from('chat_messages')
    .select('content, created_at')  // ← add created_at
    .eq('thread_id', threadId)
    .eq('role', 'assistant')
    .gt('created_at', userMessageTime)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!data) return null
  return { content: data.content, created_at: data.created_at }
}
```

### Step 4: Update `evaluateQuery` to accept and compute latencyMs

In `lib/query-analyzer.ts`, change the `evaluateQuery` signature and usages:

```typescript
// evaluateQuery now receives assistantMessage instead of response string
async function evaluateQuery(
  query: string,
  assistantMessage: AssistantMessage | null,  // ← was: response: string | null
  queryId: string,
  timestamp: string
): Promise<QueryMetrics> {
  const response = assistantMessage?.content || null

  if (!response) {
    return {
      queryId,
      query,
      response: '',
      timestamp,
      qualityScore: 0,
      efficiencyScore: 0,
      latencyMs: null,  // no assistant message → no latency
      issues: ['No response found'],
      suggestions: ['Investigate why query had no response'],
    }
  }

  // Compute actual response latency from DB timestamps
  const latencyMs = assistantMessage?.created_at
    ? Math.round(new Date(assistantMessage.created_at).getTime() - new Date(timestamp).getTime())
    : null

  // ... rest of function unchanged except:
  return {
    queryId,
    query,
    response,
    timestamp,
    qualityScore: evaluation.qualityScore,
    efficiencyScore: evaluation.efficiencyScore,
    latencyMs,  // ← real value now
    issues: evaluation.issues,
    suggestions: evaluation.suggestions,
  }
  // error handler:
  // latencyMs,  ← use computed value (not null)
}
```

### Step 5: Update `analyzeQueries` call site

In `lib/query-analyzer.ts` line 295, update the call:

```typescript
// Before:
const response = await fetchResponse(query.thread_id, query.created_at)
const metric = await evaluateQuery(query.content, response, query.id, query.created_at)

// After:
const assistantMessage = await fetchResponse(query.thread_id, query.created_at)
const metric = await evaluateQuery(query.content, assistantMessage, query.id, query.created_at)
```

### Step 6: Run tests to verify they pass

```bash
cd ~/Code/war-room && npx vitest run tests/unit/query-analyzer-latency.test.ts
```

Expected: PASS

### Step 7: Build check

```bash
cd ~/Code/war-room && npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors.

### Step 8: Commit

```bash
cd ~/Code/war-room
git add lib/query-analyzer.ts tests/unit/query-analyzer-latency.test.ts
git commit -m "feat: track actual response latency in query-analyzer from DB timestamps"
```

---

## Task 2: Create `cap_gates` table

**Files:**
- Create: `supabase/migrations/20260228000001_cap_gates.sql`

> Note: No test needed — this is a pure DDL migration.

### Step 1: Write the migration

```sql
-- cap_gates: daily token budget caps for the Shogunate engine
-- One row per named gate. The global gate (name = 'global') applies engine-wide.
CREATE TABLE IF NOT EXISTS cap_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  daily_budget_usd NUMERIC NOT NULL DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed: global daily budget gate ($50/day default, adjust as needed)
INSERT INTO cap_gates (name, daily_budget_usd, is_active)
VALUES ('global', 50, true)
ON CONFLICT (name) DO NOTHING;

-- RLS: service role manages, anon reads
ALTER TABLE cap_gates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read" ON cap_gates FOR SELECT USING (true);
CREATE POLICY "service_role_all" ON cap_gates FOR ALL USING (auth.role() = 'service_role');
```

### Step 2: Apply migration

```bash
cd ~/Code/war-room
npx supabase db push --include-all
```

Expected: Migration applied, `cap_gates` table exists with one seed row.

### Step 3: Verify

```bash
npx supabase db query "SELECT name, daily_budget_usd, is_active FROM cap_gates;"
```

Expected: `global | 50 | true`

### Step 4: Commit

```bash
git add supabase/migrations/20260228000001_cap_gates.sql
git commit -m "feat: add cap_gates table for daily budget tracking"
```

---

## Task 3: Implement real `budgetOk` in engine-status

**Files:**
- Modify: `app/api/engine-status/route.ts:22-57` (Promise.all block) and `:117-127` (response)
- Test: `tests/unit/engine-status-budget.test.ts` (create)

### Step 1: Write the failing test

```typescript
// tests/unit/engine-status-budget.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

// We test budgetOk logic in isolation — mock the supabase queries
const mockFrom = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}))

// Build minimal supabase chain stub
function makeSupabaseChain(returnValue: { data: unknown; error: null; count?: number }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    resolvedValue: returnValue,
  }
  // Make the chain thenable (resolves on await)
  Object.defineProperty(chain, 'then', {
    get() {
      return (resolve: (v: unknown) => void) => resolve(returnValue)
    }
  })
  return chain
}

// Import handler after mocks
const { GET } = await import('../../app/api/engine-status/route')

describe('budgetOk in engine-status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
  })

  it('returns budgetOk true when daily spend is under the cap', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'cap_gates') return makeSupabaseChain({ data: { daily_budget_usd: 50 }, error: null })
      if (table === 'missions' /* daily cost query */) {
        // Return missions with total cost_estimate = 10 (under 50 cap)
        // This is checked by the query that selects cost_estimate with gte completed_at today
        return makeSupabaseChain({ data: [{ cost_estimate: 10 }], error: null })
      }
      return makeSupabaseChain({ data: [], error: null, count: 0 })
    })

    const response = await GET()
    const body = await response.json()
    expect(body.budgetOk).toBe(true)
  })

  it('returns budgetOk false when daily spend exceeds the cap', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'cap_gates') return makeSupabaseChain({ data: { daily_budget_usd: 50 }, error: null })
      if (table === 'missions') return makeSupabaseChain({ data: [{ cost_estimate: 75 }], error: null })
      return makeSupabaseChain({ data: [], error: null, count: 0 })
    })

    const response = await GET()
    const body = await response.json()
    expect(body.budgetOk).toBe(false)
  })

  it('returns budgetOk true when cap_gates has no row (fallback)', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'cap_gates') return makeSupabaseChain({ data: null, error: null })
      if (table === 'missions') return makeSupabaseChain({ data: [{ cost_estimate: 100 }], error: null })
      return makeSupabaseChain({ data: [], error: null, count: 0 })
    })

    const response = await GET()
    const body = await response.json()
    // No cap configured → always ok
    expect(body.budgetOk).toBe(true)
  })
})
```

### Step 2: Run test to verify it fails

```bash
cd ~/Code/war-room && npx vitest run tests/unit/engine-status-budget.test.ts
```

Expected: FAIL — `budgetOk` is always `true` regardless of spend.

### Step 3: Implement budget queries in engine-status

In `app/api/engine-status/route.ts`, add two new parallel queries:

```typescript
// Add to top of GET() after existing time vars:
const startOfToday = new Date()
startOfToday.setHours(0, 0, 0, 0)
const startOfTodayIso = startOfToday.toISOString()

// Add to the Promise.all array (after pendingRes):
const [heartbeatRes, failedRes, winsRes, objectivesRes, objectiveMissionsRes, autoApprovedRes, pendingRes, dailyCostRes, capGateRes] = await Promise.all([
  // ... existing queries unchanged ...

  // Daily spend: sum cost_estimate for missions completed today
  sb.from('missions')
    .select('cost_estimate')
    .gte('completed_at', startOfTodayIso),

  // Budget cap from cap_gates (global gate)
  sb.from('cap_gates')
    .select('daily_budget_usd')
    .eq('name', 'global')
    .eq('is_active', true)
    .single(),
])

// Compute budgetOk:
const dailySpendUsd = (dailyCostRes.data ?? [])
  .reduce((sum: number, m: Record<string, unknown>) => sum + ((m.cost_estimate as number) ?? 0), 0)

const dailyBudgetUsd: number | null = (capGateRes.data as Record<string, unknown> | null)?.daily_budget_usd as number ?? null

const budgetOk = dailyBudgetUsd === null ? true : dailySpendUsd < dailyBudgetUsd

// Replace hardcoded in return:
return NextResponse.json({
  health,
  avgCycleMs,
  budgetOk,  // ← real value
  // ...rest unchanged
})
```

### Step 4: Run tests to verify they pass

```bash
cd ~/Code/war-room && npx vitest run tests/unit/engine-status-budget.test.ts
```

Expected: PASS (all 3 cases).

### Step 5: Build check

```bash
cd ~/Code/war-room && npm run build 2>&1 | tail -20
```

Expected: no errors.

### Step 6: Commit

```bash
cd ~/Code/war-room
git add app/api/engine-status/route.ts tests/unit/engine-status-budget.test.ts
git commit -m "feat: implement real budgetOk check via missions cost + cap_gates"
```

---

## Verification

After all tasks complete:

```bash
# Full test suite
cd ~/Code/war-room && npx vitest run tests/unit/

# Confirm new tests pass
npx vitest run tests/unit/query-analyzer-latency.test.ts
npx vitest run tests/unit/engine-status-budget.test.ts

# Build
npm run build
```

Check engine-status endpoint returns real data:
- `latencyMs` in query evaluation reports is no longer `null` for queries that have an assistant response
- `budgetOk` in `/api/engine-status` returns `false` when `missions.cost_estimate` sum today exceeds `cap_gates.daily_budget_usd`

---

## Notes

- `latencyMs` measures wall-clock response time from the **user's perspective** (user message stored → assistant response stored in DB). This is a proxy for actual response latency — real-time streaming latency is not captured here.
- `cost_estimate` on `missions` is the budget tracking field (added in migration 20260226000007). It defaults to 0, so `budgetOk` will be `true` until the engine starts writing real cost estimates.
- The `cap_gates` table is seeded with `$50/day` global cap. Adjust by updating that row in Supabase.
- `defaultStatus()` in engine-status keeps `budgetOk: true` (safe default when DB is down).
