import Anthropic from '@anthropic-ai/sdk'
import type { PlanAnalysis, ParsedBead } from './types'

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
 * Analyze a plan using Claude API. Selects model based on flywheel score depth.
 * Falls back gracefully when no API key is set or when the API call fails.
 */
export async function analyzePlan(
  title: string,
  markdown: string,
  beads: ParsedBead[],
  score: number,
): Promise<PlanAnalysis> {
  const depth = getAnalysisDepth(score)

  // Score <= 4: skip analysis entirely
  if (depth === 'none') {
    return {
      depth: 'none',
      pushback: [],
      alternatives: [],
      blind_spots: [],
      recommendation: 'Low-stakes plan. Approved for auto-run.',
      analyzed_at: new Date().toISOString(),
    }
  }

  // Read API key at call time (not module load) so env changes are respected
  const apiKey = process.env.ANTHROPIC_API_KEY

  // No API key: return informative fallback
  if (!apiKey) {
    return {
      depth,
      pushback: ['Analysis requires ANTHROPIC_API_KEY — review manually'],
      alternatives: [],
      blind_spots: [],
      recommendation: `Score ${score} recommends ${depth} analysis. Add API key to enable.`,
      analyzed_at: new Date().toISOString(),
    }
  }

  const client = new Anthropic({ apiKey })

  // Select model based on depth: sonnet for quick, opus for deeper analysis
  const model = depth === 'quick' ? 'claude-sonnet-4-6' : 'claude-opus-4-6'

  const beadSummary = beads.map(b =>
    `- ${b.id}: ${b.title} (${b.repo}, ${b.size}, wave ${b.wave_index})`
  ).join('\n')

  const systemPrompt = `You are a senior technical advisor reviewing a project plan before execution. Your job is to find problems the author missed. Be direct and specific.

Return your analysis as JSON with this exact structure:
{
  "pushback": ["specific concern 1", "specific concern 2"],
  "alternatives": ["alternative approach 1"],
  "blind_spots": ["thing they didn't consider"],
  "recommendation": "one sentence: proceed, proceed with modifications, or reconsider"
}

Rules:
- Pushback: things that could go wrong or are poorly thought out. Be specific.
- Alternatives: better approaches they should consider
- Blind spots: risks, dependencies, or edge cases not mentioned
- Keep each item to 1-2 sentences
- Max 3 items per category
- If the plan is solid, say so — don't manufacture concerns`

  const userPrompt = `## Plan: ${title}

### Flywheel Score: ${score}/9

### Beads:
${beadSummary}

### Full Plan:
${markdown.slice(0, 8000)}`

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    // Extract JSON from response (may be wrapped in markdown code block)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return {
        depth,
        pushback: ['Analysis returned non-JSON response'],
        alternatives: [],
        blind_spots: [],
        recommendation: text.slice(0, 200),
        analyzed_at: new Date().toISOString(),
      }
    }

    const parsed = JSON.parse(jsonMatch[0])

    return {
      depth,
      pushback: Array.isArray(parsed.pushback) ? parsed.pushback.slice(0, 3) : [],
      alternatives: Array.isArray(parsed.alternatives) ? parsed.alternatives.slice(0, 3) : [],
      blind_spots: Array.isArray(parsed.blind_spots) ? parsed.blind_spots.slice(0, 3) : [],
      recommendation: typeof parsed.recommendation === 'string' ? parsed.recommendation : 'Review manually.',
      analyzed_at: new Date().toISOString(),
    }
  } catch (err) {
    return {
      depth,
      pushback: [`Analysis failed: ${err instanceof Error ? err.message : 'unknown error'}`],
      alternatives: [],
      blind_spots: [],
      recommendation: 'Analysis errored — review manually.',
      analyzed_at: new Date().toISOString(),
    }
  }
}

/**
 * Create a stub analysis placeholder. Kept for backward compatibility.
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
