/**
 * Sentry utility — structured error capture with war-room context.
 *
 * Use instead of bare console.error in API routes and lib functions.
 * Attaches operational context (agentId, threadId, missionId, etc.)
 * so errors are searchable in Sentry by entity.
 *
 * Usage:
 *   import { captureError } from "@/lib/sentry";
 *   captureError(error, "fetchMessages", { threadId, userId });
 */

import * as Sentry from "@sentry/nextjs";

export interface WarRoomContext {
  // Entity identifiers
  userId?: string;
  agentId?: string;
  daimyoId?: string;
  threadId?: string;
  missionId?: string;
  proposalId?: string;
  projectId?: string;
  objectiveId?: string;
  // Operation context
  operation?: string;
  route?: string;
  // Arbitrary extras
  [key: string]: unknown;
}

/**
 * Capture an exception with structured war-room context.
 * Logs to console.error AND sends to Sentry.
 *
 * @param error - The caught error
 * @param operation - Short label for where this happened (e.g. "fetchMessages")
 * @param ctx - Optional war-room context (userId, threadId, etc.)
 */
export function captureError(
  error: unknown,
  operation: string,
  ctx: WarRoomContext = {}
): void {
  const { userId, agentId, daimyoId, ...extras } = ctx;

  // Still log locally — Sentry is additive, not a replacement
  console.error(`[${operation}]`, error, ctx);

  Sentry.withScope((scope) => {
    scope.setTag("operation", operation);

    if (userId) scope.setUser({ id: userId });
    if (agentId) scope.setTag("agentId", agentId);
    if (daimyoId) scope.setTag("daimyoId", daimyoId);

    scope.setContext("war-room", { operation, ...extras });

    Sentry.captureException(error);
  });
}

/**
 * Capture a non-fatal message (warning-level event).
 *
 * @param message - Human-readable message
 * @param ctx - Optional war-room context
 */
export function captureWarning(
  message: string,
  ctx: WarRoomContext = {}
): void {
  Sentry.withScope((scope) => {
    scope.setLevel("warning");
    if (ctx.userId) scope.setUser({ id: ctx.userId });
    scope.setContext("war-room", ctx);
    Sentry.captureMessage(message);
  });
}
