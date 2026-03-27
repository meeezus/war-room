import { NextResponse } from 'next/server'
import { probeAllServices } from '@/lib/local-services'
import type { ServiceHealthResponse, ProbeResult } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const services = await probeAllServices()
    const entries = Object.values(services) as ProbeResult[]

    let overall: ServiceHealthResponse['overall']

    const allUnavailable = entries.length > 0 && entries.every(s => s.unavailable)
    if (allUnavailable) {
      overall = 'unavailable'
    } else {
      const nonUnavailable = entries.filter(s => !s.unavailable)
      const downCount = nonUnavailable.filter(s => !s.ok).length
      if (downCount === 0) {
        overall = 'nominal'
      } else if (downCount / nonUnavailable.length > 0.5) {
        overall = 'down'
      } else {
        overall = 'degraded'
      }
    }

    const body: ServiceHealthResponse = {
      overall,
      checkedAt: new Date().toISOString(),
      isLocal: !process.env.VERCEL,
      services,
    }

    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'no-cache' },
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
