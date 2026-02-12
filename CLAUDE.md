# War Room — Shogunate Command Center

## What This Is
Dashboard + chat interface for managing agent workflows (CC + Pip). Local-first, runs via `npm run dev` or Tauri desktop app.

## Tech Stack
- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **Styling:** Tailwind CSS v4 (no tailwind.config — uses CSS-based config)
- **UI:** shadcn/ui primitives in `components/ui/`, Lucide icons, Motion animations
- **Data:** Supabase (hosted) — REST API + Realtime subscriptions
- **Desktop:** Tauri v2 (Rust wrapper)
- **Fonts:** Inter (body), Space Grotesk (headings), JetBrains Mono (code/data)
- **Theme:** Dark (bg-zinc-950, emerald accents)

## Key Architecture
- `lib/supabase.ts` — Client-side Supabase (anon key, for Realtime)
- `lib/supabase-server.ts` — Server-side Supabase (service role key, for mutations)
- `lib/claude-cli.ts` — Spawns `claude --print` CLI, returns ReadableStream for streaming
- `app/api/chat/route.ts` — SSE endpoint that bridges CLI streaming to browser
- `lib/chat.ts` — Supabase queries for chat (server-side, uses service role)
- `lib/queries.ts` — Supabase queries for missions/projects (server-side)

## Conventions
- Components in `components/` (flat, no nested folders except `chat/` and `ui/`)
- Server data fetching in `lib/queries.ts` and `lib/chat.ts`
- Client Realtime hooks in `lib/realtime.ts`
- Dark theme everywhere — use `bg-zinc-950`, `text-zinc-100`, `border-zinc-800`
- Emerald for primary/accent: `text-emerald-400`, `bg-emerald-600`
- Font classes: `font-[family-name:var(--font-space-grotesk)]` for headings

## Commands
```bash
npm run dev          # Next.js dev server (port 3000)
npm run build        # Production build (use --webpack flag, in package.json)
npm run tauri:dev    # Tauri desktop app (wraps dev server)
```

## Supabase
- Project: `qcklchfcnxddvigjrwed`
- Tables: `missions`, `proposals`, `projects`, `project_agents`, `chat_threads`, `chat_messages`, `agent_presence`, `war_room_events`
- Env vars in `.env.local` (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)

## Chat (Shoin Chat)
- Claude CLI spawned server-side via `child_process.spawn`
- Session resume via `--resume UUID` for multi-turn conversations
- Session IDs stored in thread metadata (Supabase)
- Won't work on Vercel (needs local CLI) — local/Tauri only
- Agent presence table has: cc, pip, ed, light, toji, power, major

## Do NOT
- Deploy chat routes to Vercel (CLI spawning is local-only)
- Use `--dangerously-skip-permissions` in CLI spawner
- Create new Supabase clients inline — use `lib/supabase.ts` or `lib/supabase-server.ts`
