# Sentry Migration Design
**Date:** 2026-02-26
**Status:** Approved (autonomous mission)

## Problem

`lib/sentry.ts` with `captureError` / `captureWarning` helpers exists and is well-designed. Zero files import it. `NEXT_PUBLIC_SENTRY_DSN` is not set in `.env.local`. The Sentry SDK is installed and fully configured in `sentry.server.config.ts`, `instrumentation.ts`, `next.config.ts` — but no events ship to Sentry because: (1) no DSN, (2) nobody calls `captureError`.

## What Already Exists (Do NOT Rebuild)

- `@sentry/nextjs@^10.40.0` installed
- `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation-client.ts` — all init Sentry from `NEXT_PUBLIC_SENTRY_DSN`
- `instrumentation.ts` — `onRequestError` catches unhandled request errors
- `next.config.ts` — wraps with `withSentryConfig` when `SENTRY_AUTH_TOKEN` present
- `lib/sentry.ts` — `captureError(error, operation, ctx)` and `captureWarning(message, ctx)` with `WarRoomContext` type

## What's Missing

1. `NEXT_PUBLIC_SENTRY_DSN` env var (Sensei must provide from Sentry dashboard, org: `shogunate`, project: `war-room`)
2. All API routes and high-value lib files using `captureError` instead of bare `console.error`

## Design Decision: Approach A (API Routes + High-Value Lib)

### In Scope

| Location | # of console.error calls | Priority |
|----------|--------------------------|----------|
| `app/api/**/*.ts` (15 files) | ~35 | High — user-facing failures |
| `lib/pulse-context.ts` | 9 | High — operational context queries |
| `lib/pulse-alerts.ts` | 1 | Medium |
| `lib/claude-cli.ts` | 1 | Medium |
| `lib/agent-identity.ts` | 1 | Medium |
| `lib/use-realtime-channel.ts` | 1 | Medium |
| `lib/query-analyzer.ts` | 1 | Medium |

### Out of Scope (Documented Rationale)

| Location | Rationale |
|----------|-----------|
| `lib/queries.ts` (~40 calls) | Supabase soft failures: return `[]`/`null` on error, no entity context. Already breadcrumbed by `consoleLoggingIntegration`. Flooding Sentry with connection noise obscures real issues. |
| `components/*.tsx` (7 calls) | Client-side, single-user system. Lower signal for production debugging. |

## Pattern

```typescript
// Before
console.error('[chat/route] Error:', errMsg)

// After
import { captureError } from "@/lib/sentry"
captureError(err, 'chat/route', { threadId, route: '/api/chat' })
```

Context hierarchy (attach what's available):
- API routes with ID params: include `missionId`, `threadId`, `proposalId`, etc.
- Generic routes: include `route` string
- All: include `operation` (auto-set by captureError)

## Degradation

`captureError` calls `console.error` internally — so behavior is identical to today if DSN is unset. Zero regression risk.

## Prerequisites for Sentry Events to Actually Ship

```bash
# Add to .env.local (get DSN from sentry.io → Settings → Projects → war-room → DSN)
NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@oxxxxx.ingest.sentry.io/xxxxx
```
