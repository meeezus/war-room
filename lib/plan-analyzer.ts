import type { PlanAnalysis } from './types'

/**
 * Determine analysis depth based on flywheel score.
 *
 * Score ranges:
 *   1-4  -> none     (skip analysis, low-stakes)
 *   5-6  -> quick    (lightweight review)
 *   7-8  -> polyclaude (multi-perspective)
 *   9    -> council-matrix (full council review)
 */
export function getAnalysisDepth(score: number): PlanAnalysis['depth'] {
  if (score <= 4) return 'none'
  if (score <= 6) return 'quick'
  if (score <= 8) return 'polyclaude'
  return 'council-matrix'
}

/**
 * Create a stub analysis placeholder.
 * Real agent-powered analysis will replace this in a future sprint.
 */
export function createStubAnalysis(score: number): PlanAnalysis {
  const depth = getAnalysisDepth(score)
  return {
    depth,
    pushback: depth === 'none' ? [] : ['Analysis agent not yet wired — review manually for now'],
    alternatives: [],
    blind_spots: [],
    recommendation: depth === 'none'
      ? 'Low-stakes plan. Approve when ready.'
      : `Score ${score} — ${depth} analysis recommended. Agent integration coming soon.`,
    analyzed_at: new Date().toISOString(),
  }
}
