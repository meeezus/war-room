import type { Discovery, Mission, Event } from '@/lib/types'

// ---------------------------------------------------------------------------
// Agent metadata for avatar rendering
// ---------------------------------------------------------------------------

const AGENT_META: Record<string, { initials: string; color: string; name: string }> = {
  ed:     { initials: 'E',  color: '#3b82f6', name: 'Ed' },
  light:  { initials: 'L',  color: '#a855f7', name: 'Light' },
  armin:  { initials: 'Ar', color: '#22c55e', name: 'Armin' },
  nanami: { initials: 'N',  color: '#f59e0b', name: 'Nanami' },
  major:  { initials: 'Mj', color: '#ef4444', name: 'Major' },
  makima: { initials: 'Mk', color: '#a855f7', name: 'Makima' },
  toji:   { initials: 'T',  color: '#f59e0b', name: 'Toji' },
}

function agentMeta(agentId: string) {
  return AGENT_META[agentId.toLowerCase()] ?? { initials: agentId.slice(0, 2).toUpperCase(), color: '#888', name: agentId }
}

// ---------------------------------------------------------------------------
// Severity → display
// ---------------------------------------------------------------------------

const SEVERITY_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'CRITICAL', color: '#0a0a0a', bg: '#ef4444' },
  warning:  { label: 'WARNING',  color: '#0a0a0a', bg: '#f59e0b' },
  info:     { label: 'INFO',     color: '#fafafa', bg: '#3b82f6' },
}

// ---------------------------------------------------------------------------
// HTML escape
// ---------------------------------------------------------------------------

function esc(str: string | undefined | null): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ---------------------------------------------------------------------------
// Discovery card
// ---------------------------------------------------------------------------

function renderDiscoveryCard(d: Discovery, actionUrl: string): string {
  const agent = agentMeta(d.agent_id)
  const badge = SEVERITY_BADGE[d.severity] ?? SEVERITY_BADGE.info
  const isDismissed = d.status === 'dismissed'

  const approveBtn = isDismissed ? '' : `
    <button
      onclick="handleAction('${esc(d.id)}', 'approve')"
      style="background:#22c55e;color:#0a0a0a;border:none;padding:6px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;letter-spacing:0.05em;">
      ✓ Approve
    </button>`

  const dismissBtn = isDismissed ? '' : `
    <button
      onclick="handleAction('${esc(d.id)}', 'dismiss')"
      style="background:#1a1a1a;color:#888;border:1px solid #2a2a2a;padding:6px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">
      ✕ Dismiss
    </button>`

  const suggestedAction = d.suggested_action ? `
    <p style="margin:8px 0 0;font-size:12px;color:#888;font-style:italic;">
      → ${esc(d.suggested_action)}
    </p>` : ''

  const repoTag = d.repo ? `
    <span style="font-size:11px;color:#888;background:#1a1a1a;padding:2px 8px;border-radius:4px;margin-left:8px;">
      ${esc(d.repo)}
    </span>` : ''

  return `
  <div id="card-${esc(d.id)}" style="
    background:#141414;
    border:1px solid ${isDismissed ? '#1a1a1a' : '#2a2a2a'};
    border-radius:10px;
    padding:16px;
    margin-bottom:10px;
    opacity:${isDismissed ? '0.5' : '1'};
    transition:opacity 0.3s;
  ">
    <div style="display:flex;align-items:flex-start;gap:12px;">
      <div style="
        width:36px;height:36px;border-radius:50%;
        background:${agent.color}22;
        border:1.5px solid ${agent.color}66;
        display:flex;align-items:center;justify-content:center;
        font-size:12px;font-weight:700;color:${agent.color};
        flex-shrink:0;
      ">${agent.initials}</div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
          <span style="
            background:${badge.bg};color:${badge.color};
            font-size:10px;font-weight:700;letter-spacing:0.08em;
            padding:2px 8px;border-radius:4px;
          ">${badge.label}</span>
          <span style="font-size:13px;color:#fafafa;font-weight:600;">${esc(d.title)}</span>
          ${repoTag}
        </div>
        <p style="margin:0 0 8px;font-size:13px;color:#aaa;line-height:1.5;">${esc(d.description)}</p>
        ${suggestedAction}
        <div style="display:flex;align-items:center;gap:8px;margin-top:12px;">
          ${approveBtn}
          ${dismissBtn}
          <span style="font-size:11px;color:#555;margin-left:auto;">${agent.name} · ${esc(d.category.replace('_', ' '))}</span>
        </div>
      </div>
    </div>
    <div id="status-${esc(d.id)}" style="display:none;margin-top:10px;padding:8px 12px;border-radius:6px;font-size:12px;"></div>
  </div>`
}

// ---------------------------------------------------------------------------
// Discovery group section
// ---------------------------------------------------------------------------

function renderSection(
  title: string,
  subtitle: string,
  color: string,
  discoveries: Discovery[],
  actionUrl: string,
  collapsed = false
): string {
  if (discoveries.length === 0) return ''

  const cards = discoveries.map(d => renderDiscoveryCard(d, actionUrl)).join('')
  const sectionId = `section-${title.replace(/\s+/g, '-').toLowerCase()}`

  if (collapsed) {
    return `
  <details style="margin-bottom:24px;">
    <summary style="
      display:flex;align-items:center;gap:10px;
      cursor:pointer;padding:12px 16px;
      background:#141414;border:1px solid #2a2a2a;border-radius:10px;
      list-style:none;user-select:none;
    ">
      <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;"></span>
      <span style="font-size:14px;font-weight:700;color:#fafafa;">${esc(title)}</span>
      <span style="font-size:12px;color:#555;">${esc(subtitle)}</span>
      <span style="margin-left:auto;font-size:12px;color:#555;">${discoveries.length} item${discoveries.length !== 1 ? 's' : ''} ▾</span>
    </summary>
    <div style="margin-top:8px;">${cards}</div>
  </details>`
  }

  return `
  <div style="margin-bottom:28px;" id="${sectionId}">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
      <span style="width:8px;height:8px;border-radius:50%;background:${color};"></span>
      <h2 style="margin:0;font-size:15px;font-weight:700;color:#fafafa;">${esc(title)}</h2>
      <span style="font-size:12px;color:#555;">${esc(subtitle)}</span>
      <span style="margin-left:auto;
        background:${color}22;color:${color};
        font-size:11px;font-weight:700;padding:2px 10px;border-radius:20px;
      ">${discoveries.length}</span>
    </div>
    ${cards}
  </div>`
}

// ---------------------------------------------------------------------------
// Activity summary bar
// ---------------------------------------------------------------------------

interface OvernightActivity {
  missionsCompleted: number
  tasksCompleted: number
  eventsCount: number
  patrolRan: boolean
}

function renderActivityBar(activity: OvernightActivity): string {
  const stats = [
    { label: 'Missions', value: activity.missionsCompleted, color: '#22c55e' },
    { label: 'Tasks done', value: activity.tasksCompleted, color: '#3b82f6' },
    { label: 'Events', value: activity.eventsCount, color: '#a855f7' },
  ]

  const patrolBadge = activity.patrolRan
    ? `<span style="background:#22c55e22;color:#22c55e;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;border:1px solid #22c55e44;">✓ Patrol ran</span>`
    : `<span style="background:#ef444422;color:#ef4444;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;border:1px solid #ef444444;">⚠ No patrol</span>`

  const statItems = stats.map(s => `
    <div style="text-align:center;padding:0 16px;border-right:1px solid #2a2a2a;">
      <div style="font-size:22px;font-weight:700;color:${s.color};">${s.value}</div>
      <div style="font-size:11px;color:#555;margin-top:2px;">${s.label}</div>
    </div>`).join('')

  return `
  <div style="
    background:#141414;border:1px solid #2a2a2a;border-radius:10px;
    padding:16px 20px;margin-bottom:28px;
    display:flex;align-items:center;gap:0;
  ">
    <div style="flex:1;">
      <div style="font-size:11px;color:#555;margin-bottom:4px;letter-spacing:0.08em;text-transform:uppercase;">Overnight Activity (12h)</div>
      <div style="display:flex;align-items:stretch;">${statItems}
        <div style="padding-left:16px;display:flex;align-items:center;">${patrolBadge}</div>
      </div>
    </div>
  </div>`
}

// ---------------------------------------------------------------------------
// Main HTML generator
// ---------------------------------------------------------------------------

export interface BriefData {
  discoveries: Discovery[]
  missions: Mission[]
  events: Event[]
  generatedAt: string
  actionUrl: string
}

export function generateBriefHtml(data: BriefData): string {
  const { discoveries, missions, events, generatedAt, actionUrl } = data

  // Group discoveries
  const critical = discoveries.filter(d => d.status === 'pending' && d.severity === 'critical')
  const warning = discoveries.filter(d => d.status === 'pending' && d.severity === 'warning')
  const info = discoveries.filter(d => d.status === 'pending' && d.severity === 'info')
  const dismissed = discoveries.filter(d => d.status === 'dismissed')

  // "Act on these" = critical; "Worth knowing" = warning + info
  const actOn = critical
  const worthKnowing = [...warning, ...info]

  // Overnight activity
  const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
  const missionsCompleted = missions.filter(m => m.status === 'completed' && m.completed_at && m.completed_at > cutoff).length
  const eventsCount = events.filter(e => e.created_at > cutoff).length
  const patrolRan = events.some(e => e.event_type === 'patrol_complete' && e.created_at > cutoff)

  // Task count from events metadata
  const tasksCompleted = events.filter(e => (e.event_type === 'task_completed' || e.event_type === 'step_completed') && e.created_at > cutoff).length

  const activity: OvernightActivity = { missionsCompleted, tasksCompleted, eventsCount, patrolRan }

  const totalPending = actOn.length + worthKnowing.length
  const dateLabel = new Date(generatedAt).toLocaleString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Morning Brief — War Room</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 0;
    background: #0a0a0a;
    color: #fafafa;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  details > summary::-webkit-details-marker { display: none; }
  a { color: #3b82f6; text-decoration: none; }
  a:hover { text-decoration: underline; }
</style>
</head>
<body>
<div style="max-width:760px;margin:0 auto;padding:32px 20px 64px;">

  <!-- Header -->
  <div style="margin-bottom:32px;">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
      <div style="width:40px;height:40px;border-radius:10px;background:#a855f722;border:1.5px solid #a855f744;display:flex;align-items:center;justify-content:center;font-size:18px;">⛩️</div>
      <div>
        <h1 style="margin:0;font-size:20px;font-weight:700;color:#fafafa;">Morning Brief</h1>
        <p style="margin:2px 0 0;font-size:12px;color:#555;">${esc(dateLabel)}</p>
      </div>
      <div style="margin-left:auto;text-align:right;">
        ${totalPending > 0
          ? `<div style="font-size:28px;font-weight:700;color:#ef4444;">${totalPending}</div>
             <div style="font-size:11px;color:#555;">pending review</div>`
          : `<div style="font-size:24px;">✓</div>
             <div style="font-size:11px;color:#22c55e;">all clear</div>`
        }
      </div>
    </div>
    <div style="height:1px;background:linear-gradient(90deg,#2a2a2a,transparent);margin-top:16px;"></div>
  </div>

  <!-- Overnight Activity -->
  ${renderActivityBar(activity)}

  <!-- Discoveries -->
  ${actOn.length === 0 && worthKnowing.length === 0
    ? `<div style="
        text-align:center;padding:40px;
        background:#141414;border:1px solid #2a2a2a;border-radius:10px;
        margin-bottom:24px;
      ">
        <div style="font-size:32px;margin-bottom:8px;">🌅</div>
        <div style="font-size:15px;color:#888;">No discoveries pending review</div>
        <div style="font-size:12px;color:#555;margin-top:4px;">The Daimyo found nothing that needs your attention.</div>
      </div>`
    : `${renderSection('Act on these', 'critical — needs action', '#ef4444', actOn, actionUrl)}
       ${renderSection('Worth knowing', 'informational discoveries', '#3b82f6', worthKnowing, actionUrl)}`
  }
  ${renderSection('Dismissed by pattern', 'previously dismissed', '#555', dismissed, actionUrl, true)}

</div>

<script>
  const ACTION_URL = '${actionUrl.replace(/'/g, "\\'")}';

  async function handleAction(discoveryId, action, reason) {
    const card = document.getElementById('card-' + discoveryId);
    const statusEl = document.getElementById('status-' + discoveryId);

    if (!card || !statusEl) return;

    // Disable buttons
    card.querySelectorAll('button').forEach(b => { b.disabled = true; b.style.opacity = '0.5'; });

    statusEl.style.display = 'block';
    statusEl.style.background = '#1a1a1a';
    statusEl.style.color = '#888';
    statusEl.textContent = action === 'approve' ? 'Approving…' : 'Dismissing…';

    try {
      const body = { discovery_id: discoveryId, action };
      if (reason) body.reason = reason;

      const res = await fetch(ACTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        card.style.opacity = '0.4';
        statusEl.style.background = action === 'approve' ? '#22c55e22' : '#ef444422';
        statusEl.style.color = action === 'approve' ? '#22c55e' : '#ef4444';
        statusEl.textContent = data.message || (action === 'approve' ? '✓ Approved — proposal created' : '✕ Dismissed');
      } else {
        statusEl.style.background = '#ef444422';
        statusEl.style.color = '#ef4444';
        statusEl.textContent = 'Error: ' + (data.error || 'Unknown error');
        card.querySelectorAll('button').forEach(b => { b.disabled = false; b.style.opacity = '1'; });
      }
    } catch (err) {
      statusEl.style.background = '#ef444422';
      statusEl.style.color = '#ef4444';
      statusEl.textContent = 'Network error — try again';
      card.querySelectorAll('button').forEach(b => { b.disabled = false; b.style.opacity = '1'; });
    }
  }
</script>
</body>
</html>`
}
