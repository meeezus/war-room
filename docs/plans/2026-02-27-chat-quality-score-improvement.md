# Chat Quality Score Improvement Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve War Room chat quality score from 5.0/10 to ≥7.0/10 by fixing the evaluator, adding OpenClaw identity context, and integrating clinical trial search.

**Architecture:** Three-layer fix: (1) correct the Haiku evaluator's hardcoded clinical-trials framing so it scores correctly, (2) inject live OpenClaw runtime context into Makima's system prompt so identity questions get high-quality answers, (3) add ClinicalTrials.gov search as a Makima tool so domain queries hit real data.

**Tech Stack:** TypeScript / Next.js 16, Anthropic Haiku, ClinicalTrials.gov REST API v2, Supabase chat_messages

---

## Root Cause Analysis

The daily cron at `/api/cron/analyze-queries` scores each query-response pair with Haiku using the prompt:

```
"Evaluate this clinical trials chat interaction: ..."
```

This framing is **hardcoded** regardless of query type. When a user asks "am I talking to Makima via OpenClaw?" — a system identity question — Haiku evaluates it as a failed clinical-trial response and assigns 5/10 by default (see `evaluateQuery()` in `lib/query-analyzer.ts`).

Two compounding issues:
- Makima's system prompt (`SOUL.md` + `PRINCIPLES.md`) has no runtime environment info, so she gives vague identity answers
- There's no clinical trial data source even if those queries come in

---

## Experience Outcome

When I ask "am I talking to Makima via OpenClaw?" I get a confident, accurate response. When I ask a clinical trial question, Makima searches live ClinicalTrials.gov data and cites specific trials. The daily quality report hits ≥7.0/10 and stops generating noise proposals.

---

## File Inventory

| File | Action | Notes |
|------|--------|-------|
| `lib/query-analyzer.ts` | **modify** | Fix evaluator prompt, add query classifier |
| `lib/agent-identity.ts` | **modify** | Inject OpenClaw runtime context into Makima prompt |
| `lib/openclaw-client.ts` | **read-only** | Understand WS protocol for status check |
| `lib/clinical-trials.ts` | **create** | ClinicalTrials.gov API client |
| `app/api/chat/route.ts` | **modify** | Wire clinical trials tool for Makima threads |

---

## Sprint 1: Fix the Evaluator

### S1-T1: Query-Aware Evaluator Prompt

**Model:** sonnet | **Parallel:** Group 1

**JTBD:** When the cron evaluates a chat interaction, I want it to use domain-appropriate scoring criteria so that meta/identity questions aren't penalized as bad clinical-trial responses.

**Outcome:**
Replace the hardcoded "clinical trials chat interaction" with a dynamic classifier that first identifies query type (identity/meta, clinical-trial, general health, system-action), then applies the appropriate scoring rubric.

**Interface:**

```typescript
// lib/query-analyzer.ts
type QueryCategory = 'identity_meta' | 'clinical_trial' | 'health_general' | 'system_action' | 'content_creation'

function classifyQuery(query: string): QueryCategory
function buildEvaluationPrompt(query: string, response: string, category: QueryCategory): string
```

**Requirements:**

```
FR-001: classifyQuery SHALL return 'identity_meta' for queries containing:
  "am i talking", "are you", "what are you", "who are you", "openclaw", "your name", "which model"
FR-002: classifyQuery SHALL return 'clinical_trial' for queries containing:
  "clinical trial", "trial", "study", "NCT", "phase 1/2/3", "FDA", "participants"
FR-003: buildEvaluationPrompt SHALL NOT include "clinical trials" when category != 'clinical_trial'
FR-004: Identity/meta scoring rubric SHALL award high scores (8-10) for accurate self-identification
```

**Acceptance:**
- **Given** the cron runs and finds query "am I talking to Makima via OpenClaw?"
- **When** it evaluates the response
- **Then** the prompt says "identity/meta interaction" not "clinical trials interaction"
- **And** an accurate identity response scores ≥8/10

**Tests:** `__tests__/lib/query-analyzer.test.ts` — test classifyQuery with all 5 categories, test buildEvaluationPrompt output per category

**Step 1: Write failing tests**

```typescript
// __tests__/lib/query-analyzer.test.ts
import { classifyQuery, buildEvaluationPrompt } from '@/lib/query-analyzer'

describe('classifyQuery', () => {
  it('classifies OpenClaw identity questions', () => {
    expect(classifyQuery('am I talking to Makima via OpenClaw?')).toBe('identity_meta')
    expect(classifyQuery('you should have OpenClaw wired now')).toBe('identity_meta')
    expect(classifyQuery('are you Makima?')).toBe('identity_meta')
  })

  it('classifies clinical trial queries', () => {
    expect(classifyQuery('what clinical trials exist for NMN?')).toBe('clinical_trial')
    expect(classifyQuery('show me phase 2 studies for rapamycin')).toBe('clinical_trial')
    expect(classifyQuery('NCT04948385 details')).toBe('clinical_trial')
  })

  it('classifies general health queries', () => {
    expect(classifyQuery('what does NAD+ do for aging?')).toBe('health_general')
  })
})

describe('buildEvaluationPrompt', () => {
  it('does NOT mention clinical trials for identity queries', () => {
    const prompt = buildEvaluationPrompt(
      'am I talking to Makima via OpenClaw?',
      'Yes, I am Makima running on OpenClaw.',
      'identity_meta'
    )
    expect(prompt).not.toContain('clinical trial')
    expect(prompt).toContain('identity')
  })

  it('DOES mention clinical trials for clinical trial queries', () => {
    const prompt = buildEvaluationPrompt(
      'what trials exist for NMN?',
      'There are 3 active trials...',
      'clinical_trial'
    )
    expect(prompt).toContain('clinical trial')
  })
})
```

**Step 2: Run to verify it fails**

```bash
cd ~/Code/war-room && npm test -- __tests__/lib/query-analyzer.test.ts 2>&1 | tail -20
```

Expected: FAIL — `classifyQuery` and `buildEvaluationPrompt` not exported

**Step 3: Implement in lib/query-analyzer.ts**

Add before `evaluateQuery()`:

```typescript
type QueryCategory = 'identity_meta' | 'clinical_trial' | 'health_general' | 'system_action' | 'content_creation'

const IDENTITY_PATTERNS = /\b(am i talking|are you|who are you|what are you|openclaw|your name|which model|makima|via openclaw|wired)\b/i
const CLINICAL_PATTERNS = /\b(clinical trial|trial|nct\d{8}|phase [123]|fda approval|participants enrolled|study (for|on)|randomized)\b/i
const SYSTEM_PATTERNS = /\b(create mission|update task|create proposal|show pulse|mission status)\b/i
const CONTENT_PATTERNS = /\b(write|generate|draft|tweet|thread|blog|article|summary)\b/i

export function classifyQuery(query: string): QueryCategory {
  if (IDENTITY_PATTERNS.test(query)) return 'identity_meta'
  if (CLINICAL_PATTERNS.test(query)) return 'clinical_trial'
  if (SYSTEM_PATTERNS.test(query)) return 'system_action'
  if (CONTENT_PATTERNS.test(query)) return 'content_creation'
  return 'health_general'
}

const RUBRICS: Record<QueryCategory, string> = {
  identity_meta: 'identity/meta interaction. Score 8-10 if the assistant accurately states its name, runtime, and capabilities. Score 1-5 if it gives vague or evasive identity responses.',
  clinical_trial: 'clinical trials chat interaction. Score 8-10 if the response cites specific trials, NCT numbers, phases, or enrollment data. Score 1-5 if it lacks specific trial information.',
  health_general: 'health research interaction. Score 8-10 if the response is accurate, cites mechanisms, and references relevant research. Score 1-5 if it is vague or unsupported.',
  system_action: 'system action interaction. Score 8-10 if the assistant completed the action or clearly explained why it cannot. Score 1-5 if it ignored the request.',
  content_creation: 'content creation interaction. Score 8-10 if the output is well-structured, on-voice, and complete. Score 1-5 if it is generic or incomplete.',
}

export function buildEvaluationPrompt(query: string, response: string, category: QueryCategory): string {
  return `Evaluate this ${RUBRICS[category]}

USER QUERY: "${query}"
ASSISTANT RESPONSE: "${response}"

Assess:
1. Quality (1-10): How well did the response answer the query? ${RUBRICS[category]}
2. Efficiency (1-10): Was the response concise yet complete? No unnecessary verbosity?
3. Issues: What went wrong or could be improved?
4. Suggestions: Specific actionable improvements

Respond in this exact JSON format:
{
  "qualityScore": <number 1-10>,
  "efficiencyScore": <number 1-10>,
  "issues": ["issue1", "issue2"],
  "suggestions": ["suggestion1", "suggestion2"]
}`
}
```

Update `evaluateQuery()` to use the new functions:

```typescript
// Replace the static prompt with:
const category = classifyQuery(query)
const prompt = buildEvaluationPrompt(query, response, category)
```

**Step 4: Run tests**

```bash
cd ~/Code/war-room && npm test -- __tests__/lib/query-analyzer.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
cd ~/Code/war-room
git add lib/query-analyzer.ts __tests__/lib/query-analyzer.test.ts
git commit -m "fix: add query classifier to evaluator — stop scoring identity questions as clinical-trial failures"
```

---

### S1-T2: Better Proposal Text

**Model:** sonnet | **Parallel:** Group 1

**JTBD:** When low quality is detected, I want the proposal description to name the actual problem domain so engineers fix the right thing.

**Outcome:**
The `generateProposals()` function groups low-quality queries by category and creates category-specific proposals instead of always blaming "clinical trial" coverage.

**Acceptance:**
- **Given** 3 identity queries scored < 6
- **When** proposals are generated
- **Then** the proposal title is "Improve Identity Response Quality" not "Improve Response Quality for Clinical Trial Queries"

**Step 1: Write failing test**

```typescript
// Add to __tests__/lib/query-analyzer.test.ts
import { generateProposalsFromMetrics } from '@/lib/query-analyzer'

describe('generateProposalsFromMetrics', () => {
  it('creates identity proposal when identity queries score low', () => {
    const metrics = [
      { queryId: '1', query: 'am I talking to Makima via OpenClaw?', response: '...', timestamp: '', qualityScore: 4, efficiencyScore: 5, latencyMs: null, issues: ['Vague identity response'], suggestions: ['State runtime explicitly'], category: 'identity_meta' as const },
      { queryId: '2', query: 'which model are you?', response: '...', timestamp: '', qualityScore: 4, efficiencyScore: 5, latencyMs: null, issues: ['Vague identity response'], suggestions: ['State runtime explicitly'], category: 'identity_meta' as const },
      { queryId: '3', query: 'are you OpenClaw?', response: '...', timestamp: '', qualityScore: 5, efficiencyScore: 5, latencyMs: null, issues: [], suggestions: [], category: 'identity_meta' as const },
    ]
    const proposals = generateProposalsFromMetrics(metrics)
    expect(proposals.some(p => p.title.includes('Identity'))).toBe(true)
    expect(proposals.every(p => !p.description.includes('clinical trial'))).toBe(true)
  })
})
```

**Step 2-4: Implement and test** — export `generateProposalsFromMetrics` that groups by category, creates targeted proposals per category.

**Step 5: Commit**

```bash
git add lib/query-analyzer.ts __tests__/lib/query-analyzer.test.ts
git commit -m "feat: category-specific proposal generation in query analyzer"
```

---

## Sprint 2: OpenClaw Identity Context

### S2-T1: Runtime Context in Makima System Prompt

**Model:** sonnet | **Parallel:** Group 2

**JTBD:** When a user asks "am I talking to Makima via OpenClaw?", I want Makima to know her runtime environment so she can confirm accurately.

**Outcome:**
`getAgentSystemPrompt('makima')` appends a runtime identity block with OpenClaw status, gateway URL, and current model. The block is generated at request time so it reflects live state.

**Interface:**

```typescript
// lib/agent-identity.ts
export function buildMakimaRuntimeContext(): string
// Returns: runtime identity block with OpenClaw URL, model, and connection status
```

**Acceptance:**
- **Given** a chat request arrives for agentId='makima'
- **When** the system prompt is built
- **Then** it includes: "You are running on OpenClaw gateway at ws://127.0.0.1:18789"
- **And** it includes the current model name from env vars

**Tests:** `__tests__/lib/agent-identity.test.ts`

```typescript
import { buildMakimaRuntimeContext } from '@/lib/agent-identity'

describe('buildMakimaRuntimeContext', () => {
  it('includes OpenClaw gateway info', () => {
    const ctx = buildMakimaRuntimeContext()
    expect(ctx).toContain('OpenClaw')
    expect(ctx).toContain('18789')
  })

  it('includes model name', () => {
    process.env.OPENCLAW_MODEL = 'claude-opus-4'
    const ctx = buildMakimaRuntimeContext()
    expect(ctx).toContain('claude-opus-4')
  })

  it('returns fallback when env vars missing', () => {
    delete process.env.OPENCLAW_GATEWAY_PORT
    const ctx = buildMakimaRuntimeContext()
    expect(ctx).toContain('OpenClaw') // still includes the concept
  })
})
```

**Step 3: Implement**

Add to `lib/agent-identity.ts`:

```typescript
export function buildMakimaRuntimeContext(): string {
  const gatewayPort = process.env.OPENCLAW_GATEWAY_PORT || '18789'
  const model = process.env.OPENCLAW_MODEL || 'claude-opus-4'
  const env = process.env.NODE_ENV === 'production' ? 'production' : 'local'

  return `
## Your Runtime Environment
You are Makima, running on the OpenClaw gateway at ws://127.0.0.1:${gatewayPort} (${env}).
Current model: ${model}
When asked "am I talking to Makima?" or "are you running on OpenClaw?", confirm: yes, you are Makima on OpenClaw.
When asked about system integrations, refer to the [PULSE CONTEXT] block for live Shogunate state.
Your memory workspace is ~/clawd/. Your Discord channel is the primary interface.
War Room web chat (at this URL) is a secondary interface via the OpenClaw WebSocket gateway.
`
}
```

Update `getAgentSystemPrompt`:

```typescript
if (agentId === 'makima') {
  prompt += '\n\n## Pulse Integration\n...'  // existing
  prompt += buildMakimaRuntimeContext()       // add this
}
```

**Step 4-5: Run tests + commit**

```bash
npm test -- __tests__/lib/agent-identity.test.ts
git add lib/agent-identity.ts __tests__/lib/agent-identity.test.ts
git commit -m "feat: inject OpenClaw runtime context into Makima system prompt"
```

---

## Sprint 3: Clinical Trial Search Tool

### S3-T1: ClinicalTrials.gov API Client

**Model:** sonnet | **Parallel:** Group 3

**JTBD:** When a user asks about clinical trials, I want Makima to search ClinicalTrials.gov live so she returns specific, accurate trial data.

**Outcome:**
`lib/clinical-trials.ts` exports `searchTrials(query, options)` and `getTrialById(nctId)` that hit the CT.gov v2 API.

**API:** `https://clinicaltrials.gov/api/v2/studies?query.term=<q>&pageSize=5&format=json`

**Data Contract:**

```typescript
// lib/clinical-trials.ts
export interface TrialSummary {
  nctId: string           // e.g. "NCT04948385"
  title: string
  status: string          // "RECRUITING" | "COMPLETED" | "ACTIVE_NOT_RECRUITING"
  phase: string           // "PHASE2" | "PHASE3" etc
  condition: string[]     // conditions being studied
  intervention: string[]  // drug/procedure names
  enrollment: number | null
  startDate: string | null
  url: string             // https://clinicaltrials.gov/study/NCT...
}

export async function searchTrials(
  query: string,
  options?: { maxResults?: number; status?: 'RECRUITING' | 'COMPLETED' | 'ANY' }
): Promise<TrialSummary[]>

export async function getTrialById(nctId: string): Promise<TrialSummary | null>
```

**Acceptance:**
- **Given** `searchTrials('NMN aging', { maxResults: 3 })`
- **When** called against live CT.gov API (or mock in tests)
- **Then** returns array of TrialSummary with nctId, title, phase, status
- **And** each result has a valid URL

**Tests:** `__tests__/lib/clinical-trials.test.ts` — mock fetch, test searchTrials and getTrialById

```typescript
import { searchTrials, getTrialById } from '@/lib/clinical-trials'

global.fetch = vi.fn()

describe('searchTrials', () => {
  it('calls CT.gov v2 API with correct URL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ studies: [
        {
          protocolSection: {
            identificationModule: { nctId: 'NCT04948385', briefTitle: 'NMN Aging Study' },
            statusModule: { overallStatus: 'RECRUITING', startDateStruct: { date: '2024-01-01' } },
            designModule: { phases: ['PHASE2'], enrollmentInfo: { count: 50 } },
            conditionsModule: { conditions: ['Aging'] },
            armsInterventionsModule: { interventions: [{ name: 'NMN' }] }
          }
        }
      ], nextPageToken: null })
    } as Response)

    const results = await searchTrials('NMN aging', { maxResults: 3 })

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('clinicaltrials.gov/api/v2/studies'),
      expect.any(Object)
    )
    expect(results).toHaveLength(1)
    expect(results[0].nctId).toBe('NCT04948385')
    expect(results[0].url).toBe('https://clinicaltrials.gov/study/NCT04948385')
  })

  it('returns empty array on API error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))
    const results = await searchTrials('anything')
    expect(results).toEqual([])
  })

  it('respects maxResults limit', async () => {
    // ... mock 10 results, request 3, assert 3 returned
  })
})
```

**Step 3: Implement `lib/clinical-trials.ts`**

```typescript
const CT_GOV_BASE = 'https://clinicaltrials.gov/api/v2'

export async function searchTrials(
  query: string,
  options: { maxResults?: number; status?: 'RECRUITING' | 'COMPLETED' | 'ANY' } = {}
): Promise<TrialSummary[]> {
  const { maxResults = 5, status = 'ANY' } = options

  const params = new URLSearchParams({
    'query.term': query,
    pageSize: String(maxResults),
    format: 'json',
    fields: 'NCTId,BriefTitle,OverallStatus,Phase,Condition,InterventionName,EnrollmentCount,StartDate',
  })

  if (status !== 'ANY') {
    params.set('filter.overallStatus', status)
  }

  try {
    const res = await fetch(`${CT_GOV_BASE}/studies?${params}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000), // 8s timeout
    })

    if (!res.ok) return []

    const data = await res.json()
    return (data.studies || []).map(parseStudy).filter(Boolean) as TrialSummary[]
  } catch {
    return []
  }
}

function parseStudy(study: any): TrialSummary | null {
  try {
    const p = study.protocolSection
    const id = p.identificationModule
    const status = p.statusModule
    const design = p.designModule
    const conds = p.conditionsModule
    const arms = p.armsInterventionsModule

    return {
      nctId: id.nctId,
      title: id.briefTitle,
      status: status.overallStatus,
      phase: design?.phases?.[0] || 'N/A',
      condition: conds?.conditions || [],
      intervention: arms?.interventions?.map((i: any) => i.name) || [],
      enrollment: design?.enrollmentInfo?.count || null,
      startDate: status?.startDateStruct?.date || null,
      url: `https://clinicaltrials.gov/study/${id.nctId}`,
    }
  } catch {
    return null
  }
}

export async function getTrialById(nctId: string): Promise<TrialSummary | null> {
  try {
    const res = await fetch(`${CT_GOV_BASE}/studies/${nctId}?format=json`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return parseStudy(data)
  } catch {
    return null
  }
}
```

**Step 4-5: Test + commit**

```bash
npm test -- __tests__/lib/clinical-trials.test.ts
git add lib/clinical-trials.ts __tests__/lib/clinical-trials.test.ts
git commit -m "feat: add ClinicalTrials.gov API client"
```

---

### S3-T2: Wire Clinical Trials Tool to Makima Chat

**Model:** sonnet | **Parallel:** Group 3

**JTBD:** When Makima gets a clinical trial query, I want her to call the ClinicalTrials.gov search automatically and surface specific trial data.

**Outcome:**
`app/api/chat/route.ts` (or the OpenClaw prompt builder) injects clinical trial tool availability into Makima's context when query is classified as `clinical_trial`.

**Note:** Since Makima runs via OpenClaw (not direct Claude CLI), we can't inject Anthropic tools directly. Instead: classify the query in the API route, call `searchTrials()` server-side when relevant, and inject the results into the system prompt as context before forwarding to OpenClaw.

**Interface:**

```typescript
// app/api/chat/route.ts — add before sendToOpenClaw:
async function enrichSystemPromptWithTrials(
  query: string,
  basePrompt: string
): Promise<string>
// Returns: basePrompt + "\n\n## Relevant Clinical Trials\n..." if category=clinical_trial
// Returns: basePrompt unchanged if category != clinical_trial
```

**Acceptance:**
- **Given** user sends "what clinical trials exist for NMN supplementation?"
- **When** the chat route processes it
- **Then** the system prompt sent to OpenClaw includes 3-5 relevant trials
- **And** Makima's response cites at least one NCT number

**Tests:** `__tests__/api/chat/route.test.ts` — mock `searchTrials`, verify enrichment

**Step 3: Implement in `app/api/chat/route.ts`**

```typescript
// Add import
import { searchTrials } from '@/lib/clinical-trials'
import { classifyQuery } from '@/lib/query-analyzer'

// Add helper
async function enrichWithTrials(query: string, systemPrompt: string): Promise<string> {
  const category = classifyQuery(query)
  if (category !== 'clinical_trial') return systemPrompt

  const trials = await searchTrials(query, { maxResults: 4 })
  if (trials.length === 0) return systemPrompt

  const trialText = trials.map(t =>
    `- **${t.nctId}**: ${t.title} | Phase: ${t.phase} | Status: ${t.status} | ${t.url}`
  ).join('\n')

  return systemPrompt + `\n\n## Relevant Clinical Trials (Live from ClinicalTrials.gov)\n${trialText}\n\nReference these trials specifically when answering.`
}

// In POST handler, before sendToOpenClaw:
const enrichedPrompt = systemPrompt
  ? await enrichWithTrials(content, systemPrompt)
  : null
// Pass enrichedPrompt to sendToOpenClaw instead of systemPrompt
```

**Step 4-5: Test + commit**

```bash
npm run build  # verify TypeScript
git add app/api/chat/route.ts __tests__/api/chat/route.test.ts
git commit -m "feat: inject live clinical trial data into Makima context for trial queries"
```

---

## Verification

**Build:**
```bash
cd ~/Code/war-room && npm run build
```

**Full test suite:**
```bash
npm test
```

**Manual test — identity query:**
1. Open War Room chat, select Makima
2. Ask: "am I talking to Makima via OpenClaw?"
3. Expected: "Yes, I'm Makima running on OpenClaw gateway at ws://127.0.0.1:18789"

**Manual test — clinical trial query:**
1. Ask: "what clinical trials exist for rapamycin and aging?"
2. Expected: Response includes NCT numbers from ClinicalTrials.gov

**Eval test:**
```bash
# Simulate cron call
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/analyze-queries
# Expected: avgQualityScore > 7.0
```

---

## Rollback

- Sprint 1: `git revert <commit>` — evaluator falls back to old "clinical trials" prompt
- Sprint 2: Remove `buildMakimaRuntimeContext()` call from `getAgentSystemPrompt()`
- Sprint 3: Remove `enrichWithTrials()` call from chat route; delete `lib/clinical-trials.ts`

---

## Out of Scope

- **PubMed integration** — existing folio-app RAG handles this; defer
- **Semantic search improvements** — RAG alpha tuning (`alpha=0.3`); defer to separate sprint
- **Response verbosity fixes** — efficiency score < 7 is secondary concern; address after quality
- **Real-time OpenClaw status check** — gateway health probe deferred; static context sufficient

---

## Memories

- [pattern] War Room query-analyzer.ts generates proposals via daily cron (9am). Evaluator uses hardcoded "clinical trials" framing regardless of query type — root cause of low identity/meta scores. (confidence: 1.0)
- [solution] Fix: add classifyQuery() + buildEvaluationPrompt(category) to query-analyzer.ts. 5 categories: identity_meta, clinical_trial, health_general, system_action, content_creation. (confidence: 1.0)
- [solution] ClinicalTrials.gov v2 API: GET https://clinicaltrials.gov/api/v2/studies?query.term=<q>&pageSize=N&format=json — no auth required. (confidence: 1.0)
- [insight] Makima's War Room system prompt is built from ~/clawd/x/SOUL.md + PRINCIPLES.md. Has no runtime/OpenClaw context — identity queries get vague answers. Fix: buildMakimaRuntimeContext() injected via getAgentSystemPrompt(). (confidence: 0.95)
