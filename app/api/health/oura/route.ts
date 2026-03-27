import { NextResponse } from 'next/server'
import { getOuraHealth } from '@/lib/oura'

export const dynamic = 'force-dynamic'

export async function GET() {
  const health = await getOuraHealth()
  return NextResponse.json(health)
}
