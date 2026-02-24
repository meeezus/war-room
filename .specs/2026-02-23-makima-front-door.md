# Makima as Front Door — Real Makima + Council Flow

## Experience Outcome

When I open Shoin Chat and talk to Makima, it's the REAL Makima — she knows what I did today, what I discussed on Discord, my current priorities. I brain-dump about Folio security. She distills it, channels the council voices, and says "Plan ready — sending to council." I click the link, land on the council page, see voice cards from L, Ed, Light. I review, click "Approve + Create Mission." Done. I walk away. The engine handles the rest.

## Sprint 0: Architecture Visual + Bug Fix [DONE]

- [x] S0-T1: Architecture visual — three surfaces HTML
- [x] S0-T2: Verify double-post bug fix

## Sprint 1: Real Makima — OpenClaw WebSocket [DONE]

- [x] S1-T1: OpenClaw WebSocket client (`lib/openclaw-client.ts`)
- [x] S1-T2: Wire OpenClaw into chat route for Makima (`app/api/chat/route.ts`)

## Sprint 2: Chat → Council Bridge [IN PROGRESS]

- [x] S2-T1: POST /api/chat/council endpoint (`app/api/chat/council/route.ts`)
- [x] S2-T2: "Send to Council" button + council links (`chat-actions.tsx`, `message-bubble.tsx`, `page.tsx`)
- [x] S2-T3: POST /api/missions endpoint (`app/api/missions/route.ts`)

## Rollback

- Sprint 1: Revert route.ts to always use spawnClaude
- Sprint 2: Remove council bridge files
