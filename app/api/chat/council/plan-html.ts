/**
 * HTML plan visual generation for council reviews.
 * Generates a prompt for Claude to produce a self-contained HTML page
 * visualizing the conversation's key decisions and action items.
 */

export function buildPlanHtmlPrompt(conversationText: string): string {
  return `Analyze this conversation and generate a self-contained HTML page that visually summarizes it.

<conversation>
${conversationText}
</conversation>

Create a visual summary including:
- Key decisions made or proposed
- Action items and next steps
- Architecture or system diagrams if technically relevant
- Risk areas or concerns raised
- A clear visual hierarchy of information

Design requirements:
- Self-contained HTML (inline CSS, no external dependencies)
- Dark theme with background #0a0a0a
- Use this CSS palette:
  --bg: #0a0a0a; --surface: #141414; --text: #fafafa; --text-dim: #888;
  --green: #22c55e; --red: #ef4444; --amber: #f59e0b; --blue: #3b82f6;
- Fonts: Inter for body text, JetBrains Mono for code/technical content
  (use Google Fonts CDN links or system font fallbacks)
- Responsive layout, readable on desktop and tablet
- Clean typography with good spacing

Return ONLY the complete HTML document. No markdown fences, no explanatory text, no preamble. Start with <!DOCTYPE html> and end with </html>.`
}

export function stripHtmlFences(raw: string): string {
  let cleaned = raw.trim()
  if (cleaned.startsWith('```html')) {
    cleaned = cleaned.slice(7)
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3)
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3)
  }
  return cleaned.trim()
}
