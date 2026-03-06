# Hono Security Patch Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Patch 2 HIGH severity vulnerabilities in Hono <=4.12.3 and @hono/node-server <1.19.10 introduced via shadcn devDependency chain.

**Architecture:** Pure lockfile update. No code changes needed. `npm audit fix` resolves both vulns by upgrading transitive deps to patched semver versions within existing ranges (`hono: ^4.11.4` → 4.12.4+, `@hono/node-server: ^1.19.9` → 1.19.10+).

**Tech Stack:** npm, Next.js 16, war-room project at `~/Code/war-room`

---

## Vulnerability Summary

| Package | Current | Fixed | CVE | Severity |
|---------|---------|-------|-----|----------|
| `hono` | 4.12.3 | 4.12.4+ | GHSA-q5qw-h33p-qvwr | HIGH (7.5) - arbitrary file access via serveStatic |
| `hono` | 4.12.3 | 4.12.4+ | GHSA-5pq2-9x2x-5p6w | MODERATE - cookie attribute injection |
| `hono` | 4.12.3 | 4.12.4+ | GHSA-p6xx-57qc-3wxr | MODERATE - SSE control field injection |
| `@hono/node-server` | 1.19.9 | 1.19.10+ | GHSA-wc8c-qw6v-h7f6 | HIGH (7.5) - auth bypass via encoded slashes |

**Dependency chain:** `shadcn@3.8.4` (devDep) → `@modelcontextprotocol/sdk@1.26.0` → `hono@4.12.3` + `@hono/node-server@1.19.9`

**Good news:** MCP SDK's ranges (`hono: ^4.11.4`, `@hono/node-server: ^1.19.9`) are compatible with patched versions. `npm audit fix` resolves without any override needed.

---

### Task 1: Patch vulnerabilities via npm audit fix

**Files:**
- Modify: `package-lock.json` (lockfile update only)

**Step 1: Verify current vulnerable state**

Run: `cd ~/Code/war-room && npm audit`
Expected: `2 high severity vulnerabilities` affecting `hono` and `@hono/node-server`

**Step 2: Apply the patch**

```bash
cd ~/Code/war-room && npm audit fix
```

Expected output contains:
```
added X packages, changed Y packages, and audited Z packages in Ns
0 vulnerabilities
```

**Step 3: Verify clean audit**

Run: `cd ~/Code/war-room && npm audit`
Expected: `found 0 vulnerabilities`

If still showing vulns, run `npm audit --json` and check if semver ranges need override.

**Step 4: Confirm patched versions**

Run: `cd ~/Code/war-room && npm ls hono @hono/node-server`
Expected:
```
└─┬ shadcn@3.8.4
  └─┬ @modelcontextprotocol/sdk@...
    ├─┬ @hono/node-server@1.19.10+
    └── hono@4.12.4+
```

**Step 5: Build check**

Run: `cd ~/Code/war-room && npm run build 2>&1 | tail -20`
Expected: Build completes without errors. TypeScript errors would indicate a breaking change in hono API (unlikely for a patch version).

**Step 6: Commit**

```bash
cd ~/Code/war-room
git add package-lock.json
git commit -m "fix: patch HIGH severity hono vulns via npm audit fix

Patches GHSA-q5qw-h33p-qvwr (arbitrary file access, CVSS 7.5),
GHSA-wc8c-qw6v-h7f6 (auth bypass, CVSS 7.5), and 2 moderate
vulns in hono <=4.12.3 and @hono/node-server <1.19.10.

Transitive deps via shadcn → @modelcontextprotocol/sdk → hono."
```

---

## Fallback: If npm audit fix doesn't resolve

If the lockfile update alone doesn't work (e.g., MCP SDK pins exact versions), add `overrides` to `package.json`:

```json
"overrides": {
  "hono": ">=4.12.4",
  "@hono/node-server": ">=1.19.10",
  "serialize-javascript": ">=7.0.3"
}
```

Then run `npm install` and verify.

---

## Notes

- **shadcn is devDependency only** — these vulns don't affect production runtime unless war-room runs a Hono server (it doesn't, it's Next.js). Still worth patching for hygiene and patrol compliance.
- **No MCP SDK update needed** — 1.27.1 latest still uses same semver ranges, no benefit to updating.
- **No code changes** — this is purely a lockfile operation.
