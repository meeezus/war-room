import { readFile } from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

export interface CodexBarQuotaInfo {
  percentUsed: number
  resetTime: string
  windowName: string
}

export interface CodexBarDailyEntry {
  date: string
  cost: number
  inputTokens: number
  outputTokens: number
}

export interface CodexBarSession {
  cost: number
  inputTokens: number
  outputTokens: number
}

export interface CodexBarProvider {
  name: string
  quotaInfo: CodexBarQuotaInfo
  dailyUsage: CodexBarDailyEntry[]
  currentSession: CodexBarSession
}

export interface CodexBarSnapshot {
  providers: CodexBarProvider[]
  lastUpdated: string
}

export interface CodexBarResult {
  providers: CodexBarProvider[]
  lastUpdated?: string
  error?: string
}

export function getCodexBarPath(): string {
  return path.join(
    os.homedir(),
    'Library',
    'Group Containers',
    'group.com.steipete.codexbar',
    'widget-snapshot.json'
  )
}

export async function readCodexBarSnapshot(): Promise<CodexBarResult> {
  const filePath = getCodexBarPath()

  try {
    const raw = await readFile(filePath, 'utf-8')
    let data: CodexBarSnapshot
    try {
      data = JSON.parse(raw) as CodexBarSnapshot
    } catch {
      return { error: 'Failed to parse CodexBar data', providers: [] }
    }
    return data
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      return { error: 'CodexBar not found', providers: [] }
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { error: `Failed to read CodexBar data: ${message}`, providers: [] }
  }
}
