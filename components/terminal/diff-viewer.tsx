'use client'

interface DiffViewerProps {
  content: string
}

type LineType = 'addition' | 'deletion' | 'header' | 'context'

function classifyLine(line: string): LineType {
  if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) {
    return 'header'
  }
  if (line.startsWith('+')) {
    return 'addition'
  }
  if (line.startsWith('-')) {
    return 'deletion'
  }
  return 'context'
}

const lineStyles: Record<LineType, string> = {
  addition: 'bg-green-500/15 text-green-400',
  deletion: 'bg-red-500/15 text-red-400',
  header: 'text-cyan-400/70 font-semibold',
  context: 'text-muted-foreground',
}

export function DiffViewer({ content }: DiffViewerProps) {
  const lines = content.split('\n')

  return (
    <div className="w-full overflow-x-auto">
      {lines.map((line, i) => {
        const type = classifyLine(line)
        return (
          <div
            key={i}
            className={`px-2 leading-5 whitespace-pre ${lineStyles[type]}`}
          >
            {line || '\u00A0'}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Detect whether a string looks like a unified diff.
 * Checks for lines starting with +/- (excluding +++ and ---),
 * or @@ hunk headers, with a minimum threshold to avoid false positives.
 */
export function isDiffContent(content: string): boolean {
  const lines = content.split('\n')
  if (lines.length < 2) return false

  // Quick check: does it contain @@ hunk headers?
  const hasHunkHeader = lines.some((l) => l.startsWith('@@'))
  if (hasHunkHeader) return true

  // Fallback: count lines that look like diff additions/deletions
  let diffLineCount = 0
  for (const line of lines) {
    // +/- at start of line but not +++ or ---
    if (
      (line.startsWith('+') && !line.startsWith('+++')) ||
      (line.startsWith('-') && !line.startsWith('---'))
    ) {
      diffLineCount++
    }
  }

  // At least 2 diff-like lines and they make up >30% of non-empty lines
  const nonEmpty = lines.filter((l) => l.trim().length > 0).length
  return diffLineCount >= 2 && nonEmpty > 0 && diffLineCount / nonEmpty > 0.3
}
