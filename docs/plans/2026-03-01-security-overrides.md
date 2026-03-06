# Security Overrides: Commit Existing Fix

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Commit the uncommitted `serialize-javascript` override that's sitting in war-room's working tree, resolving all 5 high-severity vulnerabilities flagged by patrol.

**Architecture:** No code changes needed — the fix already exists in package.json (working tree). The override resolves serialize-javascript to 7.0.3 (patched). npm audit confirms 0 vulnerabilities. Just needs a targeted commit.

**Tech Stack:** npm overrides (package.json `overrides` field)

---

## Context

Patrol flagged 5 high-severity vulnerabilities in war-room:
- serialize-javascript <=7.0.2 — RCE via prototype pollution
- webpack/sentry/minimize ReDoS chain (minimatch)

**Current actual state (verified):**
- Working tree `package.json` already has `"overrides": { "serialize-javascript": ">=7.0.3" }`
- This was added by a previous session but never committed
- `npm audit` → **0 vulnerabilities** — fix is working
- `serialize-javascript@7.0.3` installed (patched)
- `minimatch@3.1.5` installed — patched (CVE-2022-3517 fix landed in 3.0.5+)
- `minimatch@9.0.9` and `10.2.4` also installed via sentry/serwist — both safe

**Patrol alert was stale** — pre-fix state was never committed, so patrol's HEAD-based scan missed the fix.

## What's NOT needed

- No minimatch override needed: 3.1.5 is patched, npm audit confirms clean
- No npm install: already done, node_modules reflect the override
- No additional package changes

---

## Task 1: Commit the security fix

**Files:**
- Modify: `package.json` (already changed — has overrides block)
- Modify: `package-lock.json` (already changed — reflects resolved 7.0.3)

**Step 1: Verify npm audit is clean**

```bash
cd ~/Code/war-room && npm audit
```

Expected output:
```
found 0 vulnerabilities
```

If any vulnerabilities appear: STOP. Do not commit. Re-evaluate overrides.

**Step 2: Verify the override is correct**

```bash
cd ~/Code/war-room && cat node_modules/serialize-javascript/package.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('version'))"
```

Expected: `7.0.3`

**Step 3: Stage only the security files**

```bash
cd ~/Code/war-room && git add package.json package-lock.json
```

Do NOT stage other modified files — there are unrelated working tree changes.

**Step 4: Verify what's staged**

```bash
cd ~/Code/war-room && git diff --cached -- package.json
```

Expected: Only the `overrides` block addition:
```diff
+  },
+  "overrides": {
+    "serialize-javascript": ">=7.0.3"
   }
```

**Step 5: Commit**

```bash
cd ~/Code/war-room && git commit -m "security: pin serialize-javascript >=7.0.3 to resolve RCE (GHSA)"
```

**Step 6: Verify commit**

```bash
cd ~/Code/war-room && git log --oneline -3
```

Expected: new commit appears at top.

**Acceptance:**
- **Given** war-room has serialize-javascript override in working tree (uncommitted)
- **When** we commit only package.json + package-lock.json
- **Then** `git show HEAD:package.json` includes the overrides block, and `npm audit` still shows 0 vulnerabilities

---

## Out of Scope

- **Minimatch override** — Not needed. npm audit clean. 3.1.5 is patched. Defer unless a new CVE emerges.
- **folio-app pattern parity** — folio has more overrides (axios, langsmith, tar, etc.) that don't apply to war-room's dependency tree.
- **Next.js DoS vulns** — If any appear, requires Next.js major upgrade. Separate plan.

## Verification

```bash
cd ~/Code/war-room && npm audit && echo "CLEAN"
```

Should print `found 0 vulnerabilities` then `CLEAN`.
