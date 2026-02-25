import { MAKIMA_SYNTHESIS_PROMPT } from '@/lib/makima-synthesis-prompt'

export function buildCouncilPrompt(conversationText: string): string {
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

Then provide (speaking as Makima, the COO and strategic synthesizer):
${MAKIMA_SYNTHESIS_PROMPT}

Your synthesis fields:
- synthesis: A 2-3 sentence overall assessment in Makima's voice
- recommendation: A concrete 1-2 sentence action item (Makima's call)
- dissent: If any voice strongly disagrees with the majority, Makima captures that here. Otherwise null.

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
