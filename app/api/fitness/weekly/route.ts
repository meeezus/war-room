import { NextResponse } from 'next/server';
import { computeFitness } from '@/lib/fitness-metric';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const dynamic = 'force-dynamic';

const HOME = process.env.HOME || '/Users/michaelenriquez';

export async function GET() {
  // On Vercel: return null fitness with isLocal: false
  if (process.env.VERCEL) {
    return NextResponse.json({
      isLocal: false,
      fitness: null,
    });
  }

  try {
    // Try pre-computed file first (from compute-fitness.sh)
    const precomputed = await readFile(
      join(HOME, '.spark', 'system_fitness.json'),
      'utf-8',
    )
      .then((raw) => JSON.parse(raw))
      .catch(() => null);

    if (precomputed) {
      // Map snake_case (shell script output) to camelCase (TypeScript type)
      return NextResponse.json({
        isLocal: true,
        fitness: {
          missRate: precomputed.miss_rate,
          missRateTrend: precomputed.miss_rate_trend,
          corrections: precomputed.corrections,
          correctionsPrevPeriod: precomputed.corrections_prev_period,
          skillsImproved: precomputed.skills_improved,
          sessions: precomputed.sessions,
          digest: precomputed.digest,
          computedAt: precomputed.computed_at,
        },
      });
    }

    // Fallback: compute on the fly
    const fitness = await computeFitness();
    return NextResponse.json({
      isLocal: true,
      fitness,
    });
  } catch (error) {
    return NextResponse.json(
      { isLocal: true, fitness: null, error: 'Failed to compute fitness' },
      { status: 500 },
    );
  }
}
