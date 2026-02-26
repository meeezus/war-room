import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export const dynamic = 'force-dynamic'

interface RecapItem {
  name: string
  path: string
  size: number
  modified: string
  source: 'diagrams' | 'plans'
}

interface RecapGroup {
  date: string
  recaps: RecapItem[]
}

function scanDirectory(dir: string, source: 'diagrams' | 'plans'): RecapItem[] {
  try {
    if (!fs.existsSync(dir)) return []
    const entries = fs.readdirSync(dir)
    const items: RecapItem[] = []

    for (const entry of entries) {
      if (!entry.endsWith('.html')) continue
      const fullPath = path.join(dir, entry)
      try {
        const stat = fs.statSync(fullPath)
        if (!stat.isFile()) continue
        items.push({
          name: entry.replace(/\.html$/, ''),
          path: fullPath,
          size: stat.size,
          modified: stat.mtime.toISOString(),
          source,
        })
      } catch {
        // skip unreadable files
      }
    }

    return items
  } catch {
    // directory unreadable or permission denied — return empty
    return []
  }
}

function toDateString(iso: string): string {
  return iso.slice(0, 10) // YYYY-MM-DD
}

export async function GET() {
  const home = os.homedir()
  const diagramsDir = path.join(home, '.agent', 'diagrams')
  const plansDir = path.join(home, 'Shugyo', 'plans')

  const rawRecaps: RecapItem[] = [
    ...scanDirectory(diagramsDir, 'diagrams'),
    ...scanDirectory(plansDir, 'plans'),
  ]

  // Deduplicate: exact name match OR same size+mtime from different sources
  // (vault sync copies have identical bytes but prefixed names like project--date-slug)
  const deduped = new Map<string, RecapItem>()
  const sizeMtimeIndex = new Map<string, RecapItem>()

  for (const recap of rawRecaps) {
    const byName = deduped.get(recap.name)
    if (byName) {
      if (new Date(recap.modified).getTime() > new Date(byName.modified).getTime()) {
        deduped.set(recap.name, recap)
      }
      continue
    }

    // Cross-source dedup: vault sync copies have identical size, same minute
    const mtimeMin = Math.floor(new Date(recap.modified).getTime() / 60000)
    const sizeKey = `${recap.size}:${mtimeMin}`
    const bySize = sizeMtimeIndex.get(sizeKey)
    if (bySize && bySize.source !== recap.source) {
      if (recap.source === 'diagrams') {
        deduped.delete(bySize.name)
        deduped.set(recap.name, recap)
        sizeMtimeIndex.set(sizeKey, recap)
      }
      continue
    }

    deduped.set(recap.name, recap)
    sizeMtimeIndex.set(sizeKey, recap)
  }
  const allRecaps = Array.from(deduped.values())

  // Sort most recent first
  allRecaps.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())

  // Group by date
  const groupMap = new Map<string, RecapItem[]>()
  for (const recap of allRecaps) {
    const date = toDateString(recap.modified)
    if (!groupMap.has(date)) groupMap.set(date, [])
    groupMap.get(date)!.push(recap)
  }

  const groups: RecapGroup[] = Array.from(groupMap.entries()).map(([date, recaps]) => ({
    date,
    recaps,
  }))

  return NextResponse.json({ groups })
}
