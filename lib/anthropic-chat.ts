import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

/**
 * Stream a chat response from Claude via the Anthropic API.
 * This is the production-ready alternative to spawning Claude CLI.
 */
export function streamAnthropicChat(
  userMessage: string,
  options: {
    systemPrompt?: string
    model?: string
    maxTokens?: number
  } = {}
): ReadableStream<string> {
  const {
    systemPrompt,
    model = 'claude-sonnet-4-20250514',
    maxTokens = 4096,
  } = options

  return new ReadableStream<string>({
    async start(controller) {
      try {
        const stream = await anthropic.messages.stream({
          model,
          max_tokens: maxTokens,
          system: systemPrompt || undefined,
          messages: [{ role: 'user', content: userMessage }],
        })

        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(event.delta.text)
          }
        }

        controller.close()
      } catch (error) {
        console.error('[anthropic-chat] Stream error:', error)
        controller.error(error)
      }
    },
  })
}

/**
 * Check if Anthropic API is available (key is set)
 */
export function isAnthropicAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}
