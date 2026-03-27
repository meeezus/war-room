import { NextResponse } from 'next/server'
import {
  probeSparkInsights,
  probeTabLedger,
  probeLosslessClaw,
  probePipelineState,
  probeSystemFitness,
} from '@/lib/local-services'
import type { MemoryStatusResponse, SystemFitness } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [spark, tabLedger, lossless, pipeline, fitnessProbe] = await Promise.all([
      probeSparkInsights(),
      probeTabLedger(),
      probeLosslessClaw(),
      probePipelineState(),
      probeSystemFitness(),
    ])

    // Parse fitness from probe meta if available
    let fitness: SystemFitness | null = null
    if (fitnessProbe.ok && fitnessProbe.meta) {
      const m = fitnessProbe.meta
      if (typeof m.missRate === 'number' && typeof m.missRateTrend === 'string') {
        fitness = {
          missRate: m.missRate as number,
          missRateTrend: m.missRateTrend as SystemFitness['missRateTrend'],
          corrections: (m.corrections as number) ?? 0,
          correctionsPrevPeriod: (m.correctionsPrevPeriod as number) ?? 0,
          skillsImproved: (m.skillsImproved as number) ?? 0,
          sessions: (m.sessions as number) ?? 0,
          digest: (m.digest as string) ?? '',
          computedAt: (m.computedAt as string) ?? '',
        }
      }
    }

    // Build layer objects: ok + detail + spread meta
    function buildLayer(probe: { ok: boolean; detail: string; meta?: Record<string, unknown> }) {
      return { ok: probe.ok, detail: probe.detail, ...(probe.meta ?? {}) }
    }

    const body: MemoryStatusResponse = {
      checkedAt: new Date().toISOString(),
      isLocal: !process.env.VERCEL,
      layers: {
        spark: buildLayer(spark),
        tab_ledger: buildLayer(tabLedger),
        lossless_claw: buildLayer(lossless),
        pipeline: buildLayer(pipeline),
      },
      fitness,
    }

    return NextResponse.json(body)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
