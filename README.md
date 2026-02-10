# War Room

Real-time dashboard for the Shogunate AI council - mission control for multi-agent orchestration.

## What It Does

Visual command center for monitoring and managing AI agent operations:
- **Dashboard**: Real-time mission status, agent activity, cost tracking
- **Agents**: Daimyo council health, workload distribution, capability overview
- **Missions**: Active tasks, step execution timeline, completion rates
- **Projects**: High-level project tracking and resource allocation

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  War Room (Next.js 16 + PWA)                                    │
├──────────────────┬─────────────────┬────────────────────────────┤
│  Dashboard       │  Agents         │  Missions                  │
│  - Live metrics  │  - Daimyo grid  │  - Step timeline           │
│  - Cost graphs   │  - Status cards │  - Execution logs          │
│  - Activity feed │  - Capabilities │  - Success rates           │
└────────┬─────────┴────────┬────────┴─────────────┬──────────────┘
         │                  │                      │
         └──────────────────┼──────────────────────┘
                            │
                    ┌───────┴───────┐
                    │   Supabase    │
                    │  (Realtime)   │
                    └───────────────┘
                            │
                    ┌───────┴───────┐
                    │   Shogunate   │
                    │    Engine     │
                    └───────────────┘
```

## Daimyo Council Visualization

| Agent | Domain | Role |
|-------|--------|------|
| **Pip** | Coordination | Primary orchestrator, proposal routing |
| **Edward Wong** | Engineering | Code execution, technical tasks |
| **Light Yagami** | Product | Feature planning, prioritization |
| **Toji Fushiguro** | Commerce | Revenue, business operations |
| **Power** | Influence | Social, content, marketing |
| **Major Kusanagi** | Operations | Infrastructure, monitoring |

## Key Features

### Real-Time Updates
- Supabase Realtime subscriptions
- Live mission progress streaming
- Agent status heartbeats

### PWA Support
- Installable on desktop/mobile
- Offline capability
- Push notifications for mission events

### Cap Gate Monitoring
- Cost tracking against daily limits
- Auto-approval threshold visualization
- Risk level indicators

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router) |
| UI | Tailwind + shadcn/ui |
| Database | Supabase (Postgres + Realtime) |
| Deploy | Vercel |
| PWA | next-pwa |

## Project Structure

```
war-room/
├── app/
│   ├── dashboard/    # Main command center
│   ├── agents/       # Daimyo council view
│   ├── missions/     # Mission tracking
│   ├── projects/     # Project overview
│   └── offline/      # PWA offline page
├── components/       # Shared UI components
└── lib/             # Supabase client, utilities
```

## Local Development

```bash
npm install

cp .env.example .env.local
# Add: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

npm run dev
```

## Integration

War Room connects to the Shogunate Engine via shared Supabase database:
- Engine writes mission/step/event data
- War Room subscribes to Realtime changes
- Same RLS policies ensure consistent access

## Status

Active development. Visualization layer for Shogunate multi-agent system.
