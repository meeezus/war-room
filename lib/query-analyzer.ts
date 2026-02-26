import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { ChatMessage } from './chat'
import { captureError } from '@/lib/sentry'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

interface QueryMetrics {
  queryId: string
  query: string
  response: string
  timestamp: string
  qualityScore: number
  efficiencyScore: number
  latencyMs: number | null
  issues: string[]
  suggestions: string[]
}

interface AnalysisReport {
  period: { start: string; end: string }
  totalQueries: number
  avgQualityScore: number
  avgEfficiencyScore: number
  criticalIssues: string[]
  proposals: ProposalDraft[]
}

interface ProposalDraft {
  title: string
  description: string
  domain: string
  priority: 'low' | 'medium' | 'high'
}

/**
 * Fetch user queries from the last 24 hours (excluding test/system messages)
 */
export async function fetchRecentQueries(): Promise<ChatMessage[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const yesterday = new Date()
  yesterday.setHours(yesterday.getHours() - 24)

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('role', 'user')
    .gte('created_at', yesterday.toISOString())
    .order('created_at', { ascending: true })

  if (error) throw error

  // Filter out test queries (common test patterns)
  const realQueries = (data || []).filter(
    (msg) =>
      !msg.content.toLowerCase().includes('test') &&
      !msg.content.toLowerCase().startsWith('hello') &&
      msg.content.length > 10
  )

  return realQueries
}

/**
 * Fetch the assistant response for a given user message
 */
async function fetchResponse(threadId: string, userMessageTime: string): Promise<string | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data } = await supabase
    .from('chat_messages')
    .select('content')
    .eq('thread_id', threadId)
    .eq('role', 'assistant')
    .gt('created_at', userMessageTime)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  return data?.content || null
}

/**
 * Evaluate a single query-response pair using Haiku
 */
async function evaluateQuery(
  query: string,
  response: string | null,
  queryId: string,
  timestamp: string
): Promise<QueryMetrics> {
  if (!response) {
    return {
      queryId,
      query,
      response: '',
      timestamp,
      qualityScore: 0,
      efficiencyScore: 0,
      latencyMs: null,
      issues: ['No response found'],
      suggestions: ['Investigate why query had no response'],
    }
  }

  const prompt = `Evaluate this clinical trials chat interaction:

USER QUERY: "${query}"
ASSISTANT RESPONSE: "${response}"

Assess:
1. Quality (1-10): How well did the response answer the query? Consider depth, accuracy, relevance.
2. Efficiency (1-10): Was the response concise yet complete? No unnecessary verbosity?
3. Issues: What went wrong or could be improved?
4. Suggestions: Specific actionable improvements

Respond in this exact JSON format:
{
  "qualityScore": <number 1-10>,
  "efficiencyScore": <number 1-10>,
  "issues": ["issue1", "issue2"],
  "suggestions": ["suggestion1", "suggestion2"]
}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type')
    }

    // Extract JSON from response (might be wrapped in markdown code blocks)
    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const evaluation = JSON.parse(jsonMatch[0])

    return {
      queryId,
      query,
      response,
      timestamp,
      qualityScore: evaluation.qualityScore,
      efficiencyScore: evaluation.efficiencyScore,
      latencyMs: null, // TODO: Track actual latency if available in metadata
      issues: evaluation.issues,
      suggestions: evaluation.suggestions,
    }
  } catch (err) {
    captureError(err, 'query-analyzer.evaluateQuery')
    return {
      queryId,
      query,
      response,
      timestamp,
      qualityScore: 5, // Default to middle score on error
      efficiencyScore: 5,
      latencyMs: null,
      issues: ['Evaluation failed'],
      suggestions: [],
    }
  }
}

/**
 * Generate improvement proposals from analysis results
 */
function generateProposals(metrics: QueryMetrics[]): ProposalDraft[] {
  const proposals: ProposalDraft[] = []

  // Calculate aggregate metrics
  const avgQuality = metrics.reduce((sum, m) => sum + m.qualityScore, 0) / metrics.length
  const avgEfficiency = metrics.reduce((sum, m) => sum + m.efficiencyScore, 0) / metrics.length

  // Low quality threshold
  if (avgQuality < 7) {
    const lowQualityExamples = metrics
      .filter((m) => m.qualityScore < 6)
      .slice(0, 3)
      .map((m) => `"${m.query}" (score: ${m.qualityScore})`)
      .join(', ')

    proposals.push({
      title: 'Improve Response Quality for Clinical Trial Queries',
      description: `Average quality score is ${avgQuality.toFixed(1)}/10. Low-scoring examples: ${lowQualityExamples}. Consider: better knowledge base coverage, more detailed clinical trial data integration, improved search relevance.`,
      domain: 'engineering',
      priority: 'high',
    })
  }

  // Low efficiency threshold
  if (avgEfficiency < 7) {
    proposals.push({
      title: 'Reduce Response Verbosity',
      description: `Average efficiency score is ${avgEfficiency.toFixed(1)}/10. Responses are too verbose. Implement response compression, prioritize key information, remove redundant explanations.`,
      domain: 'product',
      priority: 'medium',
    })
  }

  // Common issues
  const allIssues = metrics.flatMap((m) => m.issues)
  const issueCounts = allIssues.reduce(
    (acc, issue) => {
      acc[issue] = (acc[issue] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const topIssues = Object.entries(issueCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)

  for (const [issue, count] of topIssues) {
    if (count >= 3) {
      // Only create proposal if issue appears 3+ times
      proposals.push({
        title: `Fix Recurring Issue: ${issue}`,
        description: `This issue appeared in ${count} queries (${((count / metrics.length) * 100).toFixed(0)}% of analyzed queries). Investigate root cause and implement fix.`,
        domain: 'engineering',
        priority: count > 5 ? 'high' : 'medium',
      })
    }
  }

  // Common suggestions
  const allSuggestions = metrics.flatMap((m) => m.suggestions)
  const suggestionCounts = allSuggestions.reduce(
    (acc, sug) => {
      acc[sug] = (acc[sug] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const topSuggestions = Object.entries(suggestionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)

  for (const [suggestion, count] of topSuggestions) {
    if (count >= 3) {
      proposals.push({
        title: `Implement Recurring Suggestion: ${suggestion}`,
        description: `This improvement was suggested for ${count} queries. High-impact optimization opportunity.`,
        domain: 'product',
        priority: 'medium',
      })
    }
  }

  return proposals
}

/**
 * Main analysis function - analyzes last 24h of queries and generates report
 */
export async function analyzeQueries(): Promise<AnalysisReport> {
  const queries = await fetchRecentQueries()

  if (queries.length === 0) {
    return {
      period: {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      totalQueries: 0,
      avgQualityScore: 0,
      avgEfficiencyScore: 0,
      criticalIssues: ['No queries found in last 24h'],
      proposals: [],
    }
  }

  // Evaluate each query
  const metrics: QueryMetrics[] = []
  for (const query of queries) {
    const response = await fetchResponse(query.thread_id, query.created_at)
    const metric = await evaluateQuery(query.content, response, query.id, query.created_at)
    metrics.push(metric)
  }

  // Generate proposals
  const proposals = generateProposals(metrics)

  // Calculate aggregates
  const avgQuality = metrics.reduce((sum, m) => sum + m.qualityScore, 0) / metrics.length
  const avgEfficiency = metrics.reduce((sum, m) => sum + m.efficiencyScore, 0) / metrics.length

  const criticalIssues = metrics
    .filter((m) => m.qualityScore < 5)
    .map((m) => `Low quality response (${m.qualityScore}/10): "${m.query}"`)

  return {
    period: {
      start: queries[0].created_at,
      end: queries[queries.length - 1].created_at,
    },
    totalQueries: queries.length,
    avgQualityScore: avgQuality,
    avgEfficiencyScore: avgEfficiency,
    criticalIssues,
    proposals,
  }
}

/**
 * Create proposals in Supabase proposals table
 */
export async function createProposals(proposals: ProposalDraft[]): Promise<number> {
  if (proposals.length === 0) return 0

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const proposalData = proposals.map((p) => ({
    title: p.title,
    description: p.description,
    domain: p.domain,
    requested_by: 'Jack Query Analyzer',
    source: 'cron',
    status: 'pending',
  }))

  const { data, error } = await supabase.from('proposals').insert(proposalData).select()

  if (error) throw error

  return data?.length || 0
}
