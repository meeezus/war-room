# Version Constraint Upper Bounds Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add upper bound version constraints to `pyproject.toml` in both `war-room` and `shogunate` to prevent accidental major-version upgrades during installs.

**Architecture:** Pure config change — edit `pyproject.toml` in each repo, verify `uv lock` still resolves cleanly, commit. No code changes. No tests needed (it's a package manifest).

**Tech Stack:** Python, uv, pyproject.toml (PEP 508 version specifiers)

---

## Context

Both repos already have `uv.lock` tracked in git (reproducibility for CI is already solved). The remaining risk is that a fresh `uv install` without an existing lock file (e.g., new dev machine, fresh clone) could resolve to a future major version. Upper bounds close that window.

**Current locked versions (from uv.lock):**
- `click` → 8.3.1 (both repos)
- `pydantic` → 2.12.5 (both repos)
- `supabase` → 2.27.3 (war-room) / 2.28.0 (shogunate)

**No CI workflows exist** in either repo, so no pipeline changes needed.

---

## Task 1: Add upper bounds — war-room

**Files:**
- Modify: `~/Code/war-room/pyproject.toml` (lines 6-10)

### Step 1: Edit pyproject.toml

Change the `dependencies` block from:

```toml
dependencies = [
    "click>=8.0",
    "supabase>=2.0",
    "pydantic>=2.0",
]
```

To:

```toml
dependencies = [
    "click>=8.0,<9.0",
    "supabase>=2.0,<3.0",
    "pydantic>=2.0,<3.0",
]
```

### Step 2: Verify uv lock still resolves

```bash
cd ~/Code/war-room
uv lock
```

Expected: `Resolved N packages` with no errors. Lock file should be unchanged or minimally updated.

### Step 3: Commit

```bash
cd ~/Code/war-room
git add pyproject.toml uv.lock
git commit -m "chore: add upper bound version constraints to pyproject.toml

Prevents accidental major-version upgrades on fresh installs.
Lock file already tracked — this closes the remaining resolution risk."
```

---

## Task 2: Add upper bounds — shogunate

**Files:**
- Modify: `~/Code/shogunate/pyproject.toml` (lines 6-11)

Note: shogunate has one extra dep (`croniter>=2.0`, `pyyaml>=6.0`) — add upper bounds there too.

### Step 1: Edit pyproject.toml

Change the `dependencies` block from:

```toml
dependencies = [
    "click>=8.0",
    "croniter>=2.0",
    "supabase>=2.0",
    "pydantic>=2.0",
    "pyyaml>=6.0",
]
```

To:

```toml
dependencies = [
    "click>=8.0,<9.0",
    "croniter>=2.0,<4.0",
    "supabase>=2.0,<3.0",
    "pydantic>=2.0,<3.0",
    "pyyaml>=6.0,<7.0",
]
```

> **Why `croniter<4.0`?** Currently at 3.x. Upper bound 4.0 is conservative.
> **Why `pyyaml<7.0`?** Currently at 6.x. PyYAML is stable; 7.0 doesn't exist yet.

### Step 2: Verify uv lock

```bash
cd ~/Code/shogunate
uv lock
```

Expected: `Resolved N packages` with no errors.

### Step 3: Run tests to confirm nothing broke

```bash
cd ~/Code/shogunate
uv run python -m pytest tests/ -q
```

Expected: All tests pass (currently 70/70).

### Step 4: Commit

```bash
cd ~/Code/shogunate
git add pyproject.toml uv.lock
git commit -m "chore: add upper bound version constraints to pyproject.toml

Mirrors war-room fix. Prevents accidental major-version upgrades.
Covers click, croniter, supabase, pydantic, pyyaml."
```

---

## Notes

- **dev dependencies** (`pytest>=8.0`, `pytest-mock>=3.0`) intentionally left unbounded — test deps are low risk and pinned by the lock file anyway
- **`requires-python = ">=3.12"`** is fine as-is — Python version constraints don't need upper bounds in the same way
- If `uv lock` errors after the edit, check if a package genuinely requires a newer major version and adjust the bound accordingly
