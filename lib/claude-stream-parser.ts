export type StreamEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_use'; tool: string; input: unknown }
  | { type: 'tool_result'; content: string }
  | { type: 'agent_spawn'; name: string; task: string }
  | { type: 'status'; message: string }
  | { type: 'error'; message: string }
  | { type: 'done' }

interface RawChunk {
  type: string
  subtype?: string
  message?: {
    content: Array<{
      type: string
      text?: string
      name?: string
      input?: unknown
      content?: string | Array<{ type: string; text?: string }>
    }>
  }
  result?: string
  errors?: string[]
}

/**
 * Parse one line of Claude --output-format stream-json output.
 * Returns a StreamEvent or null if the line is not actionable.
 */
export function parseStreamLine(line: string): StreamEvent | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  let chunk: RawChunk
  try {
    chunk = JSON.parse(trimmed)
  } catch {
    return null
  }

  // Assistant message — text or tool_use blocks
  if (chunk.type === 'assistant' && chunk.message?.content) {
    for (const block of chunk.message.content) {
      if (block.type === 'text' && block.text) {
        return { type: 'text', content: block.text }
      }
      if (block.type === 'tool_use' && block.name) {
        // Detect agent_spawn heuristic: Task tool calls
        if (block.name === 'Task' && block.input && typeof block.input === 'object') {
          const input = block.input as Record<string, unknown>
          const agentName = typeof input.agent_name === 'string' ? input.agent_name : 'agent'
          const task = typeof input.prompt === 'string' ? input.prompt : ''
          return { type: 'agent_spawn', name: agentName, task }
        }
        return { type: 'tool_use', tool: block.name, input: block.input ?? null }
      }
    }
  }

  // User message (tool results)
  if (chunk.type === 'user' && chunk.message?.content) {
    for (const block of chunk.message.content) {
      if (block.type === 'tool_result') {
        const raw = block.content
        if (typeof raw === 'string') {
          return { type: 'tool_result', content: raw }
        }
        if (Array.isArray(raw)) {
          const text = raw
            .filter((b) => b.type === 'text' && b.text)
            .map((b) => b.text)
            .join('\n')
          return { type: 'tool_result', content: text }
        }
      }
    }
  }

  // Result / completion message
  if (chunk.type === 'result') {
    if (chunk.errors?.length) {
      return { type: 'error', message: chunk.errors.join('; ') }
    }
    return { type: 'done' }
  }

  // System status messages
  if (chunk.type === 'system' && chunk.subtype) {
    return { type: 'status', message: chunk.subtype }
  }

  return null
}
