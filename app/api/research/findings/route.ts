import { NextResponse } from 'next/server'
import { getResearchFindings } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '20')
  const status = searchParams.get('status') || undefined

  const findings = await getResearchFindings(limit, status)
  return NextResponse.json({ findings })
}
