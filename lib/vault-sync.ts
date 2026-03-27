import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { Plan, ParsedBead } from './types';

const VAULT_BASE = join(process.env.HOME || '/Users/michaelenriquez', 'Shugyo', 'plans');

/**
 * Sync a plan to the Obsidian vault.
 * Creates repo-specific folders and saves a markdown file.
 */
export async function syncPlanToVault(plan: Plan): Promise<string | null> {
  // Skip on Vercel
  if (process.env.VERCEL) return null;

  try {
    // Determine repo folder from beads
    const repos = [...new Set(plan.parsed_beads.map((b: ParsedBead) => b.repo).filter(Boolean))];
    const folder =
      repos.length === 0
        ? 'general'
        : repos.length === 1
        ? repos[0]
        : 'cross-repo';

    const dir = join(VAULT_BASE, folder);
    await mkdir(dir, { recursive: true });

    // Generate filename: YYYY-MM-DD-slug.md
    const date = new Date().toISOString().split('T')[0];
    const slug = plan.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 50);
    const filename = `${date}-${slug}.md`;
    const filepath = join(dir, filename);

    // Generate markdown content
    const content = generatePlanMarkdown(plan);
    await writeFile(filepath, content, 'utf-8');

    return filepath;
  } catch (err) {
    console.error('[vault-sync] Failed:', err);
    return null;
  }
}

function generatePlanMarkdown(plan: Plan): string {
  const lines: string[] = [];

  lines.push(`# ${plan.title}`);
  lines.push('');
  lines.push(`**Status:** ${plan.status}`);
  lines.push(`**Flywheel Score:** ${plan.flywheel_score ?? 'N/A'}`);
  if (plan.score_breakdown) {
    lines.push(
      `**Breakdown:** Money ${plan.score_breakdown.money} · Blast ${plan.score_breakdown.blast_radius} · Novelty ${plan.score_breakdown.novelty}`
    );
  }
  lines.push(`**Beads:** ${plan.parsed_beads.length} · **Waves:** ${plan.wave_count}`);
  lines.push(`**Created:** ${plan.created_at}`);
  lines.push('');

  // Analysis section (if exists)
  if (plan.analysis) {
    lines.push('## Analysis');
    lines.push(`**Depth:** ${plan.analysis.depth}`);
    if (plan.analysis.pushback.length) {
      lines.push('### Pushback');
      plan.analysis.pushback.forEach((p) => lines.push(`- ${p}`));
    }
    if (plan.analysis.alternatives.length) {
      lines.push('### Alternatives');
      plan.analysis.alternatives.forEach((a) => lines.push(`- ${a}`));
    }
    if (plan.analysis.blind_spots.length) {
      lines.push('### Blind Spots');
      plan.analysis.blind_spots.forEach((b) => lines.push(`- ${b}`));
    }
    lines.push(`**Recommendation:** ${plan.analysis.recommendation}`);
    lines.push('');
  }

  // Wave breakdown
  lines.push('## Waves');
  const waveMap = new Map<number, ParsedBead[]>();
  for (const bead of plan.parsed_beads) {
    const wave = bead.wave_index;
    if (!waveMap.has(wave)) waveMap.set(wave, []);
    waveMap.get(wave)!.push(bead);
  }

  for (const [waveIdx, beads] of [...waveMap.entries()].sort((a, b) => a[0] - b[0])) {
    lines.push(`### Wave ${waveIdx}`);
    for (const bead of beads) {
      lines.push(`- **${bead.id}: ${bead.title}** (${bead.repo}, ${bead.size})`);
      if (bead.accept.length) {
        lines.push(`  - Accept: ${bead.accept[0]}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
