import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const sb = createServiceClient()
  if (!sb) {
    return NextResponse.json({ success: false, error: 'Service client unavailable' }, { status: 500 })
  }

  let body: { discovery_id?: string; action?: string; reason?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { discovery_id, action, reason } = body

  if (!discovery_id || !action) {
    return NextResponse.json(
      { success: false, error: 'discovery_id and action are required' },
      { status: 400 }
    )
  }

  if (action !== 'approve' && action !== 'dismiss') {
    return NextResponse.json(
      { success: false, error: 'action must be "approve" or "dismiss"' },
      { status: 400 }
    )
  }

  try {
    // Fetch the discovery first to validate it exists and is pending
    const { data: discovery, error: fetchError } = await sb
      .from('discoveries')
      .select('*')
      .eq('id', discovery_id)
      .single()

    if (fetchError || !discovery) {
      return NextResponse.json(
        { success: false, error: 'Discovery not found' },
        { status: 404 }
      )
    }

    if (action === 'approve') {
      // Create a proposal linked to this discovery
      const { data: proposal, error: proposalError } = await sb
        .from('proposals')
        .insert({
          title: discovery.title,
          description: discovery.description + (discovery.suggested_action ? `\n\nSuggested action: ${discovery.suggested_action}` : ''),
          source: 'patrol',
          requested_by: discovery.agent_id,
          domain: mapCategoryToDomain(discovery.category),
          status: 'pending',
          auto_approved: false,
          council_review: false,
          reviews: [],
        })
        .select('id')
        .single()

      if (proposalError) throw proposalError

      // Update discovery status + link proposal
      const { error: updateError } = await sb
        .from('discoveries')
        .update({
          status: 'approved',
          proposal_id: proposal.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', discovery_id)

      if (updateError) throw updateError

      // Emit event
      await sb.from('events').insert({
        type: 'discovery_approved',
        agent: 'makima',
        message: `Discovery approved: "${discovery.title}"`,
        metadata: {
          discovery_id,
          title: discovery.title,
          proposal_id: proposal.id,
        },
      })

      return NextResponse.json({
        success: true,
        message: `✓ Approved — proposal created`,
        proposal_id: proposal.id,
      })
    }

    // dismiss
    const { error: updateError } = await sb
      .from('discoveries')
      .update({
        status: 'dismissed',
        feedback: reason ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', discovery_id)

    if (updateError) throw updateError

    // Emit event
    await sb.from('events').insert({
      type: 'discovery_dismissed',
      agent: 'makima',
      message: `Discovery dismissed: "${discovery.title}"`,
      metadata: {
        discovery_id,
        title: discovery.title,
        reason: reason ?? null,
      },
    })

    return NextResponse.json({
      success: true,
      message: `✕ Dismissed`,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

function mapCategoryToDomain(category: string): string {
  const map: Record<string, string> = {
    code_health:  'engineering',
    dependency:   'engineering',
    performance:  'engineering',
    cost:         'commerce',
    opportunity:  'product',
  }
  return map[category] ?? 'coordination'
}
