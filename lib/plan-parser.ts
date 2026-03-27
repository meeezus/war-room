import type { ParsedBead } from './types'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ParseResult {
  title: string
  beads: ParsedBead[]
  waves: ParsedBead[][]   // beads grouped by wave_index
  flywheelScore: number
  scoreBreakdown: { money: number; blast_radius: number; novelty: number }
  waveCount: number
}

/**
 * Parse flywheel-format markdown into structured beads with dependency graph
 * and wave computation via topological sort.
 *
 * Pure function -- no side effects, no network calls.
 * Handles malformed markdown gracefully (partial results).
 * Throws only on dependency cycles.
 */
export function parsePlanMarkdown(markdown: string): ParseResult {
  if (!markdown.trim()) {
    return {
      title: '',
      beads: [],
      waves: [],
      flywheelScore: 6,
      scoreBreakdown: { money: 2, blast_radius: 2, novelty: 2 },
      waveCount: 0,
    }
  }

  const title = extractTitle(markdown)
  const scoreBreakdown = extractFlywheelScore(markdown)
  const flywheelScore = scoreBreakdown.money + scoreBreakdown.blast_radius + scoreBreakdown.novelty
  const rawBeads = extractBeads(markdown)
  const beads = rawBeads.map((raw) => parseBead(raw))

  // Compute waves via topological sort (throws on cycles)
  assignWaveIndices(beads)

  // Group beads into waves
  const waveCount = beads.length > 0 ? Math.max(...beads.map((b) => b.wave_index)) + 1 : 0
  const waves: ParsedBead[][] = []
  for (let i = 0; i < waveCount; i++) {
    waves.push(beads.filter((b) => b.wave_index === i))
  }

  return { title, beads, waves, flywheelScore, scoreBreakdown, waveCount }
}

// ---------------------------------------------------------------------------
// Title extraction
// ---------------------------------------------------------------------------

function extractTitle(md: string): string {
  const lines = md.split('\n')
  // First # heading (top-level only, not ## or ###)
  for (const line of lines) {
    if (/^# [^#]/.test(line)) {
      return line.replace(/^# /, '').trim()
    }
  }
  // Fallback: first non-empty line
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed) return trimmed
  }
  return ''
}

// ---------------------------------------------------------------------------
// Flywheel score extraction
// ---------------------------------------------------------------------------

function extractFlywheelScore(md: string): { money: number; blast_radius: number; novelty: number } {
  const money = extractScoreDimension(md, /^(?:Money(?:\s+at\s+stake)?)\s*:\s*(\d)/im)
  const blastRadius = extractScoreDimension(md, /^Blast\s+[Rr]adius\s*:\s*(\d)/im)
  const novelty = extractScoreDimension(md, /^Novelty\s*:\s*(\d)/im)
  return {
    money: money ?? 2,
    blast_radius: blastRadius ?? 2,
    novelty: novelty ?? 2,
  }
}

function extractScoreDimension(md: string, pattern: RegExp): number | null {
  const match = md.match(pattern)
  if (!match) return null
  const val = parseInt(match[1], 10)
  return val >= 1 && val <= 3 ? val : null
}

// ---------------------------------------------------------------------------
// Bead extraction — split markdown into raw bead sections
// ---------------------------------------------------------------------------

interface RawBead {
  id: string
  title: string
  content: string
}

/** Bead header: ### BEAD-xxx: Title  or  ## BEAD-xxx: Title */
const BEAD_HEADER_RE = /^#{2,3}\s+BEAD-(\d+)\s*:\s*(.+)$/

function extractBeads(md: string): RawBead[] {
  const lines = md.split('\n')
  const beads: RawBead[] = []
  let current: RawBead | null = null

  for (const line of lines) {
    const headerMatch = line.match(BEAD_HEADER_RE)
    if (headerMatch) {
      // Save previous bead
      if (current) beads.push(current)
      current = {
        id: `BEAD-${headerMatch[1]}`,
        title: headerMatch[2].trim(),
        content: '',
      }
      continue
    }

    // A --- separator ends the current bead section
    if (/^---\s*$/.test(line) && current) {
      beads.push(current)
      current = null
      continue
    }

    if (current) {
      current.content += line + '\n'
    }
  }

  // Push last bead
  if (current) beads.push(current)

  return beads
}

// ---------------------------------------------------------------------------
// Bead field parsing
// ---------------------------------------------------------------------------

function parseBead(raw: RawBead): ParsedBead {
  const content = raw.content
  return {
    id: raw.id,
    title: raw.title,
    description: extractDescription(content),
    dependencies: extractBeadIds(content, /(?:Depends\s+on|Dependencies)\s*:\*?\*?\s*(.+)/i),
    blocks: extractBeadIds(content, /Blocks\s*:\*?\*?\s*(.+)/i),
    size: extractSize(content),
    accept: extractAccept(content),
    files: extractFiles(content),
    repo: extractRepo(content),
    domain: extractDomain(content),
    wave_index: 0, // computed later by topological sort
    model: extractModel(content),
  }
}

/**
 * Extract bead IDs from a field like "Depends on: 001, 002" or "Depends on: BEAD-001, BEAD-002".
 * Normalizes bare numbers to BEAD-xxx format.
 */
function extractBeadIds(content: string, pattern: RegExp): string[] {
  const match = content.match(pattern)
  if (!match) return []
  const raw = match[1].trim()
  if (/^none$/i.test(raw)) return []

  return raw
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizeBeadId)
}

/** Normalize "001" to "BEAD-001", pass through "BEAD-001" unchanged. */
function normalizeBeadId(id: string): string {
  if (/^BEAD-/i.test(id)) return id.toUpperCase()
  // Bare number like "001"
  const num = id.replace(/\D/g, '')
  if (num) return `BEAD-${num.padStart(3, '0')}`
  return id
}

function extractSize(content: string): 'S' | 'M' | 'L' {
  const match = content.match(/Size\s*:\*?\*?\s*([SML])\b/i)
  if (!match) return 'M'
  return match[1].toUpperCase() as 'S' | 'M' | 'L'
}

function extractAccept(content: string): string[] {
  const match = content.match(/Accept\s*:\*?\*?\s*(.+)/i)
  if (!match) return []
  return [match[1].trim()]
}

function extractFiles(content: string): string[] {
  const files: string[] = []

  // Match inline: **Files:** `a.ts`, `b.ts`
  const inlineMatch = content.match(/Files\s*:\*?\*?\s*(.+)/i)
  if (inlineMatch) {
    const line = inlineMatch[1]
    const backtickMatches = line.matchAll(/`([^`]+)`/g)
    for (const m of backtickMatches) {
      files.push(m[1].trim())
    }
    // If no backticks, split by comma
    if (files.length === 0) {
      line
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((f) => files.push(f))
    }
  }

  // Match list items with backtick-wrapped paths: - `path/to/file` (note)
  const listPattern = /^[-*]\s+`([^`]+)`/gm
  let listMatch
  while ((listMatch = listPattern.exec(content)) !== null) {
    const path = listMatch[1].trim()
    if (!files.includes(path)) {
      files.push(path)
    }
  }

  return files
}

function extractRepo(content: string): string {
  // Explicit Repo: field
  const repoMatch = content.match(/Repo\s*:\*?\*?\s*(.+)/i)
  if (repoMatch) return repoMatch[1].trim()

  // Infer from file paths
  const files = extractFiles(content)
  return inferRepoFromFiles(files)
}

function inferRepoFromFiles(files: string[]): string {
  for (const f of files) {
    // ~/Code/shogunate/ or engine/ paths
    if (/shogunate/i.test(f) || /^engine\//i.test(f)) return 'shogunate'
    // ~/Code/folio-app/ paths
    if (/folio/i.test(f)) return 'folio-app'
    // war-room standard directories
    if (/^(app|lib|components|supabase)\//i.test(f)) return 'war-room'
  }
  return 'war-room' // default
}

function extractDomain(content: string): string {
  const match = content.match(/Domain\s*:\*?\*?\s*(.+)/i)
  if (!match) return 'engineering'
  return match[1].trim().toLowerCase()
}

function extractModel(content: string): string {
  const match = content.match(/Model\s*:\*?\*?\s*(\w+)/i)
  if (!match) return 'sonnet'
  const model = match[1].trim().toLowerCase()
  if (['sonnet', 'opus', 'haiku'].includes(model)) return model
  return 'sonnet'
}

/**
 * Extract description: non-field content lines, including JTBD and Outcome.
 */
function extractDescription(content: string): string {
  const fieldPatterns = [
    /^[-*]\s+\*?\*?(?:Depends\s+on|Dependencies|Blocks|Size|Accept|Files|Repo|Domain|Model|Parallel)\s*:/i,
    /^\*?\*?(?:Files)\s*:\*?\*?\s*/i,
  ]

  const lines = content.split('\n')
  const descLines: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      // Preserve paragraph breaks in description
      if (descLines.length > 0 && descLines[descLines.length - 1] !== '') {
        descLines.push('')
      }
      continue
    }

    // Skip field lines
    const isField = fieldPatterns.some((p) => p.test(trimmed))
    if (isField) continue

    // Skip list-item file paths (- `path/to/file`)
    if (/^[-*]\s+`[^`]+`/.test(trimmed)) continue

    descLines.push(trimmed)
  }

  // Trim trailing empty lines
  while (descLines.length > 0 && descLines[descLines.length - 1] === '') {
    descLines.pop()
  }

  return descLines.join('\n').trim()
}

// ---------------------------------------------------------------------------
// Topological sort — assign wave indices
// ---------------------------------------------------------------------------

function assignWaveIndices(beads: ParsedBead[]): void {
  if (beads.length === 0) return

  const beadMap = new Map<string, ParsedBead>()
  for (const b of beads) beadMap.set(b.id, b)

  // Build adjacency: dependency -> dependents
  // For wave computation, a bead's wave = max(wave of deps) + 1
  // We use Kahn's algorithm to detect cycles and compute levels

  // In-degree = number of resolved dependencies
  const inDegree = new Map<string, number>()
  const resolvedDeps = new Map<string, string[]>() // bead -> its dependencies that exist

  for (const b of beads) {
    // Only count dependencies that reference beads in this plan
    const resolved = b.dependencies.filter((d) => beadMap.has(d))
    resolvedDeps.set(b.id, resolved)
    inDegree.set(b.id, resolved.length)
  }

  // Start with beads that have no (resolved) dependencies
  const queue: string[] = []
  for (const b of beads) {
    if (inDegree.get(b.id) === 0) {
      queue.push(b.id)
    }
  }

  // Wave assignment via BFS levels
  const waveOf = new Map<string, number>()
  let processed = 0

  // Process level by level
  while (queue.length > 0) {
    const nextQueue: string[] = []

    for (const id of queue) {
      const bead = beadMap.get(id)!
      // Wave = max wave of resolved deps + 1, or 0 if no deps
      const deps = resolvedDeps.get(id) ?? []
      const maxDepWave = deps.length > 0
        ? Math.max(...deps.map((d) => waveOf.get(d) ?? 0))
        : -1
      const wave = maxDepWave + 1
      waveOf.set(id, wave)
      bead.wave_index = wave
      processed++

      // Find all beads that depend on this one and decrement their in-degree
      for (const other of beads) {
        const otherDeps = resolvedDeps.get(other.id) ?? []
        if (otherDeps.includes(id)) {
          const newDeg = (inDegree.get(other.id) ?? 1) - 1
          inDegree.set(other.id, newDeg)
          if (newDeg === 0) {
            nextQueue.push(other.id)
          }
        }
      }
    }

    queue.length = 0
    queue.push(...nextQueue)
  }

  if (processed < beads.length) {
    // Find beads in the cycle for a helpful error message
    const inCycle = beads.filter((b) => !waveOf.has(b.id)).map((b) => b.id)
    throw new Error(`Dependency cycle detected among beads: ${inCycle.join(', ')}`)
  }
}
