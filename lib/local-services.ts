import { execFile } from 'child_process';
import { readFile } from 'fs/promises';
import type { ProbeResult } from './types';

const IS_VERCEL = !!process.env.VERCEL;
const HOME = process.env.HOME || '/Users/michaelenriquez';

const UNAVAILABLE: ProbeResult = { ok: false, detail: 'local-only', unavailable: true };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function execPromise(cmd: string, args: string[], timeoutMs = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: timeoutMs }, (err, stdout) => {
      if (err) reject(err);
      else resolve(typeof stdout === 'string' ? stdout.trim() : String(stdout).trim());
    });
  });
}

// Cache for launchctl results (10s TTL)
let launchctlCache: { data: string; ts: number } | null = null;

/** Reset internal caches. Exported for testing only. */
export function __resetCacheForTests() {
  launchctlCache = null;
}

async function getLaunchctlList(): Promise<string> {
  const now = Date.now();
  if (launchctlCache && now - launchctlCache.ts < 10_000) return launchctlCache.data;
  const data = await execPromise('launchctl', ['list']);
  launchctlCache = { data, ts: now };
  return data;
}

function hasPid(launchctlOutput: string, label: string): boolean {
  const line = launchctlOutput.split('\n').find(l => l.includes(label));
  if (!line) return false;
  const pid = line.split('\t')[0];
  return pid !== '-' && pid !== '';
}

// ---------------------------------------------------------------------------
// Individual Probes
// ---------------------------------------------------------------------------

/** Probe 1: Sparkd HTTP status endpoint */
export async function probeSparkd(): Promise<ProbeResult> {
  if (IS_VERCEL) return UNAVAILABLE;
  try {
    const start = Date.now();
    const resp = await fetch('http://127.0.0.1:8787/status', {
      signal: AbortSignal.timeout(3000),
    });
    const latencyMs = Date.now() - start;
    if (!resp.ok) {
      return { ok: false, detail: `HTTP ${resp.status}`, latencyMs };
    }
    const body = await resp.json();
    return {
      ok: true,
      detail: body.status || 'running',
      latencyMs,
      meta: { insights: body.insights, ...(body.status ? { status: body.status } : {}) },
    };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : 'unknown error' };
  }
}

/** Probe 2: Bridge worker heartbeat freshness */
export async function probeBridgeWorker(): Promise<ProbeResult> {
  if (IS_VERCEL) return UNAVAILABLE;
  try {
    const raw = await readFile(`${HOME}/.spark/bridge_worker_heartbeat.json`, 'utf-8');
    const data = JSON.parse(raw);
    const ts = data.ts || data.timestamp || data.lastBeat;
    if (!ts) return { ok: false, detail: 'no timestamp in heartbeat' };
    const ageMs = Date.now() - new Date(ts).getTime();
    const freshMs = 5 * 60 * 1000; // 5 minutes
    if (ageMs > freshMs) {
      return { ok: false, detail: `stale heartbeat (${Math.round(ageMs / 1000)}s ago)` };
    }
    return { ok: true, detail: `fresh (${Math.round(ageMs / 1000)}s ago)`, meta: data };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : 'unknown error' };
  }
}

/** Probe 3: Launch services status (single launchctl list, cached 10s) */
export async function probeLaunchServices(): Promise<ProbeResult> {
  if (IS_VERCEL) return UNAVAILABLE;
  const KNOWN_LABELS = [
    'com.warroom.poller',
    'com.spark.sparkd',
    'com.spark.bridge-worker',
  ];
  try {
    const output = await getLaunchctlList();
    const statuses: Record<string, boolean> = {};
    let runningCount = 0;
    for (const label of KNOWN_LABELS) {
      const running = hasPid(output, label);
      statuses[label] = running;
      if (running) runningCount++;
    }
    return {
      ok: runningCount > 0,
      detail: `${runningCount}/${KNOWN_LABELS.length} services running`,
      meta: statuses,
    };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : 'unknown error' };
  }
}

/** Probe 4: Shogunate poller via launchctl PID check */
export async function probeShogunatePoller(): Promise<ProbeResult> {
  if (IS_VERCEL) return UNAVAILABLE;
  try {
    const output = await getLaunchctlList();
    const running = hasPid(output, 'com.warroom.poller');
    return {
      ok: running,
      detail: running ? 'poller running' : 'poller not running',
    };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : 'unknown error' };
  }
}

/** Probe 5: OpenClaw process check via launchctl */
export async function probeOpenClaw(): Promise<ProbeResult> {
  if (IS_VERCEL) return UNAVAILABLE;
  try {
    const output = await getLaunchctlList();
    // OpenClaw may register under various labels
    const running = hasPid(output, 'openclaw') || hasPid(output, 'com.openclaw');
    return {
      ok: running,
      detail: running ? 'openclaw running' : 'openclaw not found',
    };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : 'unknown error' };
  }
}

/** Probe 6: Spark cognitive insights file */
export async function probeSparkInsights(): Promise<ProbeResult> {
  if (IS_VERCEL) return UNAVAILABLE;
  try {
    const raw = await readFile(`${HOME}/.spark/cognitive_insights.json`, 'utf-8');
    const insights = JSON.parse(raw);
    const count = Array.isArray(insights) ? insights.length : 0;
    return {
      ok: count > 0,
      detail: `${count} insights`,
      meta: { count },
    };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : 'unknown error' };
  }
}

/** Probe 7: Tab-ledger session stats via sqlite3 CLI */
export async function probeTabLedger(): Promise<ProbeResult> {
  if (IS_VERCEL) return UNAVAILABLE;
  try {
    const dbPath = `${HOME}/.tab-ledger/ledger.db`;
    const result = await execPromise('sqlite3', [
      dbPath,
      "SELECT count(*) || '|' || printf('%.2f', coalesce(sum(cost_usd),0)) || '|' || coalesce(max(started_at),'none') FROM cc_sessions;",
    ]);
    const [countStr, costStr, lastSession] = result.split('|');
    const sessions = parseInt(countStr, 10) || 0;
    const cost = parseFloat(costStr) || 0;
    return {
      ok: sessions > 0,
      detail: `${sessions} sessions, $${cost.toFixed(2)} total`,
      meta: { sessions, cost, lastSession },
    };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : 'unknown error' };
  }
}

/** Probe 8: Lossless-claw database check */
export async function probeLosslessClaw(): Promise<ProbeResult> {
  if (IS_VERCEL) return UNAVAILABLE;
  try {
    // Try known locations for the lossless-claw database
    const possiblePaths = [
      `${HOME}/.lossless-claw/lcm.db`,
      `${HOME}/.lossless-claw/lossless.db`,
      `${HOME}/.local/share/lossless-claw/lcm.db`,
    ];
    for (const dbPath of possiblePaths) {
      try {
        const result = await execPromise('sqlite3', [
          dbPath,
          "SELECT count(*) FROM sqlite_master WHERE type='table';",
        ]);
        const tableCount = parseInt(result, 10) || 0;
        return {
          ok: tableCount > 0,
          detail: `${tableCount} tables found`,
          meta: { path: dbPath, tables: tableCount },
        };
      } catch {
        // Try next path
        continue;
      }
    }
    return { ok: false, detail: 'lossless-claw db not found' };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : 'unknown error' };
  }
}

/** Probe 9: Spark pipeline state file */
export async function probePipelineState(): Promise<ProbeResult> {
  if (IS_VERCEL) return UNAVAILABLE;
  try {
    const raw = await readFile(`${HOME}/.spark/pipeline_state.json`, 'utf-8');
    const data = JSON.parse(raw);
    return {
      ok: true,
      detail: data.stage || 'loaded',
      meta: data,
    };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : 'unknown error' };
  }
}

/** Probe 10: System fitness file (from Sprint 0 fitness script) */
export async function probeSystemFitness(): Promise<ProbeResult> {
  if (IS_VERCEL) return UNAVAILABLE;
  try {
    const raw = await readFile(`${HOME}/.spark/system_fitness.json`, 'utf-8');
    const data = JSON.parse(raw);
    return {
      ok: true,
      detail: data.digest || 'loaded',
      meta: {
        missRate: data.missRate,
        missRateTrend: data.missRateTrend,
        corrections: data.corrections,
        sessions: data.sessions,
        computedAt: data.computedAt,
      },
    };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : 'unknown error' };
  }
}

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

export async function probeAllServices(): Promise<Record<string, ProbeResult>> {
  if (IS_VERCEL) {
    return Object.fromEntries(
      ['sparkd', 'bridge_worker', 'launch_services', 'poller', 'openclaw',
       'spark_insights', 'tab_ledger', 'lossless_claw', 'pipeline', 'fitness']
        .map(k => [k, UNAVAILABLE])
    );
  }

  const [sparkd, bridge, launch, poller, openclaw, insights, tabLedger, lossless, pipeline, fitness] =
    await Promise.all([
      probeSparkd(), probeBridgeWorker(), probeLaunchServices(),
      probeShogunatePoller(), probeOpenClaw(), probeSparkInsights(),
      probeTabLedger(), probeLosslessClaw(), probePipelineState(), probeSystemFitness(),
    ]);

  return {
    sparkd,
    bridge_worker: bridge,
    launch_services: launch,
    poller,
    openclaw,
    spark_insights: insights,
    tab_ledger: tabLedger,
    lossless_claw: lossless,
    pipeline,
    fitness,
  };
}
