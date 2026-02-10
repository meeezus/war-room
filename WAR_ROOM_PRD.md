# War Room Dashboard - PRD

## Vision
Real-time command dashboard for the Shogunate AI executive council.

## Layout (from screenshot)
- **LEFT SIDEBAR:** Agent list with status (online/offline/busy)
- **CENTER:** Kanban board (Backlog → Pending → In Progress → Done)
- **TOP BAR:** System status, agent counts, queue depth
- **RIGHT PANE:** Live event feed with timestamps

## Tech Stack
- Next.js 14 + TypeScript
- Tailwind + shadcn/ui
- Supabase (PostgreSQL + Realtime)
- PWA (next-pwa)
- React Query for server state

## Features
1. Kanban drag-and-drop (dnd-kit)
2. Real-time updates (Supabase subscriptions)
3. Agent status indicators
4. Event feed with auto-scroll
5. Mobile-responsive
6. PWA installable

## Data Source
Read from ~/Shugyo/Shogunate/ markdown files initially
Migrate to Supabase for real-time features

## Pages
- /dashboard - Main war room view
- /agents - Agent management
- /tasks - Full task list
