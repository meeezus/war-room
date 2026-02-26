import { NextRequest } from 'next/server'
import { getMessages, getThread } from '@/lib/chat'
import { spawnClaude, type ClaudeSession } from '@/lib/claude-cli'
import { createServiceClient } from '@/lib/supabase-server'
import { randomUUID } from 'crypto'
import { buildPlanHtmlPrompt, stripHtmlFences } from './plan-html'
import { buildCouncilPrompt } from './council-prompt'
import { captureError, captureWarning } from '@/lib/sentry'

export const runtime = 'nodejs'
export const maxDuration = 120

// ---- Types ----

interface CouncilReview {
  name: string
  verdict: 'approve' | 'concern' | 'reject' | 'abstain'
  voice_text: string
}

interface CouncilOutput {
  reviews: CouncilReview[]
  synthesis: string
  recommendation: string
  dissent: string | null
}

// ---- Council type auto-detection ----

const COUNCIL_TYPE_KEYWORDS: Record<string, string[]> = {
  security: ['security', 'auth', 'vulnerability', 'exploit', 'permission', 'token', 'secret', 'encrypt'],
  technical: ['architecture', 'refactor', 'database', 'api', 'schema', 'migration', 'performance', 'infra'],
  business: ['revenue', 'user growth', 'market', 'pricing', 'roi', 'okr', 'kpi', 'roadmap'],
}

function detectCouncilType(text: string): 'full' | 'technical' | 'business' | 'security' {
  const lower = text.toLowerCase()
  let bestType: string = 'full'
  let bestScore = 0
  for (const [type, keywords] of Object.entries(COUNCIL_TYPE_KEYWORDS)) {
    const score = keywords.filter((kw) => lower.includes(kw)).length
    if (score > bestScore) {
      bestScore = score
      bestType = type
    }
  }
  return bestType as 'full' | 'technical' | 'business' | 'security'
}

// ---- Collect full text from spawnClaude stream ----

async function collectStream(stream: ReadableStream<string>): Promise<string> {
  const reader = stream.getReader()
  let result = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    result += value
  }
  return result
}

// ---- Parse Claude's JSON response ----

function parseCouncilOutput(raw: string): CouncilOutput {
  // Claude may wrap JSON in markdown fences — strip them
  let cleaned = raw.trim()
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7)
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3)
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3)
  }
  cleaned = cleaned.trim()

  const parsed = JSON.parse(cleaned)

  // Validate structure
  if (!Array.isArray(parsed.reviews) || parsed.reviews.length === 0) {
    throw new Error('Council output missing reviews array')
  }
  for (const r of parsed.reviews) {
    if (!r.name || !r.voice_text) {
      throw new Error(`Invalid review entry: missing name or voice_text`)
    }
    if (!['approve', 'concern', 'reject', 'abstain'].includes(r.verdict)) {
      r.verdict = 'concern' // default if Claude gave something unexpected
    }
  }
  if (!parsed.synthesis || typeof parsed.synthesis !== 'string') {
    parsed.synthesis = 'No synthesis provided.'
  }
  if (!parsed.recommendation || typeof parsed.recommendation !== 'string') {
    parsed.recommendation = 'No recommendation provided.'
  }

  return {
    reviews: parsed.reviews,
    synthesis: parsed.synthesis,
    recommendation: parsed.recommendation,
    dissent: parsed.dissent ?? null,
  }
}

// ---- Route handler ----

export async function POST(req: NextRequest) {
  const sb = createServiceClient()
  if (!sb) {
    return Response.json({ error: 'Service unavailable' }, { status: 500 })
  }

  let body: { threadId?: string; councilType?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { threadId, councilType } = body

  if (!threadId || typeof threadId !== 'string') {
    return Response.json({ error: 'threadId is required' }, { status: 400 })
  }

  // 1. Fetch thread info
  const thread = await getThread(threadId)
  if (!thread) {
    return Response.json({ error: 'Thread not found' }, { status: 404 })
  }

  // 2. Fetch last 20 messages
  const allMessages = await getMessages(threadId)
  const messages = allMessages.slice(-20)

  if (messages.length === 0) {
    return Response.json({ error: 'Thread has no messages' }, { status: 400 })
  }

  // 3. Format conversation
  const conversationText = messages
    .map((m) => {
      const speaker = m.role === 'user' ? 'Sensei' : (m.agent_id || 'Assistant')
      return `[${speaker}]: ${m.content}`
    })
    .join('\n\n')

  // 4. Auto-detect council type
  const resolvedType = councilType as 'full' | 'technical' | 'business' | 'security'
    || detectCouncilType(conversationText)

  // 5. Generate topic from thread title or first message
  const topic = thread.title && thread.title !== 'New Thread'
    ? thread.title
    : messages[0].content.slice(0, 120)

  // 6. Run council review + HTML plan generation in parallel
  const prompt = buildCouncilPrompt(conversationText)
  const reviewSession: ClaudeSession = {
    sessionId: randomUUID(),
    threadId: `council-${threadId}`,
  }

  const [reviewResult, htmlResult] = await Promise.allSettled([
    // Voice review generation (critical path)
    (async () => {
      const stream = spawnClaude(prompt, reviewSession, { resume: false })
      const raw = await collectStream(stream)
      return parseCouncilOutput(raw)
    })(),
    // HTML plan visual generation (enhancement)
    (async () => {
      const htmlPrompt = buildPlanHtmlPrompt(conversationText)
      const htmlSession: ClaudeSession = {
        sessionId: randomUUID(),
        threadId: `council-html-${threadId}`,
      }
      const stream = spawnClaude(htmlPrompt, htmlSession, { resume: false })
      return collectStream(stream)
    })(),
  ])

  // 7. Handle review result (critical — fail if missing)
  if (reviewResult.status === 'rejected') {
    captureError(reviewResult.reason, 'chat/council.claudeCliError', { threadId })
    return Response.json(
      { error: 'Failed to generate council review' },
      { status: 502 }
    )
  }

  const councilOutput = reviewResult.value
  if (!councilOutput.reviews?.length) {
    return Response.json(
      { error: 'Empty response from council generation' },
      { status: 502 }
    )
  }

  // 8. Handle HTML result (non-critical — proceed without it)
  let planHtml: string | null = null
  if (htmlResult.status === 'fulfilled' && htmlResult.value.trim()) {
    planHtml = stripHtmlFences(htmlResult.value)
  } else if (htmlResult.status === 'rejected') {
    captureWarning('HTML generation failed (non-critical)', { threadId, operation: 'chat/council.htmlGeneration' })
  }

  // 9. Persist to council_sessions
  const { data, error } = await sb
    .from('council_sessions')
    .insert({
      topic,
      council_type: resolvedType,
      reviews: councilOutput.reviews,
      synthesis: councilOutput.synthesis,
      recommendation: councilOutput.recommendation,
      dissent: councilOutput.dissent,
      plan_html: planHtml,
      source: 'shoin_chat',
      metadata: { threadId },
    })
    .select()
    .single()

  if (error) {
    captureError(error, 'chat/council.insert', { threadId })
    return Response.json({ error: 'Failed to create council session' }, { status: 500 })
  }

  return Response.json({ session: data }, { status: 201 })
}
