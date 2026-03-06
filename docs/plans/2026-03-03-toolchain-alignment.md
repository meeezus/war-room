# Toolchain Alignment — ESLint v9 + Tailwind v4 Roadmap

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align `folio-app` and `war-room` on the same major versions of ESLint and Tailwind CSS, starting with the safest change first.

**Architecture:** Three-phase upgrade. Phase 1 (ESLint v9 for folio-app) is safe to do today. Phases 2–3 (Next.js 14→16, Tailwind v3→v4) are deferred — they're high-risk migrations with significant breaking changes that need their own sprints.

**Tech Stack:** ESLint 9 (flat config), FlatCompat (legacy bridge), Tailwind CSS v4, Next.js 16

---

## Context

| | `war-room` | `folio-app` |
|---|---|---|
| Next.js | 16.1.6 | 14.2.35 |
| Tailwind | v4 (CSS-first, no config file) | v3 (tailwind.config.ts, 200+ lines) |
| ESLint | v9 (flat config) | v8 (legacy .eslintrc.json) |
| ESLint config | eslint.config.mjs | .eslintrc.json |

**Repos:** Separate (not a monorepo). `~/Code/war-room/` and `~/Code/folio-app/`.

**Shared eslint-config package:** Skip. YAGNI for 2 separate repos — keeping configs in sync manually has near-zero overhead.

**ESLint v10:** Too new (10.0.2 as of 2026-03). `eslint-config-next` hasn't stabilized support yet. Plan for v10 after ecosystem catches up.

---

## Phase 1 (NOW): folio-app ESLint v8 → v9

> This is safe. Uses ESLint's official `FlatCompat` bridge to run the existing `eslint-config-next@14` through ESLint v9's flat config system.

### Task 1: Install ESLint v9 + FlatCompat bridge

**Files:**
- Modify: `~/Code/folio-app/package.json`

**Step 1: Install deps**

```bash
cd ~/Code/folio-app
npm install --save-dev eslint@^9 @eslint/eslintrc
```

Expected output: `eslint@9.x.x` installed.

**Step 2: Verify old version is gone**

```bash
npm ls eslint | head -3
```

Expected: Shows `eslint@9.x` not `8.x`.

**Step 3: Commit the package changes**

```bash
git add package.json package-lock.json
git commit -m "chore: upgrade eslint v8→v9"
```

---

### Task 2: Migrate .eslintrc.json → eslint.config.mjs

**Files:**
- Create: `~/Code/folio-app/eslint.config.mjs`
- Delete: `~/Code/folio-app/.eslintrc.json`

**Step 1: Create flat config**

Create `~/Code/folio-app/eslint.config.mjs`:

```js
import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
];

export default eslintConfig;
```

**Step 2: Remove legacy config**

```bash
rm ~/Code/folio-app/.eslintrc.json
```

**Step 3: Run linter to verify it works**

```bash
cd ~/Code/folio-app
npx eslint app/page.tsx --max-warnings 50
```

Expected: Runs without "Error: ESLint configuration" crash. May show warnings — that's fine.

**Step 4: Run full lint**

```bash
npm run lint
```

Expected: Same warning count as before (0 errors, N warnings). If lint count changes dramatically, investigate.

**Step 5: Commit**

```bash
git add eslint.config.mjs
git rm .eslintrc.json
git commit -m "chore: migrate eslint to flat config (v9)"
```

---

### Task 3: Verify build still passes

**Step 1: Run build**

```bash
cd ~/Code/folio-app
npm run build
```

Expected: Build succeeds. No new lint errors blocking compilation.

**Step 2: Commit if clean**

```bash
git push origin main  # or current branch
```

---

## Phase 2 (DEFERRED): folio-app Next.js 14 → 16

> Prerequisite for Tailwind v4 migration. Needs its own sprint.

**Why deferred:** Next.js 15 introduced async `params`/`searchParams` in layouts/pages (breaking change). Next.js 16 has additional changes. This requires auditing every page and layout file.

**Trigger:** After Phase 1 is stable in production.

**Rough scope:**
1. Upgrade Next.js 14.2.35 → 15.x (intermediate step, audit async params)
2. Upgrade Next.js 15.x → 16.x
3. After Next.js 16: upgrade `eslint-config-next` to 16.x — then can remove `FlatCompat` and use flat config natively (like war-room does)

---

## Phase 3 (DEFERRED): folio-app Tailwind v3 → v4

> High-risk production migration. Requires Phase 2 complete first.

**Why deferred:**
1. folio-app has 200+ lines of custom design tokens in `tailwind.config.ts` (50+ colors, custom fonts, animations)
2. Tailwind v4 uses CSS-first config — all those values need to move into `globals.css` as `@theme { }` variables
3. The `@tailwind base/components/utilities` directives change to `@import "tailwindcss"`
4. `tailwindcss-animate` and `@tailwindcss/typography` plugins need v4 compat check
5. This should have visual regression testing before shipping

**Trigger:** After Phase 2 is complete (Next.js 16 running in folio-app).

**Rough migration path:**
```css
/* globals.css - before */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* globals.css - after */
@import "tailwindcss";

@theme {
  --color-cream-paper: #f5f0e6;
  --color-warm-cream: #fffdf8;
  /* ... all 50+ colors ... */
  --font-sans: var(--font-dm-sans), "DM Sans", system-ui, sans-serif;
  /* ... animations ... */
}
```

---

## Out of Scope

- **Shared eslint-config npm package** — YAGNI for 2 repos. Revisit if a 3rd repo is added.
- **ESLint v10** — Ecosystem not ready. Plan for Q2 2026 after `eslint-config-next` adds v10 support.
- **war-room Tailwind/ESLint changes** — Already on latest. No changes needed.

---

## Verification (Phase 1)

After Phase 1 complete:

- [ ] `npm run lint` in folio-app outputs same results as before (no new errors)
- [ ] `npm run build` passes
- [ ] `eslint --version` in folio-app shows `9.x`
- [ ] No `.eslintrc.json` file exists in folio-app root
- [ ] `eslint.config.mjs` exists and exports valid flat config

---

## Rollback

**Phase 1 rollback:**
```bash
cd ~/Code/folio-app
npm install --save-dev eslint@^8.56.0
rm eslint.config.mjs
echo '{"extends": "next/core-web-vitals"}' > .eslintrc.json
git add -A && git commit -m "revert: rollback eslint to v8"
```
