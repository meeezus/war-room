import { NextResponse } from 'next/server'
import type { DaimyoStats } from '@/lib/types'

// This endpoint calls the Python engine's RPG stats module
// We'll use subprocess to call the Python script
export async function GET() {
  try {
    // Import exec from child_process
    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    const execAsync = promisify(exec)

    // Call Python script to get RPG stats using uv
    const { stdout } = await execAsync(
      'cd ~/Code/shogunate && uv run python -c "from engine.rpg_stats import get_all_daimyo_stats; import json; print(json.dumps(get_all_daimyo_stats()))"',
      { shell: '/bin/bash' }
    )

    const stats: Record<string, DaimyoStats> = JSON.parse(stdout)

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching RPG stats:', error)

    // Return baseline stats on error
    const baselineStats: Record<string, DaimyoStats> = {
      ed: {
        agent_id: 'ed',
        level: 1,
        spd: 50,
        tru: 50,
        wis: 50,
        cre: 50,
        domain_stat_1: 50,
        domain_stat_2: 50,
        domain_stat_1_name: 'COD',
        domain_stat_2_name: 'REF',
        rpg_class: 'Artificer',
      },
      light: {
        agent_id: 'light',
        level: 1,
        spd: 50,
        tru: 50,
        wis: 50,
        cre: 50,
        domain_stat_1: 50,
        domain_stat_2: 50,
        domain_stat_1_name: 'TAC',
        domain_stat_2_name: 'VIS',
        rpg_class: 'Strategist',
      },
      power: {
        agent_id: 'power',
        level: 1,
        spd: 50,
        tru: 50,
        wis: 50,
        cre: 50,
        domain_stat_1: 50,
        domain_stat_2: 50,
        domain_stat_1_name: 'CHA',
        domain_stat_2_name: 'INT',
        rpg_class: 'Diplomat',
      },
      major: {
        agent_id: 'major',
        level: 1,
        spd: 50,
        tru: 50,
        wis: 50,
        cre: 50,
        domain_stat_1: 50,
        domain_stat_2: 50,
        domain_stat_1_name: 'DEF',
        domain_stat_2_name: 'LOG',
        rpg_class: 'Warden',
      },
    }

    return NextResponse.json(baselineStats)
  }
}
