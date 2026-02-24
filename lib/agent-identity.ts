import { readFileSync } from 'fs'
import { resolve } from 'path'

const HOME = process.env.HOME || '/Users/michaelenriquez'

const AGENT_IDENTITY_PATHS: Record<string, string[]> = {
  makima: [
    resolve(HOME, 'clawd/x/SOUL.md'),
    resolve(HOME, 'clawd/x/PRINCIPLES.md'),
  ],
  ed: [resolve(HOME, 'Code/shogunate/skills/Ed-SKILL.md')],
  light: [resolve(HOME, 'Code/shogunate/skills/Light-SKILL.md')],
  major: [resolve(HOME, 'Code/shogunate/skills/Major-SKILL.md')],
  bulma: [resolve(HOME, 'Code/shogunate/skills/Bulma-SKILL.md')],
  l: [resolve(HOME, 'Code/shogunate/skills/L-SKILL.md')],
  nanami: [resolve(HOME, 'Code/shogunate/skills/Nanami-SKILL.md')],
  armin: [resolve(HOME, 'Code/shogunate/skills/Armin-SKILL.md')],
}

export function getAgentSystemPrompt(agentId: string): string | null {
  const paths = AGENT_IDENTITY_PATHS[agentId]
  if (!paths) return null

  try {
    let prompt = paths
      .map(p => readFileSync(p, 'utf-8'))
      .join('\n\n')

    // Append pulse integration instructions for Makima
    if (agentId === 'makima') {
      prompt += '\n\n## Pulse Integration\nYou have access to the Shogunate engine via pulse context. When you receive a [PULSE CONTEXT] block, use that information to inform your responses. You can reference active projects, missions, and tasks by name. When asked to take action (create missions, update tasks, etc.), use the [ACTION] block format described in the pulse context.'
    }

    return prompt
  } catch {
    console.error(`[agent-identity] Failed to read identity for ${agentId}`)
    return null
  }
}

export const AGENTS_WITH_IDENTITY = ['cc', ...Object.keys(AGENT_IDENTITY_PATHS)]
