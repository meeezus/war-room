import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import type { SystemFitness } from './types';

const HOME = process.env.HOME || '/Users/michaelenriquez';
const AUTOPSIES_DIR = join(HOME, '.spark', 'session_autopsies');
const PATCHES_DIR = join(HOME, '.spark', 'candidate_patches');

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

interface SessionAutopsy {
  session_id: string;
  timestamp: string;
  total_predictions: number;
  matches: number;
  partials: number;
  misses: number;
  miss_rate: number;
  patterns: { tool: string; predicted: string; count: number }[];
  candidate_patches: unknown[];
}

/**
 * Parse an autopsy filename (YYYY-MM-DDTHHMMSS.json) into a Date.
 * Returns null if the filename doesn't match the expected format.
 */
function parseFilenameDate(filename: string): Date | null {
  // Expected: 2026-03-25T233357.json -> strip .json -> 2026-03-25T233357
  const base = filename.replace(/\.json$/, '');
  const match = base.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
}

export async function computeFitness(): Promise<SystemFitness | null> {
  let files: string[];
  try {
    files = await readdir(AUTOPSIES_DIR);
  } catch {
    return null;
  }

  // Filter to only .json files
  const jsonFiles = files.filter((f) => f.endsWith('.json'));
  if (jsonFiles.length === 0) return null;

  const now = Date.now();
  const cutoff7d = now - SEVEN_DAYS_MS;
  const cutoff14d = now - FOURTEEN_DAYS_MS;

  // Accumulators
  let sessions7d = 0;
  let totalMissRate7d = 0;
  let corrections7d = 0;
  let sessionsPrev = 0;
  let totalMissRatePrev = 0;
  let correctionsPrev = 0;

  for (const file of jsonFiles) {
    const fileDate = parseFilenameDate(file);
    if (!fileDate) continue;

    const fileEpoch = fileDate.getTime();

    // Skip files older than 14 days
    if (fileEpoch < cutoff14d) continue;

    let autopsy: SessionAutopsy;
    try {
      const content = await readFile(join(AUTOPSIES_DIR, file), 'utf-8');
      autopsy = JSON.parse(content);
    } catch {
      // Malformed JSON or read error -- skip
      continue;
    }

    const missRate = autopsy.miss_rate ?? 0;
    const misses = autopsy.misses ?? 0;

    if (fileEpoch >= cutoff7d) {
      sessions7d++;
      totalMissRate7d += missRate;
      corrections7d += misses;
    } else {
      // Between 7d and 14d ago
      sessionsPrev++;
      totalMissRatePrev += missRate;
      correctionsPrev += misses;
    }
  }

  // Compute average miss rates
  const avgMissRate = sessions7d > 0 ? totalMissRate7d / sessions7d : 0;
  const avgMissRatePrev = sessionsPrev > 0 ? totalMissRatePrev / sessionsPrev : 0;

  // Determine trend (0.02 threshold)
  let missRateTrend: 'improving' | 'stable' | 'degrading' = 'stable';
  if (sessionsPrev > 0) {
    const diff = avgMissRate - avgMissRatePrev;
    if (Math.abs(diff) > 0.02) {
      missRateTrend = diff < 0 ? 'improving' : 'degrading';
    }
  }

  // Count candidate patches from last 7 days
  let skillsImproved = 0;
  try {
    const patchFiles = await readdir(PATCHES_DIR);
    for (const pf of patchFiles) {
      try {
        const st = await stat(join(PATCHES_DIR, pf));
        if (st.mtimeMs >= cutoff7d) {
          skillsImproved++;
        }
      } catch {
        continue;
      }
    }
  } catch {
    // No patches directory -- that's fine
  }

  // Build digest
  const sessionWord = sessions7d === 1 ? 'session' : 'sessions';
  let digest: string;
  if (correctionsPrev > 0) {
    digest = `${sessions7d} ${sessionWord}, ${corrections7d} corrections (down from ${correctionsPrev}), ${skillsImproved} skills improved`;
  } else {
    digest = `${sessions7d} ${sessionWord}, ${corrections7d} corrections, ${skillsImproved} skills improved`;
  }

  // Note insufficient data
  if (sessions7d < 5) {
    digest += ' (limited data)';
  }

  return {
    missRate: Math.round(avgMissRate * 1000) / 1000,
    missRateTrend,
    corrections: corrections7d,
    correctionsPrevPeriod: correctionsPrev,
    skillsImproved,
    sessions: sessions7d,
    digest,
    computedAt: new Date().toISOString(),
  };
}

/**
 * Validation gate stub -- always returns not approved in v1.
 * Future: replay candidate patches against test sessions.
 */
export function validatePatch(patch: { id: string; content: string }): {
  approved: boolean;
  reason: string;
  replayResults: unknown[];
} {
  return {
    approved: false,
    reason: 'Validation gate not yet implemented — patches require manual review',
    replayResults: [],
  };
}
