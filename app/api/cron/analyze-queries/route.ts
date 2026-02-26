import { NextRequest, NextResponse } from 'next/server'
import { analyzeQueries, createProposals } from '@/lib/query-analyzer'
import { captureError } from '@/lib/sentry'

/**
 * Daily cron job - analyzes Jack's queries from last 24h and creates improvement proposals
 *
 * Scheduled via vercel.json: 0 9 * * * (9am daily)
 *
 * Process:
 * 1. Fetch real user queries from last 24h
 * 2. Evaluate each with Haiku (quality, efficiency, issues)
 * 3. Aggregate metrics and identify patterns
 * 4. Generate actionable proposals
 * 5. Auto-create proposals in War Room
 *
 * Cost: ~$0.02/day (Haiku @ $0.25/MTok)
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret (Vercel cron jobs send this header)
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[cron] Starting daily query analysis...')
    const startTime = Date.now()

    // Analyze queries
    const report = await analyzeQueries()

    console.log('[cron] Analysis complete:', {
      totalQueries: report.totalQueries,
      avgQuality: report.avgQualityScore.toFixed(2),
      avgEfficiency: report.avgEfficiencyScore.toFixed(2),
      proposalsGenerated: report.proposals.length,
    })

    // Create proposals in War Room
    let proposalsCreated = 0
    if (report.proposals.length > 0) {
      proposalsCreated = await createProposals(report.proposals)
      console.log(`[cron] Created ${proposalsCreated} proposals`)
    }

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      report: {
        period: report.period,
        totalQueries: report.totalQueries,
        avgQualityScore: report.avgQualityScore,
        avgEfficiencyScore: report.avgEfficiencyScore,
        criticalIssues: report.criticalIssues,
        proposalsCreated,
      },
      durationMs: duration,
    })
  } catch (err) {
    captureError(err, 'cron/analyzeQueries')

    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
