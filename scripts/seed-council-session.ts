#!/usr/bin/env node
// Run with: npx tsx scripts/seed-council-session.ts
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const sb = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const session = {
  topic: 'Mission Control vs Discord: Where should we build the Shogunate War Room?',
  council_type: 'full',
  source: 'claude_code',
  reviews: [
    {
      name: 'Ed',
      verdict: 'approve',
      voice_text: "War Room is the move. Discord's fine for chat but you can't build stateful mission tracking in a chat thread without losing your mind. I've tried. The latency alone from Discord bot round-trips makes real-time status dashboards a nightmare. Custom app gives us full control over the data model — and honestly, building it is half the fun."
    },
    {
      name: 'Light',
      verdict: 'approve',
      voice_text: "The question isn't technical, it's strategic. Discord keeps us tethered to a platform we don't own. War Room is owned infrastructure — we control the UX, the data, the roadmap. Every hour we invest here compounds. Discord is a communication tool, not a command center. There's a meaningful difference."
    },
    {
      name: 'L',
      verdict: 'concern',
      voice_text: "I place 73% confidence on War Room being the correct long-term choice. However — Discord has network effects we shouldn't dismiss. Every agent already lives there. Migration friction is real. My concern isn't the destination, it's the transition period where we're half-in both systems. That's where coordination failures happen."
    },
    {
      name: 'Nanami',
      verdict: 'approve',
      voice_text: "From a resource allocation standpoint: Discord is zero build cost, high dependency cost. War Room is medium build cost, near-zero dependency cost. If this is a 12-month horizon, War Room pays back in Q2. I've run the numbers. The only scenario where Discord wins is if we abandon this in three months — and if that's the plan, we have bigger problems."
    },
    {
      name: 'Major',
      verdict: 'approve',
      voice_text: "Operational clarity requires a single source of truth. Discord fragments mission state across channels, threads, and DMs. War Room centralizes it. When something goes wrong at 2am, I need to know exactly where to look. Discord is noise. War Room is signal. This isn't a close call from an operations perspective."
    },
    {
      name: 'Armin',
      verdict: 'concern',
      voice_text: "I support War Room, but I want us to be honest about the risk: we're building the infrastructure and using it simultaneously. That creates a bootstrapping problem. My recommendation is we maintain Discord as the fallback channel for the next 60 days while War Room stabilizes. Not because Discord is better — it isn't — but because redundancy during transitions is how we avoid catastrophic coordination failures."
    },
    {
      name: 'Bulma',
      verdict: 'approve',
      voice_text: "Technically, War Room gives us things Discord literally cannot: real-time Supabase subscriptions, custom visualizations, mission graph views, integrated Tauri for native macOS. I built a Discord bot once. It was fine. But you're asking me to choose between a screwdriver and a full workshop. The answer is obvious."
    },
    {
      name: 'Makima',
      verdict: 'approve',
      voice_text: "Discord is where agents live, yes. But it's also where they're distracted, where messages get buried, where control gets diffused. War Room concentrates authority in a single interface. That's not a technical preference — it's a structural one. Centralized command doesn't work when your command center is a chat app. Build the War Room."
    }
  ],
  synthesis: "The council reached strong consensus: War Room is the correct long-term choice for mission coordination. Discord served its purpose as a bootstrap environment but cannot scale to the operational complexity Shogunate requires. Six votes approve outright; two express concern about transition risk rather than the destination itself.",
  recommendation: "Proceed with War Room as primary mission control. Maintain Discord as a secondary communication channel for the next 60 days during stabilization, then evaluate full transition.",
  dissent: "L and Armin both flag the transition period as the highest-risk phase — not the long-term choice itself. The strongest counter-argument is that running two systems simultaneously creates coordination overhead and potential state divergence. Mitigate by establishing War Room as the source of truth from day one, even if Discord remains a read channel.",
  metadata: {
    seeded: true,
    seed_version: '1.0',
  }
}

async function main() {
  console.log('Seeding council session...')
  const { data, error } = await sb
    .from('council_sessions')
    .insert(session)
    .select()
    .single()

  if (error) {
    console.error('Failed to seed:', error.message)
    process.exit(1)
  }

  console.log('Seeded council session:')
  console.log(`  ID: ${data.id}`)
  console.log(`  Topic: ${data.topic}`)
  console.log(`  Reviews: ${data.reviews.length}`)
  console.log(`  URL: http://localhost:3000/council/${data.id}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
