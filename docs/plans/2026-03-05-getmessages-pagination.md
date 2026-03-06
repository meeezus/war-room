# getMessages Pagination Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent unbounded DB fetches in `getMessages()` by adding a limit parameter and pushing the slice logic into the query layer.

**Architecture:** Add an optional `limit` parameter to `getMessages()`. When provided, query with `ORDER BY created_at DESC LIMIT N` then reverse results to restore chronological order. Update the council route to pass `limit: 20` directly, removing the in-process `.slice(-20)`.

**Tech Stack:** TypeScript, Supabase JS client (PostgREST), Next.js API route

---

## Context

**Patrol discovery:** `getMessages(threadId)` in `lib/chat.ts` fetches ALL rows from `chat_messages` for a thread with no limit. The council route calls it then immediately slices the last 20. For a long conversation this pulls potentially thousands of rows across the wire, serializes them all, then throws most away.

**Only one caller** — `app/api/chat/council/route.ts` — verified by grep. Zero blast radius risk.

**Why DESC + reverse, not ASC + limit?** PostgREST's `.limit()` applies to the ordered result set. `ORDER BY created_at ASC LIMIT 20` gives the *oldest* 20 messages. To get the *newest* 20 in chronological order we must: query DESC, limit, then reverse in memory. This is a single-line array operation on a small set.

**Default cap of 100:** Any future caller gets a safety cap out of the box. Prevents accidental unbounded fetches if someone calls `getMessages()` without thinking.

---

## Tasks

### Task 1: Update `getMessages` in `lib/chat.ts`

**Files:**
- Modify: `lib/chat.ts:137-146`

**Step 1: Understand the current implementation**

Current code (lines 137-146):
```typescript
export async function getMessages(threadId: string): Promise<ChatMessage[]> {
  const sb = getServiceClient()
  const { data, error } = await sb
    .from('chat_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}
```

**Step 2: Update the function signature and query**

Replace the function body with:
```typescript
export async function getMessages(threadId: string, limit = 100): Promise<ChatMessage[]> {
  const sb = getServiceClient()
  const { data, error } = await sb
    .from('chat_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  // Reverse to restore chronological (ascending) order after DESC fetch
  return (data ?? []).reverse()
}
```

**Why this works:**
- `ORDER BY created_at DESC LIMIT 100` hits the index and returns only the rows we need
- `.reverse()` on an array of ≤100 elements is negligible
- Default `100` acts as a safety cap for any future callers
- Return type `ChatMessage[]` is unchanged — no downstream breakage

**Step 3: Verify the function compiles**

```bash
cd /Users/michaelenriquez/Code/war-room && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors related to `getMessages`.

**Step 4: Commit**

```bash
cd /Users/michaelenriquez/Code/war-room
git add lib/chat.ts
git commit -m "perf: cap getMessages to last 100 rows by default, query DESC+limit+reverse"
```

---

### Task 2: Update council route to use limit parameter

**Files:**
- Modify: `app/api/chat/council/route.ts:135-136`

**Step 1: Understand the current usage**

Current code (lines 135-136):
```typescript
const allMessages = await getMessages(threadId)
const messages = allMessages.slice(-20)
```

**Step 2: Replace with limit parameter, remove slice**

```typescript
const messages = await getMessages(threadId, 20)
```

The `.slice(-20)` is now redundant — the query returns at most 20 messages already in chronological order.

**Step 3: Verify the build**

```bash
cd /Users/michaelenriquez/Code/war-room && npm run build 2>&1 | tail -20
```

Expected: Build succeeds with no TypeScript errors.

**Step 4: Commit**

```bash
cd /Users/michaelenriquez/Code/war-room
git add app/api/chat/council/route.ts
git commit -m "perf: council route passes limit=20 to getMessages, removes post-fetch slice"
```

---

## Verification

**Manual check:** Open War Room, trigger a council review on a thread with 50+ messages. Confirm it works correctly and only processes 20 messages.

**DB verification (optional):** Enable Supabase query logging and confirm the query now includes `LIMIT 20` instead of no limit.

**Build gate:** `npm run build` must pass before merging.

---

## Rollback

Both changes are isolated to 2 files. Rollback:
```bash
git revert HEAD~1  # revert council route change
git revert HEAD~2  # revert getMessages change
```

Or to revert both at once:
```bash
git revert HEAD~2..HEAD
```

---

## Out of Scope

- True cursor-based pagination (defer until thread count > 1000 messages becomes a real scenario)
- Adding `offset` support to `getMessages` (YAGNI — no paginated UI exists)
- Caching message results (separate concern)
