import { spawn } from 'child_process'

const CLAUDE_PATH = '/opt/homebrew/bin/claude'
const TIMEZONE = 'America/Chicago'

export interface ClaudeSession {
  sessionId: string
  threadId: string
}

interface StreamChunk {
  type: string
  subtype?: string
  message?: {
    content: Array<{ type: string; text?: string }>
  }
  content?: string
  session_id?: string
  result?: string
  errors?: string[]
}

/**
 * Spawn `claude --print` and return a ReadableStream of text chunks.
 * Each chunk is a piece of Claude's response text as it arrives.
 */
export function spawnClaude(
  prompt: string,
  session: ClaudeSession,
  options?: {
    resume?: boolean
    workingDir?: string
  }
): ReadableStream<string> {
  const resume = options?.resume ?? false
  const cwd = options?.workingDir ?? process.cwd()

  const args = [
    '--print',
    '--verbose',
    '--output-format', 'stream-json',
  ]

  if (resume) {
    args.push('--resume', session.sessionId)
  } else {
    args.push('--session-id', session.sessionId)
  }

  const now = new Date().toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TIMEZONE,
  })
  args.push(
    '--append-system-prompt',
    `Current date/time: ${now}. User: Michael Enriquez (Sensei). This is Shoin Chat — War Room's chat interface.`
  )
  args.push('-p', prompt)

  let proc: ReturnType<typeof spawn>

  return new ReadableStream<string>({
    start(controller) {
      proc = spawn(CLAUDE_PATH, args, {
        cwd,
        env: { ...process.env, TZ: TIMEZONE },
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let buffer = ''
      let stderrOutput = ''

      function processLine(line: string) {
        if (!line.trim()) return
        try {
          const chunk: StreamChunk = JSON.parse(line)

          if (chunk.type === 'assistant' && chunk.message?.content) {
            for (const block of chunk.message.content) {
              if (block.type === 'text' && block.text) {
                controller.enqueue(block.text)
              }
            }
          }

          if (chunk.type === 'result' && chunk.errors?.length) {
            console.error('[claude-cli] Result errors:', chunk.errors)
          }
        } catch {
          // Non-JSON line, skip
        }
      }

      proc.stdout!.on('data', (data: Buffer) => {
        buffer += data.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          processLine(line)
        }
      })

      proc.stderr!.on('data', (data: Buffer) => {
        stderrOutput += data.toString()
      })

      proc.on('close', (code) => {
        // Process remaining buffer
        if (buffer.trim()) processLine(buffer)

        if (code !== 0 && code !== null) {
          controller.error(new Error(`Claude CLI exited with code ${code}: ${stderrOutput.slice(0, 500)}`))
        } else {
          controller.close()
        }
      })

      proc.on('error', (err) => {
        controller.error(err)
      })
    },
    cancel() {
      proc?.kill()
    },
  })
}
