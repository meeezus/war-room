import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

const PHASES = ['scope', 'research', 'brd', 'prd', 'trd', 'build', 'review', 'ship'] as const
type Phase = typeof PHASES[number]

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = createServiceClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Service client unavailable' }, { status: 500 })
  }

  // Read current proposal
  const { data: proposal, error: fetchError } = await supabase
    .from('proposals')
    .select('id, phase')
    .eq('id', id)
    .single()

  if (fetchError || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  const currentPhase = proposal.phase as Phase | null
  const currentIdx = currentPhase ? PHASES.indexOf(currentPhase) : -1

  // If already at final phase, return error
  if (currentPhase === 'ship') {
    return NextResponse.json({ error: 'Proposal is already at final phase (ship)' }, { status: 400 })
  }

  // Determine next phase: if no phase set, start at first
  const nextPhase = currentIdx === -1 ? PHASES[0] : PHASES[currentIdx + 1]

  const { data: updated, error: updateError } = await supabase
    .from('proposals')
    .update({ phase: nextPhase })
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: 'Failed to advance phase' }, { status: 500 })
  }

  return NextResponse.json({ proposal: updated })
}
