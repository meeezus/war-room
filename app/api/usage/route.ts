import { NextResponse } from 'next/server'
import { readCodexBarSnapshot } from '@/lib/codexbar'

export const runtime = 'nodejs'

export async function GET() {
  const data = await readCodexBarSnapshot()
  return NextResponse.json(data, { status: 200 })
}
