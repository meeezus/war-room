/**
 * Weekly research scan cron — searches Brave for AI/agent news
 * and stores findings in the research_findings table.
 *
 * Scheduled via vercel.json: 0 8 * * 1 (every Monday at 8 AM UTC)
 *
 * Returns 200 always (Vercel only retries on 4xx/5xx).
 */

import { NextResponse } from 'next/server'
import { runResearchScan } from '@/lib/research-scan'
import { logger } from '@/lib/logger'
import { captureError } from '@/lib/sentry'

export const runtime = 'nodejs'
export const maxDuration = 30

const log = logger('cron/research-scan')

export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runResearchScan()
    log.info('Research scan cron complete', { inserted: result.inserted, topicsSearched: result.topicsSearched })
    return NextResponse.json({
      status: 'ok',
      ...result,
    })
  } catch (err) {
    log.error('Research scan cron failed', err)
    captureError(err, 'cron/research-scan', { operation: 'research_scan' })
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
