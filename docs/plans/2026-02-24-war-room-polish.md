# War Room Polish Sprint

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 4 bugs/debt items, add project editing, seed objectives — all independent, parallelizable.

**Architecture:** All tasks touch different files with zero overlap. Dashboard card sizing + chat zinc migration are UI-only. SSE fix and Makima delay are client/server stream fixes. Project editing wires existing PATCH API to new UI controls.

**Tech Stack:** Next.js 15, Tailwind CSS, Supabase, SSE streaming

**Branch:** `feature/war-room-polish`

**Verification:** `npm run build` passes after all tasks.

---

## Sprint 0: Setup

```bash
git checkout main && git pull origin main
git checkout -b feature/war-room-polish
```

---

## Parallel Group 1 (all independent — spawn simultaneously)

### Task 1: Dashboard Card Sizing

**Model:** sonnet | **Parallel:** Group 1

**JTBD:** When I look at the dashboard ribbon, I want all cards to be the same height so the layout looks polished.

**Outcome:** Council and Chat cards match the height of Situation/Patrol/Skills/Objectives/Health cards.

**Files:**
- Modify: `components/status-ribbon.tsx:201-226` (CouncilCard + ChatCard)

**Implementation:**

The other cards (SituationCard, PatrolCard, SkillsCard, etc.) have more content so they're naturally taller. CouncilCard and ChatCard are short (label + one value + one line of text).

Add `min-h-[110px]` and `flex flex-col justify-between` to CouncilCard and ChatCard StealthCard wrappers to match the other cards' rendered height. Do NOT change other cards.

Before (both cards, same pattern):
```tsx
<StealthCard hover={false} className="px-4 py-3 min-w-[200px] flex-shrink-0">
```

After:
```tsx
<StealthCard hover={false} className="px-4 py-3 min-w-[200px] min-h-[110px] flex-shrink-0 flex flex-col justify-between">
```

**Acceptance:**
- **Given** the dashboard loads
- **When** I view the status ribbon
- **Then** all cards render at the same height — no short cards breaking the row

---

### Task 2: Chat Zinc Migration

**Model:** sonnet | **Parallel:** Group 1

**JTBD:** When I toggle light mode on the chat page, I want it to look correct instead of white text on white backgrounds.

**Outcome:** All 59 hardcoded `zinc-*` classes across 7 files replaced with semantic CSS variable classes.

**Files:**
- Modify: `components/chat/chat-input.tsx` (4 instances)
- Modify: `components/chat/thread-list.tsx` (19 instances)
- Modify: `components/chat/message-bubble.tsx` (17 instances)
- Modify: `components/chat/chat-actions.tsx` (1 instance)
- Modify: `components/chat/agent-selector.tsx` (5 instances)
- Modify: `components/chat/message-area.tsx` (3 instances)
- Modify: `app/chat/page.tsx` (10 instances)

**Color Mapping Table:**

| Zinc Class | Semantic Replacement |
|---|---|
| `bg-zinc-950` | `bg-background` |
| `bg-zinc-900` | `bg-muted` |
| `bg-zinc-900/50`, `bg-zinc-800/50` | `bg-muted/50` |
| `bg-zinc-800` | `bg-muted` |
| `text-zinc-100` | `text-foreground` |
| `text-zinc-200` | `text-foreground` |
| `text-zinc-300` | `text-foreground/80` |
| `text-zinc-400` | `text-muted-foreground` |
| `text-zinc-500` | `text-muted-foreground` |
| `text-zinc-600` | `text-muted-foreground/60` |
| `text-zinc-700` | `text-muted-foreground/40` |
| `border-zinc-700` | `border-border` |
| `border-zinc-800` | `border-border` |
| `hover:bg-zinc-800` | `hover:bg-muted` |
| `hover:bg-zinc-700` | `hover:bg-muted` |
| `hover:bg-zinc-700/50` | `hover:bg-muted/50` |
| `ring-zinc-700` | `ring-ring` |
| `divide-zinc-800` | `divide-border` |
| `scrollbar-thumb-zinc-700` | `scrollbar-thumb-muted-foreground/30` |

**Process:**
1. Open each file
2. Apply mapping table — find/replace each zinc class
3. Verify no zinc- classes remain: `grep -r "zinc-" components/chat/ app/chat/page.tsx`
4. Check both dark and light mode visually

**Constraints:**
- `bg-white` on img elements in message-bubble.tsx is intentional (image background) — do NOT migrate
- `text-white` on colored-bg buttons (send icon on emerald) is intentional — do NOT migrate
- `bg-zinc-500/20` if used for abstain/special semantic states — leave as-is

**Acceptance:**
- **Given** I'm on `/chat` in light mode
- **When** I view threads, messages, input, and agent selector
- **Then** all text is readable, backgrounds are appropriate, no white-on-white or black-on-black

---

### Task 3: SSE Fragmentation Fix

**Model:** sonnet | **Parallel:** Group 1

**JTBD:** When Makima sends long responses, I want all text to arrive without dropped chunks.

**Outcome:** Client-side SSE reader handles TCP chunks that split mid-line by buffering incomplete lines.

**Files:**
- Modify: `app/chat/page.tsx:246-262` (reader loop)

**The Bug:**

Line 254: `const lines = text.split('\n')` assumes each chunk contains complete SSE lines. When TCP fragments a line like `data: {"type":"chunk","content":"hel` | `lo"}\n\n`, the first chunk fails JSON.parse silently and content is lost.

**Fix — carry-forward buffer:**

Replace the reader loop (lines 246-262 approximately):

```tsx
const decoder = new TextDecoder()
let buffer = ''  // carry-forward buffer for incomplete lines

while (true) {
  const { done, value } = await reader.read()
  if (done) break

  buffer += decoder.decode(value, { stream: true })
  const lines = buffer.split('\n')

  // Last element is either empty (line ended with \n) or incomplete
  buffer = lines.pop() || ''

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue
    const jsonStr = line.slice(6)
    if (!jsonStr.trim()) continue

    try {
      const event = JSON.parse(jsonStr)
      // ... rest of event handling unchanged
```

Key change: `buffer = lines.pop() || ''` — the last element after split is always the incomplete remainder. Pop it off, save it, prepend to next chunk.

**Acceptance:**
- **Given** Makima is sending a long response with action blocks
- **When** TCP fragments arrive mid-JSON
- **Then** all chunks are correctly reassembled and no content is dropped

---

### Task 4: Makima Action Delay Fix

**Model:** sonnet | **Parallel:** Group 1

**JTBD:** When Makima finishes a response with actions, I want to see "done" immediately instead of waiting for actions to execute.

**Outcome:** Done event sent to client before actions execute. Actions run fire-and-forget.

**Files:**
- Modify: `app/api/chat/route.ts:190-215`

**The Bug:**

Lines 196-200: `executeActions` is awaited before the `done` event at line 207. The client sees a pause between the last chunk and the done signal while actions (create mission, update task, etc.) execute server-side.

**Fix — reorder done before actions:**

```typescript
// Save complete assistant message first
let displayResponse = fullResponse
let pendingActions: ReturnType<typeof parseActions> = []

if (isMakima && fullResponse) {
  pendingActions = parseActions(fullResponse)
  if (pendingActions.length > 0) {
    displayResponse = stripActionBlocks(fullResponse)
  }
}

// Save message and send done event FIRST
if (fullResponse) {
  const msg = await saveMessage(threadId, 'assistant', displayResponse, agentId)
  const doneData = JSON.stringify({ type: 'done', messageId: msg.id, agentId })
  controller.enqueue(encoder.encode(`data: ${doneData}\n\n`))

  // Auto-title thread if needed
  if (thread?.title === 'New Thread' || !thread?.title) {
    autoTitleThread(threadId, content).catch((err) =>
      console.error('[chat/route] Auto-title failed:', err)
    )
  }
}

// Execute actions AFTER done event (fire-and-forget)
if (pendingActions.length > 0) {
  executeActions(pendingActions)
    .then((actionResults) => {
      console.log(`[chat/route] Executed ${pendingActions.length} pulse action(s):`,
        actionResults.map(r => `${r.action.type}: ${r.success ? 'ok' : r.message}`))
    })
    .catch((err) => console.error('[chat/route] Action execution failed:', err))
}
```

**Acceptance:**
- **Given** I send a message to Makima that triggers pulse actions
- **When** she responds
- **Then** the done event arrives immediately after the last chunk — no delay for action execution

---

### Task 5: Project Inline Editing

**Model:** sonnet | **Parallel:** Group 1

**JTBD:** When I view a project, I want to edit its name, status, and description without leaving the page.

**Outcome:** Project detail page has inline edit controls that save via existing PATCH API.

**Files:**
- Modify: `components/project-detail.tsx` (add edit state + save handler)
- Read-only reference: `app/api/projects/[id]/route.ts` (PATCH endpoint already exists)

**Implementation:**

Read `app/api/projects/[id]/route.ts` first to confirm what fields the PATCH accepts.

Add to project-detail.tsx:
1. `isEditing` state toggle
2. Edit button (pencil icon) in the header next to the project title
3. When editing:
   - Title becomes an input field
   - Status becomes a dropdown (queue, todo, inprogress, review, done, archived)
   - Description becomes a textarea
4. Save button calls `PATCH /api/projects/${id}` with changed fields
5. Cancel button reverts to display mode
6. Optimistic update: show new values immediately, revert on error

**UI Pattern:** Match existing stealth-card aesthetic. Use same `inputClass` pattern from objectives/new page:
```
border border-border bg-muted px-3 py-2 text-sm text-foreground
```

**Constraints:**
- Don't add delete functionality
- Don't allow editing project ID
- Keep it minimal — no modals, no separate edit page, just inline

**Acceptance:**
- **Given** I'm on `/projects/[id]`
- **When** I click the edit button, change the title, and save
- **Then** the new title appears immediately and persists on refresh

---

## Group 2 (after code tasks complete)

### Task 6: Seed Objectives

**Model:** sonnet | **Parallel:** Group 2

**JTBD:** When I view the objectives page, I want to see real objectives for active projects.

**Outcome:** 2 additional objectives seeded for War Room and Folio.

**Files:**
- None (Supabase API calls only)

**Seed data:**

```bash
# War Room objective
curl -X POST /api/objectives -d '{
  "title": "War Room reaches daily-driver status",
  "description": "War Room replaces Discord as the primary command center for Shogunate operations.",
  "success_criteria": "Dashboard loads in <2s, chat SSE stable, council sessions complete without errors, all agents visible with real status",
  "project_id": "dynasty",
  "max_iterations": 10
}'

# Folio objective
curl -X POST /api/objectives -d '{
  "title": "Folio AGAC integration live",
  "description": "Clinical trial data flows from AGAC into Folio and is searchable by researchers.",
  "success_criteria": "AGAC API connected, trial data imports daily, search returns relevant results, Esteban signs off on UX",
  "project_id": "folio",
  "max_iterations": 8
}'
```

**Acceptance:**
- **Given** I visit `/objectives`
- **When** the page loads
- **Then** I see 3 objectives: ÆON launch, War Room daily-driver, Folio AGAC

---

## Execution Table

| Task | Group | Model | Est. Files | Independent? |
|------|-------|-------|-----------|-------------|
| T1: Card sizing | 1 | sonnet | 1 | Yes |
| T2: Zinc migration | 1 | sonnet | 7 | Yes |
| T3: SSE fix | 1 | sonnet | 1 | Yes |
| T4: Action delay | 1 | sonnet | 1 | Yes |
| T5: Project editing | 1 | sonnet | 1 | Yes |
| T6: Seed objectives | 2 | sonnet | 0 | Yes |

**Swarm verdict:** Parallel — all 5 code tasks spawn simultaneously, T6 runs after.

## Rollback

Per task — `git checkout -- <file>` reverts any individual task. No migrations, no schema changes, no infra.

## Verification

```bash
npm run build                    # types + imports
grep -r "zinc-" components/chat/ app/chat/page.tsx  # should return 0 (T2)
```

Manual: toggle light/dark mode on `/chat`, send a long Makima message, check `/projects/[id]` edit, check `/objectives` page.
