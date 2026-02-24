import { NextRequest } from 'next/server'
import { getMessages, getThread } from '@/lib/chat'
import { spawnClaude, type ClaudeSession } from '@/lib/claude-cli'
import { createServiceClient } from '@/lib/supabase-server'
import { randomUUID } from 'crypto'

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

// ---- Prompt ----

function buildCouncilPrompt(conversationText: string): string {
  return `Given this conversation from Shoin Chat:

<conversation>
${conversationText}
</conversation>

You are channeling the Daimyo council. Five voices must review this conversation and provide strategic guidance.

The voices:
- **Light** (Strategy) — Sees the big picture. Evaluates alignment with goals and long-term direction.
- **L** (Analysis) — Deconstructs logic. Finds gaps, contradictions, and hidden assumptions.
- **Ed** (Engineering) — Evaluates technical feasibility, implementation cost, and engineering tradeoffs.
- **Major** (Operations) — Assesses operational readiness, resource requirements, and execution risk.
- **Nanami** (Finance) — Weighs cost-benefit, ROI, and resource allocation efficiency.

For each voice, provide:
1. A verdict: "approve" (proceed), "concern" (proceed with caveats), or "reject" (do not proceed)
2. A 2-4 sentence review in that voice's perspective

Then provide:
- synthesis: A 2-3 sentence overall assessment combining all perspectives
- recommendation: A concrete 1-2 sentence action item (what to do next)
- dissent: If any voice strongly disagrees with the majority, capture that here. Otherwise null.

Respond with ONLY valid JSON in this exact format (no markdown fences, no extra text):
{
  "reviews": [
    { "name": "Light", "verdict": "approve", "voice_text": "..." },
    { "name": "L", "verdict": "concern", "voice_text": "..." },
    { "name": "Ed", "verdict": "approve", "voice_text": "..." },
    { "name": "Major", "verdict": "approve", "voice_text": "..." },
    { "name": "Nanami", "verdict": "concern", "voice_text": "..." }
  ],
  "synthesis": "Overall assessment...",
  "recommendation": "What to do next...",
  "dissent": null
}`
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

  // 6. Call Claude with council prompt (fresh session, no resume)
  const prompt = buildCouncilPrompt(conversationText)
  const session: ClaudeSession = {
    sessionId: randomUUID(),
    threadId: `council-${threadId}`,
  }

  let rawResponse: string
  try {
    const stream = spawnClaude(prompt, session, { resume: false })
    rawResponse = await collectStream(stream)
  } catch (err) {
    console.error('[chat/council] Claude CLI error:', err)
    return Response.json(
      { error: 'Failed to generate council review' },
      { status: 502 }
    )
  }

  if (!rawResponse.trim()) {
    return Response.json(
      { error: 'Empty response from council generation' },
      { status: 502 }
    )
  }

  // 7. Parse structured output
  let councilOutput: CouncilOutput
  try {
    councilOutput = parseCouncilOutput(rawResponse)
  } catch (err) {
    console.error('[chat/council] Parse error:', err, '\nRaw:', rawResponse.slice(0, 500))
    return Response.json(
      { error: 'Failed to parse council output' },
      { status: 502 }
    )
  }

  // 8. Persist to council_sessions
  const { data, error } = await sb
    .from('council_sessions')
    .insert({
      topic,
      council_type: resolvedType,
      reviews: councilOutput.reviews,
      synthesis: councilOutput.synthesis,
      recommendation: councilOutput.recommendation,
      dissent: councilOutput.dissent,
      source: 'shoin_chat',
      metadata: { threadId },
    })
    .select()
    .single()

  if (error) {
    console.error('[chat/council] Supabase insert error:', error)
    return Response.json({ error: 'Failed to create council session' }, { status: 500 })
  }

  return Response.json({ session: data }, { status: 201 })
}
