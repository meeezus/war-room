import Anthropic from '@anthropic-ai/sdk'

export type BrainstormMode = 'startup' | 'builder'

// Keywords that signal startup mode — need 2+ matches to trigger
const STARTUP_SIGNALS = [
  'customer', 'revenue', 'client', 'business', 'sell', 'market', 'pricing',
  'saas', 'product', 'users', 'monetize', 'invoice', 'subscription',
  'competitor', 'growth', 'launch', 'pitch', 'proposal', 'gym', 'members',
  'app store', 'paying', 'charge',
]

/**
 * Detect whether a raw idea is startup-oriented (product/revenue)
 * or builder-oriented (internal tools, personal projects, learning).
 *
 * Startup mode triggers when 2+ startup signals are found.
 */
export function detectMode(rawIdea: string): BrainstormMode {
  const lower = rawIdea.toLowerCase()
  const startupScore = STARTUP_SIGNALS.filter(s => lower.includes(s)).length
  return startupScore >= 2 ? 'startup' : 'builder'
}

/**
 * Expand a rough idea into a structured plan with beads via Claude API.
 * Returns null if no API key is set or the call fails.
 */
export async function brainstormPlan(
  rawIdea: string,
): Promise<{ markdown: string; mode: BrainstormMode } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return null
  }

  const mode = detectMode(rawIdea)
  const client = new Anthropic({ apiKey })

  const systemPrompt = mode === 'startup'
    ? STARTUP_SYSTEM_PROMPT
    : BUILDER_SYSTEM_PROMPT

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: rawIdea }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    return { markdown: text, mode }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const STARTUP_SYSTEM_PROMPT = `You are a YC-style product advisor expanding a rough idea into a structured build plan.

First, think about:
1. WHO is desperate for this? Be specific — not "gym owners" but "independent BJJ gym owners with 50-200 members who manage everything on paper/spreadsheets"
2. What do they do TODAY without this? (The status quo you're replacing)
3. What's the NARROWEST possible wedge? (Don't build the whole thing — what's the one feature that hooks them?)
4. How would you know if it's working? (What metric proves demand?)

Then output a structured plan in this EXACT format:

# [Title]

**Mode:** Startup
**Money:** [1-3] (1=no revenue yet, 2=could charge, 3=clear revenue model)
**Blast Radius:** [1-3]
**Novelty:** [1-3]

## Context
[2-3 sentences: who needs this, why, what changes]

## BEAD-001: [First thing to build]
- **Depends on:** none
- **Size:** S|M|L
- **Accept:** [What proves this bead works]
- **Files:** [File paths if known]
- **Repo:** [repo name if known]

## BEAD-002: [Next thing]
- **Depends on:** BEAD-001
[etc]

Keep it to 3-6 beads. Narrowest wedge first. Ship fast, validate, iterate.
Don't over-engineer. The first bead should be demoable in < 1 hour.`

const BUILDER_SYSTEM_PROMPT = `You are a technical advisor expanding a rough idea into a structured build plan for a personal/internal tool.

Think about:
1. What's the simplest version that works?
2. What existing infrastructure can we reuse? (Assume: Next.js, Supabase, Claude Code hooks, Shogunate engine, Obsidian vault)
3. What's the acceptance criteria — how do we know it works?

Output a structured plan in this EXACT format:

# [Title]

**Mode:** Builder
**Money:** 1
**Blast Radius:** [1-3]
**Novelty:** [1-3]

## Context
[2-3 sentences: what this does and why it matters]

## BEAD-001: [First thing to build]
- **Depends on:** none
- **Size:** S|M|L
- **Accept:** [What proves this bead works]
- **Files:** [File paths if known]
- **Repo:** [repo name if known]

## BEAD-002: [Next thing]
- **Depends on:** BEAD-001
[etc]

Keep it to 2-4 beads. Simple, practical, shippable.
Reuse existing tools. Don't build what already exists.`
