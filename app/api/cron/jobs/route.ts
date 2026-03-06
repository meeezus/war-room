import { NextResponse } from "next/server";
import { execSync } from "child_process";

export const dynamic = "force-dynamic";

type CronJob = {
  id: string;
  name: string;
  source: "openclaw" | "crontab" | "launchagent";
  schedule: string;
  enabled: boolean;
  description: string;
  lastStatus?: string;
  lastRun?: string;
  sessionTarget?: string;
  pid?: number;
};

// Human-readable descriptions for known crontab commands
const CRONTAB_DESCRIPTIONS: Record<string, string> = {
  "automate-daily.sh": "Daily automation script for Smaug MSOS — runs scheduled tasks and maintenance",
  "sync-claude-sessions.py": "Syncs Claude Code session data to central storage every 5 minutes",
  "cleanup-sessions.sh": "Moltbot session cleanup — removes stale Discord bot sessions daily at 4am",
  "update-clawdbot.sh": "Weekly Clawdbot update check — pulls latest bot code every Sunday at 3am",
  "folio-daily-reconcile.mjs": "Daily Folio vault reconciliation — syncs conversation data at midnight",
  "spark-embed-rebuild-if-stale.sh": "Rebuilds Spark embeddings if stale — keeps memory search index fresh",
};

// Human-readable descriptions for LaunchAgents
const LAUNCHAGENT_DESCRIPTIONS: Record<string, string> = {
  "ai.openclaw.gateway": "OpenClaw gateway — WebSocket server for Makima bot, handles Discord messages and cron execution",
  "com.warroom.poller": "Shogunate engine poller — runs ~60s cycles checking for missions, tasks, health, and triggers",
  "com.michael.claude-sessions-sync": "Claude session sync — periodically backs up Claude Code session transcripts",
  "com.michael.moltbot-cleanup": "Moltbot cleanup — maintains Discord bot session hygiene",
  "com.anthropic.claudefordesktop.ShipIt": "Claude Desktop auto-updater — checks for and installs Claude app updates",
  "com.openclaw.agentmail-poller": "OpenClaw AgentMail poller — checks for incoming agent-to-agent messages",
  "com.michael.clawdbot-update": "Clawdbot update monitor — watches for new bot releases",
};

function parseCronSchedule(cron: string): string {
  if (cron === "*/5 * * * *") return "Every 5 minutes";
  if (cron === "0 0 * * *") return "Daily at midnight";
  if (cron === "0 3 * * *") return "Daily at 3:00 AM";
  if (cron === "0 4 * * *") return "Daily at 4:00 AM";
  if (cron === "0 9 * * *") return "Daily at 9:00 AM";
  if (cron === "0 3 * * 0") return "Weekly on Sunday at 3:00 AM";
  return cron;
}

function msToHuman(ms: number): string {
  if (ms < 60000) return `Every ${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `Every ${Math.round(ms / 60000)}min`;
  if (ms < 86400000) return `Every ${Math.round(ms / 3600000)}h`;
  return `Every ${Math.round(ms / 86400000)}d`;
}

function getOpenClawCrons(): CronJob[] {
  try {
    const raw = execSync("npx openclaw cron list --json 2>/dev/null", {
      timeout: 15000,
      encoding: "utf-8",
      cwd: process.env.HOME,
    });
    const jsonStart = raw.indexOf("{");
    if (jsonStart < 0) return [];
    const data = JSON.parse(raw.slice(jsonStart));
    const jobs = data.jobs || [];

    return jobs.map((job: Record<string, unknown>) => {
      const schedule = job.schedule as Record<string, unknown> | undefined;
      const state = job.state as Record<string, unknown> | undefined;
      const payload = job.payload as Record<string, unknown> | undefined;

      return {
        id: `oc-${job.id}`,
        name: (job.name as string) || "Unnamed",
        source: "openclaw" as const,
        schedule: schedule?.everyMs
          ? msToHuman(schedule.everyMs as number)
          : String(schedule?.kind || "unknown"),
        enabled: job.enabled !== false,
        description: (payload?.message as string) || (payload?.text as string) || "OpenClaw scheduled job",
        lastStatus: (state?.lastStatus as string) || undefined,
        lastRun: state?.lastRunAtMs
          ? new Date(state.lastRunAtMs as number).toISOString()
          : undefined,
        sessionTarget: (job.sessionTarget as string) || "main",
      };
    });
  } catch {
    return [];
  }
}

function getCrontabEntries(): CronJob[] {
  try {
    const raw = execSync("crontab -l 2>/dev/null", {
      timeout: 5000,
      encoding: "utf-8",
    });
    return raw
      .split("\n")
      .filter((line) => line.trim() && !line.startsWith("#"))
      .map((line, i) => {
        const parts = line.trim().split(/\s+/);
        const schedule = parts.slice(0, 5).join(" ");
        const command = parts.slice(5).join(" ");
        const filename = command.split("/").pop()?.split(" ")[0]?.replace(/>>.*/, "").trim() || "";
        const description = Object.entries(CRONTAB_DESCRIPTIONS).find(
          ([key]) => command.includes(key)
        )?.[1] || `System cron: ${filename}`;

        return {
          id: `ct-${i}`,
          name: filename || `Crontab #${i + 1}`,
          source: "crontab" as const,
          schedule: parseCronSchedule(schedule),
          enabled: true,
          description,
        };
      });
  } catch {
    return [];
  }
}

function getLaunchAgents(): CronJob[] {
  try {
    const raw = execSync(
      "launchctl list 2>/dev/null | grep -E '(claude|warroom|openclaw|moltbot|clawdbot|agentmail)'",
      { timeout: 5000, encoding: "utf-8" }
    );
    return raw
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        const pid = parts[0] === "-" ? undefined : parseInt(parts[0], 10);
        const label = parts[2] || parts[1] || "";
        return {
          id: `la-${label}`,
          name: label,
          source: "launchagent" as const,
          schedule: pid ? "Always running" : "On demand",
          enabled: true,
          description: LAUNCHAGENT_DESCRIPTIONS[label] || `macOS background service: ${label}`,
          lastStatus: pid ? "running" : "idle",
          pid: pid || undefined,
        };
      });
  } catch {
    return [];
  }
}

export async function GET() {
  const [openclaw, crontab, launchagents] = await Promise.all([
    Promise.resolve(getOpenClawCrons()),
    Promise.resolve(getCrontabEntries()),
    Promise.resolve(getLaunchAgents()),
  ]);

  return NextResponse.json({
    openclaw,
    crontab,
    launchagents,
    total: openclaw.length + crontab.length + launchagents.length,
  });
}
